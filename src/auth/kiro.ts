// Kiro authentication.
//
// Login uses the AWS SSO device-authorization flow against
// oidc.<region>.amazonaws.com with Kiro's Builder ID issuer, then resolves
// the CodeWhisperer profileArn and user email. Tokens are refreshed either
// via the OIDC endpoint (device-flow credentials) or Kiro's desktop
// refresh endpoint (tokens imported from the IDE).

import { randomUUID } from 'node:crypto';
import type { Account, KiroCreds, KiroDesktopCreds, KiroOidcCreds } from '../types.ts';
import { ProviderError } from '../types.ts';

const KIRO_REGION = 'us-east-1';
const OIDC_BASE = `https://oidc.${KIRO_REGION}.amazonaws.com`;
const CW_BASE = `https://codewhisperer.${KIRO_REGION}.amazonaws.com`;
const DESKTOP_REFRESH_BASE = `https://prod.${KIRO_REGION}.auth.desktop.kiro.dev`;

const KIRO_UA = 'KiroIDE-1.0.0-ai-gateway';

const DEVICE_SCOPES = [
  'codewhisperer:completions',
  'codewhisperer:analysis',
  'codewhisperer:conversations',
  'codewhisperer:transformations',
  'codewhisperer:taskassist',
];

export interface DeviceLoginSession {
  loginId: string;
  userCode: string;
  verificationUri: string;
  verificationUriComplete: string;
  deviceCode: string;
  clientId: string;
  clientSecret: string;
  interval: number;
  expiresAt: number;
  state: 'pending' | 'done' | 'error' | 'expired';
  error?: string;
  account?: Account;
}

// In-memory registry of in-flight device logins (dashboard polls these).
const loginSessions = new Map<string, DeviceLoginSession>();

export async function startDeviceLogin(): Promise<DeviceLoginSession> {
  const reg = await json(OIDC_BASE + '/client/register', {
    clientName: 'Kiro',
    clientType: 'public',
    scopes: DEVICE_SCOPES,
    grantTypes: ['urn:ietf:params:oauth:grant-type:device_code', 'refresh_token'],
    issuerUrl: 'https://view.awsapps.com/start',
  });

  const auth = await json(OIDC_BASE + '/device_authorization', {
    clientId: reg.clientId,
    clientSecret: reg.clientSecret,
    startUrl: 'https://view.awsapps.com/start',
  });

  const session: DeviceLoginSession = {
    loginId: randomUUID(),
    userCode: auth.userCode,
    verificationUri: auth.verificationUri,
    verificationUriComplete: auth.verificationUriComplete,
    deviceCode: auth.deviceCode,
    clientId: reg.clientId,
    clientSecret: reg.clientSecret,
    interval: (auth.interval ?? 5) * 1000,
    expiresAt: Date.now() + (auth.expiresIn ?? 600) * 1000,
    state: 'pending',
  };
  // Expire stale pending logins after 15 minutes.
  for (const [key, entry] of loginSessions) {
    if (Date.now() > entry.expiresAt + 60_000) loginSessions.delete(key);
  }
  loginSessions.set(session.loginId, session);
  // Poll in the background; the dashboard watches session state.
  void pollDeviceToken(session);
  return session;
}

export function getLoginSession(id: string): DeviceLoginSession | undefined {
  return loginSessions.get(id);
}

async function pollDeviceToken(session: DeviceLoginSession) {
  while (session.state === 'pending') {
    if (Date.now() > session.expiresAt) {
      session.state = 'expired';
      break;
    }
    await sleep(session.interval);
    try {
      const res = await json(OIDC_BASE + '/token', {
        clientId: session.clientId,
        clientSecret: session.clientSecret,
        grantType: 'urn:ietf:params:oauth:grant-type:device_code',
        deviceCode: session.deviceCode,
      });
      const creds: KiroOidcCreds = {
        kind: 'oidc',
        accessToken: res.accessToken,
        refreshToken: res.refreshToken,
        expiresAt: Date.now() + (res.expiresIn ?? 3600) * 1000,
        clientId: session.clientId,
        clientSecret: session.clientSecret,
        region: KIRO_REGION,
        profileArn: '',
      };
      session.account = await buildAccount(creds);
      session.state = 'done';
      return;
    } catch (err) {
      if (err instanceof DeviceAuthError) {
        if (err.code === 'authorization_pending') continue;
        if (err.code === 'slow_down') {
          session.interval += 5000;
          continue;
        }
        session.state = 'error';
        session.error = err.code === 'expired_token' ? 'Device code expired — try again.' : `Login failed: ${err.code}`;
        return;
      }
      session.state = 'error';
      session.error = err instanceof Error ? err.message : String(err);
      return;
    }
  }
}

class DeviceAuthError extends Error {
  code: string;

  constructor(code: string) {
    super(code);
    this.code = code;
  }
}

async function json(url: string, body: unknown, headers: Record<string, string> = {}): Promise<any> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data: any = undefined;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    /* non-JSON response */
  }
  if (!res.ok) {
    // The OIDC token endpoint reports pending device grants as HTTP 400 with
    // an error code in the body rather than a distinct status.
    if (data?.error && typeof data.error === 'string') throw new DeviceAuthError(data.error);
    throw new Error(`${res.status} ${url}: ${text.slice(0, 300)}`);
  }
  return data;
}

