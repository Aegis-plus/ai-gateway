// Shared types for the whole gateway.

export type ProviderId = 'kiro' | 'antigravity';

// ---------- Unified ("core") request model ----------
// Both the OpenAI (/v1/chat/completions) and Anthropic (/v1/messages)
// request formats are converted into CoreRequest before hitting a provider.

export type CoreContent =
  | { type: 'text'; text: string }
  | { type: 'image'; mediaType: string; base64: string }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; toolUseId: string; content: string };

export interface CoreMessage {
  role: 'user' | 'assistant';
  content: CoreContent[];
}

export interface CoreTool {
  name: string;
  description?: string;
  /** JSON Schema object for the tool parameters. */
  parameters: Record<string, unknown>;
}

export interface CoreRequest {
  /** Model id as requested by the client, e.g. "claude-sonnet-4-5". */
  model: string;
  system?: string;
  messages: CoreMessage[];
  tools?: CoreTool[];
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  stream: boolean;
}

// ---------- Provider stream events ----------
// Providers emit these; the OpenAI/Anthropic layers translate them into the
// wire format the client asked for.

export type ProviderEvent =
  | { type: 'text'; text: string }
  | { type: 'tool_start'; id: string; name: string }
  | { type: 'tool_delta'; id: string; argsDelta: string }
  | { type: 'tool_end'; id: string }
  | { type: 'usage'; inputTokens?: number; outputTokens?: number }
  | { type: 'credits'; creditType: string; amount: number }
  | { type: 'finish'; reason: 'stop' | 'tool_use' | 'length' };

// ---------- Accounts & credentials ----------

export interface KiroOidcCreds {
  kind: 'oidc';
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // epoch ms
  clientId: string;
  clientSecret: string;
  region: string; // e.g. us-east-1
  profileArn: string;
}

export interface KiroDesktopCreds {
  kind: 'desktop'; // imported from the Kiro IDE token file (social login)
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // epoch ms
  region: string;
  profileArn: string;
}

export type KiroCreds = KiroOidcCreds | KiroDesktopCreds;

export interface AntigravityCreds {
  kind: 'antigravity';
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // epoch ms
  scope: string;
  email?: string;
}

export interface AccountQuota {
  /** ISO timestamp of last successful refresh */
  checkedAt?: string;
  /** Kiro: usage breakdown + reset; Antigravity: quota buckets */
  kiro?: {
    usage: { currentUsage: number; usageLimit: number; resourceType: string }[];
    nextDateReset?: number; // epoch seconds
    subscriptionType?: string;
  };
  antigravity?: {
    buckets: { bucketId: string; displayName: string; remainingFraction: number; resetTime?: string }[];
    tier?: string;
    credits?: number;
  };
}

export interface AccountStats {
  requests: number;
  errors: number;
  lastUsedAt?: number;
}

export interface Account {
  id: string;
  provider: ProviderId;
  label?: string; // email or nickname
  email?: string;
  createdAt: number;
  credentials: KiroCreds | AntigravityCreds;
  status: {
    state: 'ok' | 'cooldown' | 'expired';
    cooldownUntil?: number; // epoch ms
    lastError?: string;
  };
  quota?: AccountQuota;
  stats: AccountStats;
  providerData?: {
    projectId?: string; // antigravity cloudaicompanionProject
    tier?: string;
  };
}

export interface ApiKey {
  key: string; // sk-gw-...
  name: string;
  createdAt: number;
}

export interface Config {
  port: number;
  host: string; // bind address, default 127.0.0.1
  publicBaseUrl?: string; // for OAuth redirect when not on localhost
  adminPassword?: string; // optional dashboard password
  apiKeys: ApiKey[];
}

// ---------- Errors used for rotation decisions ----------

export type ProviderErrorKind =
  | 'rate_limit' // 429 soft — short cooldown, rotate
  | 'quota' // hard quota exhausted — cooldown until reset, rotate
  | 'auth' // 401/403 — try refresh, then rotate
  | 'invalid_grant' // refresh token dead — mark expired
  | 'upstream'; // other upstream failure

export class ProviderError extends Error {
  kind: ProviderErrorKind;
  status?: number;
  cooldownMs?: number;

  constructor(kind: ProviderErrorKind, message: string, status?: number, cooldownMs?: number) {
    super(message);
    this.kind = kind;
    this.status = status;
    this.cooldownMs = cooldownMs;
  }
}

export function sanitizeAccount(a: Account): Omit<Account, 'credentials'> & { credentials: unknown } {
  const { credentials, ...rest } = a;
  return { ...rest, credentials: { redacted: true, kind: (credentials as { kind?: string })?.kind } };
}
