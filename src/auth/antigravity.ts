// Google Antigravity authentication.
//
// OAuth 2.0 authorization-code + PKCE using the Antigravity IDE's official
// installed-app client. After the token exchange we bootstrap the Cloud Code
// companion project (loadCodeAssist → onboardUser if needed) and read the
// account email.

import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { Account, AntigravityCreds } from '../types.ts';

const CLIENT_ID = process.env.ANTIGRAVITY_OAUTH_CLIENT_ID ?? '';
const CLIENT_SECRET = process.env.ANTIGRAVITY_OAUTH_CLIENT_SECRET ?? '';

const SCOPES = [
  'https://www.googleapis.com/auth/cloud-platform',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/cclog',
  'https://www.googleapis.com/auth/experimentsandconfigs',
].join(' ');

// Cloud Code upstreams, tried in order (daily-cloudcode-pa is the official Antigravity IDE endpoint).
export const ANTIGRAVITY_BASES = [
  'https://daily-cloudcode-pa.googleapis.com',
  'https://daily-cloudcode-pa.sandbox.googleapis.com',
  'https://cloudcode-pa.googleapis.com',
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
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', CLIENT_ID);
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

  const tokens = await tokenExchange({
    grant_type: 'authorization_code',
    code,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
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
  if (!project) {
    await callInternal('/v1internal:onboardUser', accessToken, {
      tierId: onboardTierId(resp),
      metadata: { ideType: 'ANTIGRAVITY', platform: 'PLATFORM_UNSPECIFIED', pluginType: 'GEMINI' },
    });
    resp = await loadCodeAssist(accessToken);
    project = projectIdOf(resp);
  }
  return project;
}

// ---- Quota ----

export interface QuotaSummary {
  groups?: {
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

export interface AvailableModels {
  models?: {
    name?: string;
    displayName?: string;
    quotaInfo?: { remainingFraction?: number; resetTime?: string };
  }[];
}

export async function fetchAvailableModels(accessToken: string, projectId?: string): Promise<AvailableModels> {
  return callInternal('/v1internal:fetchAvailableModels', accessToken, { project: projectId ?? '' });
}

// ---- Token refresh ----

const refreshInFlight = new Map<AntigravityCreds, Promise<void>>();

export async function getValidAccessToken(creds: AntigravityCreds): Promise<string> {
  if (creds.expiresAt > Date.now() + 5 * 60_000) return creds.accessToken;
  let p = refreshInFlight.get(creds);
  if (!p) {
    p = (async () => {
      try {
        const tokens = await tokenExchange({
          grant_type: 'refresh_token',
          refresh_token: creds.refreshToken,
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
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