/** After login or import: resolve profileArn, email, and initial quota. */
export async function buildAccount(creds: KiroCreds): Promise<Account> {
  const profileArn = creds.profileArn || (await listFirstProfileArn(creds));
  creds.profileArn = profileArn;

  let email: string | undefined;
  try {
    const limits = await getUsageLimits(creds);
    email = limits?.userInfo?.email;
  } catch {
    /* quota check is best-effort at login time */
  }

  return {
    id: randomUUID(),
    provider: 'kiro',
    email,
    label: email ?? 'Kiro Account',
    createdAt: Date.now(),
    credentials: creds,
    status: { state: 'ok' },
    stats: { requests: 0, errors: 0 },
  };
}

/** Import the Kiro IDE's ~/.aws/sso/cache/kiro-auth-token.json contents. */
export async function importIdeToken(token: Record<string, unknown>): Promise<Account> {
  const accessToken = str(token.accessToken);
  const refreshToken = str(token.refreshToken);
  if (!accessToken || !refreshToken) throw new Error('Token JSON must contain accessToken and refreshToken.');
  const clientId = str(token.clientId);
  const clientSecret = str(token.clientSecret);
  const region = str(token.region) || KIRO_REGION;
  const expiresAt = token.expiresAt ? Number(token.expiresAt) : Date.now() + 3600_000;

  const creds: KiroCreds =
    clientId && clientSecret
      ? { kind: 'oidc', accessToken, refreshToken, expiresAt, clientId, clientSecret, region, profileArn: str(token.profileArn) }
      : { kind: 'desktop', accessToken, refreshToken, expiresAt, region, profileArn: str(token.profileArn) };
  return buildAccount(creds);
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

async function listFirstProfileArn(creds: KiroCreds): Promise<string> {
  try {
    const res = await fetch(`${CW_BASE}/ListAvailableProfiles`, {
      method: 'POST',
      headers: authHeaders(creds),
      body: JSON.stringify({}),
    });
    if (!res.ok) return '';
    const data = (await res.json()) as { profiles?: { arn?: string }[] };
    return data.profiles?.find((p) => p.arn)?.arn ?? '';
  } catch {
    return '';
  }
}

export function authHeaders(creds: KiroCreds): Record<string, string> {
  return {
    authorization: `Bearer ${creds.accessToken}`,
    'content-type': 'application/json',
    'x-amz-user-agent': KIRO_UA,
    'x-amzn-codewhisperer-optout': 'true',
  };
}

export interface KiroUsageLimits {
  usageBreakdownList?: {
    resourceType?: string;
    currentUsage?: number;
    usageLimit?: number;
  }[];
  nextDateReset?: number;
  subscriptionInfo?: { subscriptionType?: string };
  userInfo?: { email?: string };
}

export async function getUsageLimits(creds: KiroCreds): Promise<KiroUsageLimits> {
  const params: Record<string, string> = {
    origin: 'AI_EDITOR',
    resourceType: 'AGENTIC_REQUEST',
    isEmailRequired: 'true',
  };
  if (creds.profileArn) params.profileArn = creds.profileArn;
  const q = new URLSearchParams(params);
  const res = await fetch(`${CW_BASE}/getUsageLimits?${q}`, { headers: authHeaders(creds) });
  if (!res.ok) throw new Error(`getUsageLimits ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()) as KiroUsageLimits;
}

// ---- Token refresh (single-flight per credentials object) ----

const refreshInFlight = new Map<KiroCreds, Promise<void>>();

export async function getValidAccessToken(creds: KiroCreds): Promise<string> {
  if (creds.expiresAt > Date.now() + 60_000) return creds.accessToken;
  let p = refreshInFlight.get(creds);
  if (!p) {
    p = refreshKiro(creds).finally(() => refreshInFlight.delete(creds));
    refreshInFlight.set(creds, p);
  }
  await p;
  return creds.accessToken;
}

async function refreshKiro(creds: KiroCreds): Promise<void> {
  try {
    if (creds.kind === 'oidc') {
      const res = await json(OIDC_BASE + '/token', {
        clientId: creds.clientId,
        clientSecret: creds.clientSecret,
        grantType: 'refresh_token',
        refreshToken: creds.refreshToken,
      });
      creds.accessToken = res.accessToken;
      if (res.refreshToken) creds.refreshToken = res.refreshToken;
      creds.expiresAt = Date.now() + (res.expiresIn ?? 3600) * 1000;
    } else {
      const res = await fetch(`${DESKTOP_REFRESH_BASE}/refreshToken`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'user-agent': KIRO_UA },
        body: JSON.stringify({ refreshToken: creds.refreshToken }),
      });
      if (!res.ok) {
        const body = await res.text();
        if (res.status === 400 || res.status === 403) throw new ProviderError('invalid_grant', 'Kiro refresh token rejected');
        throw new ProviderError('upstream', `Kiro refresh ${res.status}: ${body.slice(0, 200)}`);
      }
      const data = (await res.json()) as { accessToken?: string; refreshToken?: string; expiresIn?: number; profileArn?: string };
      if (!data.accessToken) throw new ProviderError('invalid_grant', 'Kiro refresh returned no accessToken');
      creds.accessToken = data.accessToken;
      if (data.refreshToken) creds.refreshToken = data.refreshToken;
      if (data.profileArn) creds.profileArn = data.profileArn;
      creds.expiresAt = Date.now() + (data.expiresIn ?? 3600) * 1000;
    }
  } catch (err) {
    if (err instanceof ProviderError || err instanceof DeviceAuthError) {
      if (err instanceof DeviceAuthError && err.code !== 'invalid_grant') {
        throw new ProviderError('upstream', `Kiro refresh failed: ${err.code}`);
      }
      if (err instanceof DeviceAuthError) throw new ProviderError('invalid_grant', 'Kiro refresh token rejected');
      throw err;
    }
    throw new ProviderError('upstream', `Kiro refresh failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
