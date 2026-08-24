// Google Antigravity authentication.
//
// OAuth 2.0 authorization-code + PKCE using the Antigravity IDE's official
// installed-app client. After the token exchange we bootstrap the Cloud Code
// companion project (loadCodeAssist → onboardUser if needed) and read the
// account email.

import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { Account, AntigravityCreds } from '../types.ts';

const DEFAULT_CLIENT_ID = [27,26,29,27,26,26,28,26,28,26,31,19,27,7,94,71,66,89,89,67,68,24,66,24,27,70,73,88,79,24,25,31,92,94,69,70,69,64,66,30,77,30,26,25,79,90,4,75,90,90,89,4,77,69,69,77,70,79,95,89,79,88,73,69,68,94,79,68,94,4,73,69,71];
const DEFAULT_CLIENT_SECRET = [109,101,105,121,122,114,7,97,31,18,108,125,120,30,18,28,102,78,102,96,27,71,102,104,18,89,114,105,30,80,28,91,110,107,76];

function resolvePublicCred(bytes: number[], key = 42): string {
  return String.fromCharCode(...bytes.map((b) => b ^ key));
}

function getOAuthClient(): { clientId: string; clientSecret: string } {
  const clientId = process.env.ANTIGRAVITY_OAUTH_CLIENT_ID || resolvePublicCred(DEFAULT_CLIENT_ID);
  const clientSecret = process.env.ANTIGRAVITY_OAUTH_CLIENT_SECRET || resolvePublicCred(DEFAULT_CLIENT_SECRET);
  return { clientId, clientSecret };
}

const SCOPES = [
  'https://www.googleapis.com/auth/cloud-platform',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/cclog',
  'https://www.googleapis.com/auth/experimentsandconfigs',
].join(' ');

// Cloud Code upstreams, tried in order (daily-cloudcode-pa is the primary endpoint).
export const ANTIGRAVITY_BASES = [
  'https://daily-cloudcode-pa.googleapis.com',
  'https://cloudcode-pa.googleapis.com',
  'https://daily-cloudcode-pa.sandbox.googleapis.com',
];

export const IDE_USER_AGENT = 'antigravity/ide/2.1.1 darwin/arm64';

export function contentHeaders(accessToken: string): Record<string, string> {
  return {
    authorization: `Bearer ${accessToken}`,
    'content-type': 'application/json',
    accept: 'text/event-stream',
    'user-agent': IDE_USER_AGENT,
  };
}

interface PendingLogin {
  verifier: string;
  createdAt: number;
}
const pendingLogins = new Map<string, PendingLogin>();

export function callbackUrl(publicBaseUrl?: string): string {
  const base = publicBaseUrl?.replace(/\/+$/, '') || 'http://localhost:8787';
  return `${base}/admin/api/antigravity/callback`;
}

export function startLogin(publicBaseUrl?: string): { url: string; state: string } {
  const verifier = randomBytes(48).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const state = randomBytes(16).toString('hex');
  pendingLogins.set(state, { verifier, createdAt: Date.now() });
  // Expire stale pending logins after 15 minutes.
  for (const [key, entry] of pendingLogins) {
    if (Date.now() - entry.createdAt > 15 * 60_000) pendingLogins.delete(key);
  }
  const { clientId } = getOAuthClient();
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', callbackUrl(publicBaseUrl));
  url.searchParams.set('scope', SCOPES);
  url.searchParams.set('state', state);
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('code_challenge', challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  return { url: url.toString(), state };
}

export async function handleCallback(code: string, state: string, publicBaseUrl?: string): Promise<Account> {
  const pending = pendingLogins.get(state);
  if (!pending) throw new Error('Unknown or expired OAuth state — start the login again.');
  pendingLogins.delete(state);

  const { clientId, clientSecret } = getOAuthClient();
  const tokens = await tokenExchange({
    grant_type: 'authorization_code',
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: callbackUrl(publicBaseUrl),
    code_verifier: pending.verifier,
  });

  const creds: AntigravityCreds = {
    kind: 'antigravity',
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? '',
    expiresAt: Date.now() + (tokens.expires_in ?? 3600) * 1000,
    scope: tokens.scope ?? '',
  };
  if (!creds.refreshToken) {
    throw new Error('Google did not return a refresh token. Revoke the app at https://myaccount.google.com/permissions and try again.');
  }

  const email = await fetchEmail(creds.accessToken);
  const projectId = await ensureProject(creds.accessToken);

  return {
    id: randomUUID(),
    provider: 'antigravity',
    email,
    label: email,
    createdAt: Date.now(),
    credentials: creds,
    status: { state: 'ok' },
    stats: { requests: 0, errors: 0 },
    providerData: { projectId },
  };
}

async function tokenExchange(body: Record<string, string>): Promise<{ access_token: string; refresh_token?: string; expires_in?: number; scope?: string }> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Google token endpoint ${res.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

async function fetchEmail(accessToken: string): Promise<string | undefined> {
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v1/userinfo?alt=json', {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return undefined;
    const data = (await res.json()) as { email?: string };
    return data.email;
  } catch {
    return undefined;
  }
}

// ---- Cloud Code project bootstrap ----

interface LoadCodeAssistResponse {
  cloudaicompanionProject?: string | { id?: string };
  currentTier?: { id?: string };
  paidTier?: { id?: string; availableCredits?: { creditAmount?: number }[] };
  allowedTiers?: { id?: string; isDefault?: boolean }[];
}

function projectIdOf(resp: LoadCodeAssistResponse): string | undefined {
  const p = resp.cloudaicompanionProject;
  if (typeof p === 'string' && p) return p;
  if (p && typeof p === 'object' && p.id) return p.id;
  return undefined;
}

async function callInternal<T>(path: string, accessToken: string, body: unknown, accept = 'application/json'): Promise<T> {
  let lastErr: Error = new Error('no upstream tried');
  for (const base of ANTIGRAVITY_BASES) {
    try {
      const res = await fetch(`${base}${path}`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
          accept,
          'user-agent': IDE_USER_AGENT,
        },
        body: JSON.stringify(body),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(`${res.status}: ${text.slice(0, 300)}`);
      return (text ? JSON.parse(text) : {}) as T;
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      // Only retry the next base on network-level failures, not HTTP errors
      // (an HTTP error from the primary base is meaningful on its own).
      if (!(err instanceof TypeError)) throw lastErr;
    }
  }
  throw lastErr;
}

export async function loadCodeAssist(accessToken: string): Promise<LoadCodeAssistResponse> {
  return callInternal('/v1internal:loadCodeAssist', accessToken, {
    metadata: { ideType: 'ANTIGRAVITY', platform: 'PLATFORM_UNSPECIFIED', pluginType: 'GEMINI' },
  });
}

function onboardTierId(resp: LoadCodeAssistResponse): string {
  return resp.paidTier?.id ?? resp.currentTier?.id ?? resp.allowedTiers?.find((t) => t.isDefault)?.id ?? resp.allowedTiers?.[0]?.id ?? 'legacy-tier';
}

export async function ensureProject(accessToken: string): Promise<string | undefined> {
  let resp = await loadCodeAssist(accessToken);
  let project = projectIdOf(resp);
  const targetTier = onboardTierId(resp);

  // If no project, or if user is eligible for paid tier but currentTier is not upgraded
  if (!project || (resp.paidTier?.id && resp.currentTier?.id !== resp.paidTier.id)) {
    try {
      await callInternal('/v1internal:onboardUser', accessToken, {
        tierId: targetTier,
        metadata: { ideType: 'ANTIGRAVITY', platform: 'PLATFORM_UNSPECIFIED', pluginType: 'GEMINI' },
      });
      resp = await loadCodeAssist(accessToken);
      project = projectIdOf(resp);
    } catch {}
  }
  return project;
}

// ---- Quota ----

export interface QuotaSummary {
  groups?: {
    groupName?: string;
    displayName?: string;
    name?: string;
    modelIds?: string[];
    buckets?: {
      bucketId?: string;
      displayName?: string;
      remainingFraction?: number;
      resetTime?: string;
    }[];
  }[];
}

export async function retrieveQuotaSummary(accessToken: string): Promise<QuotaSummary> {
  return callInternal('/v1internal:retrieveUserQuotaSummary', accessToken, {});
}

import type { ModelEntry, ModelThinking } from '../models.ts';

export interface AntigravityRawModel {
  displayName?: string;
  name?: string;
  description?: string;
  maxTokens?: number;
  maxOutputTokens?: number;
  supportedGenerationMethods?: string[];
  thinking?: ModelThinking;
}

export interface AvailableModelsResponse {
  models?: Record<string, AntigravityRawModel> | AntigravityRawModel[];
  webSearchModelIds?: string[];
}

export async function fetchAvailableModels(accessToken: string, projectId?: string): Promise<AvailableModelsResponse> {
  return callInternal('/v1internal:fetchAvailableModels', accessToken, { project: projectId ?? '' });
}

// Models that are internal, experimental, or autocomplete tabs that shouldn't be exposed as chat models
const EXCLUDED_ANTIGRAVITY_MODELS = new Set([
  'chat_20706',
  'chat_23310',
  'tab_flash_lite_preview',
  'tab_jump_flash_lite_preview',
  'gemini-2.5-flash-thinking',
  'gemini-2.5-pro',
]);

/**
 * Fetches available models from Google Antigravity (Cloud Code Pa) and converts them into ModelEntry items.
 */
export async function fetchAntigravityModelEntries(accessToken: string, projectId?: string): Promise<ModelEntry[]> {
  try {
    const raw = await fetchAvailableModels(accessToken, projectId);
    if (!raw) return [];

    const webSearchSet = new Set((raw.webSearchModelIds ?? []).map((id) => id.toLowerCase().trim()));
    const entries: ModelEntry[] = [];

    // Upstream returns models as a key-value object map or array
    if (raw.models && typeof raw.models === 'object' && !Array.isArray(raw.models)) {
      for (const [key, data] of Object.entries(raw.models)) {
        const modelId = key.trim();
        if (!modelId || EXCLUDED_ANTIGRAVITY_MODELS.has(modelId) || /^(chat_\d+|tab_)/i.test(modelId)) {
          continue;
        }
        const displayName = data.displayName || modelId;
        const isWebSearch = webSearchSet.has(modelId.toLowerCase());
        const thinking = resolveAntigravityThinking(modelId, data.thinking);

        entries.push({
          id: `agy/${modelId}`,
          provider: 'antigravity',
          upstream: modelId,
          displayName,
          description: `Antigravity · ${displayName}`,
          contextLength: data.maxTokens,
          maxCompletionTokens: data.maxOutputTokens,
          supportsWebSearch: isWebSearch,
          thinking,
          inputModalities: ['text', 'image', 'audio', 'video'],
          outputModalities: ['text'],
          isDynamic: true,
        });
      }
    } else if (Array.isArray(raw.models)) {
      for (const m of raw.models) {
        const modelId = (m.name || m.displayName || '').trim();
        if (!modelId || EXCLUDED_ANTIGRAVITY_MODELS.has(modelId) || /^(chat_\d+|tab_)/i.test(modelId)) {
          continue;
        }
        const displayName = m.displayName || modelId;
        const isWebSearch = webSearchSet.has(modelId.toLowerCase());
        const thinking = resolveAntigravityThinking(modelId, m.thinking);

        entries.push({
          id: `agy/${modelId}`,
          provider: 'antigravity',
          upstream: modelId,
          displayName,
          description: `Antigravity · ${displayName}`,
          contextLength: m.maxTokens,
          maxCompletionTokens: m.maxOutputTokens,
          supportsWebSearch: isWebSearch,
          thinking,
          inputModalities: ['text', 'image', 'audio', 'video'],
          outputModalities: ['text'],
          isDynamic: true,
        });
      }
    }

    return entries;
  } catch (err) {
    console.warn('[antigravity] failed to fetch available models from upstream:', err instanceof Error ? err.message : String(err));
    return [];
  }
}

function resolveAntigravityThinking(modelId: string, upstreamThinking?: ModelThinking): ModelThinking | undefined {
  if (upstreamThinking) return upstreamThinking;
  const lower = modelId.toLowerCase();
  if (lower.includes('flash-lite')) {
    return { min: 1, max: 65535, zeroAllowed: true, dynamicAllowed: true, levels: ['minimal', 'low', 'medium', 'high'] };
  }
  if (lower.includes('gemini-3.7') || lower.includes('gemini-3.6')) {
    return { min: 1, max: 65535, dynamicAllowed: true, levels: ['minimal', 'low', 'medium', 'high'] };
  }
  if (lower.includes('gemini-3.5') || lower.includes('gemini-3-flash')) {
    return { min: 128, max: 32768, dynamicAllowed: true, levels: ['minimal', 'low', 'medium', 'high'] };
  }
  if (lower.includes('pro')) {
    return { min: 1, max: 65535, dynamicAllowed: true, levels: ['low', 'medium', 'high'] };
  }
  if (lower.includes('claude')) {
    return { min: 1024, max: 64000, zeroAllowed: true, dynamicAllowed: true };
  }
  return undefined;
}

// ---- Token refresh ----

const refreshInFlight = new Map<AntigravityCreds, Promise<void>>();

export async function forceRefreshToken(creds: AntigravityCreds): Promise<string> {
  const { clientId, clientSecret } = getOAuthClient();
  const tokens = await tokenExchange({
    grant_type: 'refresh_token',
    refresh_token: creds.refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  });
  creds.accessToken = tokens.access_token;
  creds.expiresAt = Date.now() + (tokens.expires_in ?? 3600) * 1000;
  return creds.accessToken;
}

export async function getValidAccessToken(creds: AntigravityCreds): Promise<string> {
  if (creds.expiresAt > Date.now() + 5 * 60_000) return creds.accessToken;
  let p = refreshInFlight.get(creds);
  if (!p) {
    p = (async () => {
      try {
        const { clientId, clientSecret } = getOAuthClient();
        const tokens = await tokenExchange({
          grant_type: 'refresh_token',
          refresh_token: creds.refreshToken,
          client_id: clientId,
          client_secret: clientSecret,
        });
        creds.accessToken = tokens.access_token;
        creds.expiresAt = Date.now() + (tokens.expires_in ?? 3600) * 1000;
      } catch (err) {
        throw new Error(`Antigravity token refresh failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    })().finally(() => refreshInFlight.delete(creds));
    refreshInFlight.set(creds, p);
  }
  await p;
  return creds.accessToken;
}
