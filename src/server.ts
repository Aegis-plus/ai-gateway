// HTTP server: OpenAI/Anthropic-compatible API, admin REST API, dashboard.

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import type { Store } from './store.ts';
import { MODEL_CATALOG, resolveModel } from './models.ts';
import { sanitizeAccount, sanitizeApiKey, ProviderError, type Account } from './types.ts';
import { accountsFor, startStreamWithRotation } from './pool.ts';
import { refreshAccountQuota, refreshAllQuotas } from './quota.ts';
import { parseOpenAIRequest, RequestFormatError, buildOpenAICompletion, streamOpenAI, openaiCompletionId } from './openai.ts';
import { parseAnthropicRequest, buildAnthropicMessage, streamAnthropic } from './anthropic.ts';
import { EventAggregator } from './aggregate.ts';
import { startDeviceLogin, getLoginSession, importIdeToken, forceRefreshToken as kiroForceRefreshToken } from './auth/kiro.ts';
import { startLogin, handleCallback, forceRefreshToken as agyForceRefreshToken } from './auth/antigravity.ts';
import { createBackup, restoreBackup } from './backup.ts';

const MAX_BODY = 64 * 1024 * 1024;

export function createGatewayServer(store: Store): ReturnType<typeof createServer> {
  const publicDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
  let dashboardHtml: string;
  try {
    dashboardHtml = readFileSync(join(publicDir, 'index.html'), 'utf8');
  } catch {
    dashboardHtml = '<!doctype html><title>AI Gateway</title><p>Dashboard file missing.</p>';
  }

  const server = createServer((req, res) => {
    handle(req, res).catch((err) => {
      console.error('[server] unhandled error:', err);
      if (!res.headersSent) res.writeHead(500, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: { message: 'Internal gateway error' } }));
    });
  });

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    // Global CORS headers for reverse proxies, Cloudflare Tunnel, and web clients
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key, X-Admin-Key');

    const method = req.method ?? 'GET';
    if (method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url ?? '/', 'http://localhost');
    const path = url.pathname;

    // ---------- dashboard ----------
    if (method === 'GET' && (path === '/' || path === '/index.html')) {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      try {
        res.end(readFileSync(join(publicDir, 'index.html'), 'utf8'));
      } catch {
        res.end(dashboardHtml);
      }
      return;
    }

    // ---------- public API ----------
    if (path === '/health' || path === '/healthz' || path === '/ping') {
      json(res, 200, { ok: true, status: 'healthy' });
      return;
    }
    // Accept both /v1/... and bare /models, /chat/completions, /messages so
    // clients work whether their base URL includes "/v1" or not.
    if (path.startsWith('/v1/') || path === '/models' || path === '/chat/completions' || path === '/messages') {
      const apiPath = path.startsWith('/v1/') ? path : `/v1${path}`;
      return handleApi(req, res, method, apiPath);
    }

    // ---------- admin API ----------
    if (path.startsWith('/admin/api/')) {
      // The OAuth callback arrives from Google's redirect without our headers.
      if (path !== '/admin/api/antigravity/callback' && !adminAuthorized(req)) {
        json(res, 401, { error: 'Admin key required' });
        return;
      }
      return handleAdmin(req, res, method, path, url);
    }

    json(res, 404, { error: 'Not found' });
  }

  // ================= public API =================

  function apiKeyFrom(req: IncomingMessage): string | null {
    const auth = req.headers.authorization;
    if (auth?.startsWith('Bearer ')) return auth.slice(7).trim();
    const xkey = req.headers['x-api-key'];
    if (typeof xkey === 'string') return xkey.trim();
    return null;
  }

  function apiAuthorized(req: IncomingMessage): boolean {
    const key = apiKeyFrom(req);
    if (!key) return false;
    const match = store.config.apiKeys.find((k) => k.key === key);
    if (!match) return false;
    if (match.revoked === true) return false;
    if (match.expiresAt && match.expiresAt <= Date.now()) return false;
    store.recordApiKeyUsage(key);
    return true;
  }

  async function handleApi(req: IncomingMessage, res: ServerResponse, method: string, path: string): Promise<void> {
    if (!apiAuthorized(req)) {
      json(res, 401, { error: { message: 'Invalid or missing API key. Create one in the dashboard.', type: 'invalid_request_error', code: 'invalid_api_key' } });
      return;
    }

    if (method === 'GET' && path === '/v1/models') {
      const data = MODEL_CATALOG.map((m) => ({
        id: m.id,
        object: 'model',
        created: 0,
        owned_by: m.provider,
      }));
      json(res, 200, { object: 'list', data });
      return;
    }

    if (method === 'POST' && (path === '/v1/chat/completions' || path === '/v1/messages')) {
      const body = await readBody(req);
      const openaiFormat = path === '/v1/chat/completions';
      let core;
      try {
        core = openaiFormat ? parseOpenAIRequest(body) : parseAnthropicRequest(body);
      } catch (err) {
        if (err instanceof RequestFormatError) {
          json(res, 400, { error: { message: err.message, type: 'invalid_request_error' } });
          return;
        }
        throw err;
      }

      const entry = resolveModel(core.model);
      if (!entry) {
        json(res, 404, { error: { message: `Unknown model: ${core.model}. Prefix with kiro/ or antigravity/ to use raw upstream ids.`, type: 'invalid_request_error' } });
        return;
      }
      if (accountsFor(store, entry.provider).length === 0) {
        json(res, 503, { error: { message: `No ${entry.provider} account configured — add one in the dashboard.`, type: 'server_error' } });
        return;
      }

      let started;
      try {
        started = await startStreamWithRotation(entry, core, store);
      } catch (err) {
        const pe = err instanceof ProviderError ? err : new ProviderError('upstream', err instanceof Error ? err.message : String(err));
        const status = pe.kind === 'quota' || pe.kind === 'rate_limit' ? 429 : pe.kind === 'upstream' ? 502 : 401;
        json(res, status, { error: { message: pe.message, type: pe.kind === 'auth' ? 'authentication_error' : 'server_error' } });
        return;
      }

      logRequest(path, entry, started.account);
      const inputEstimate = estimateInputTokens(core);

      if (core.stream) {
        res.writeHead(200, {
          'content-type': 'text/event-stream',
          'cache-control': 'no-cache, no-transform',
          connection: 'keep-alive',
        });
        const send = (obj: object) => res.write(`data: ${JSON.stringify(obj)}\n\n`);
        try {
          if (openaiFormat) {
            await streamOpenAI(started.events, core.model, openaiCompletionId(), send, body?.stream_options?.include_usage === true);
          } else {
            await streamAnthropic(started.events, core.model, send, inputEstimate);
          }
        } catch {
          // The stream layer already surfaced the error to the client.
        } finally {
          res.end();
        }
        return;
      }

      const agg = new EventAggregator();
      try {
        for await (const ev of started.events) agg.push(ev);
      } catch (err) {
        const pe = err instanceof ProviderError ? err : new ProviderError('upstream', err instanceof Error ? err.message : String(err));
        json(res, 502, { error: { message: pe.message, type: 'server_error' } });
        return;
      }
      if (openaiFormat) json(res, 200, buildOpenAICompletion(agg.result(), core.model, openaiCompletionId()));
      else json(res, 200, buildAnthropicMessage(agg.result(), core.model));
      return;
    }

    json(res, 404, { error: { message: `No such endpoint: ${method} ${path}` } });
  }

  // ================= admin API =================

  function adminAuthorized(req: IncomingMessage): boolean {
    const password = store.config.adminPassword;
    if (!password) return true;
    const key = req.headers['x-admin-key'];
    return typeof key === 'string' && key === password;
  }

  async function handleAdmin(req: IncomingMessage, res: ServerResponse, method: string, path: string, url: URL): Promise<void> {
    // ---- Kiro device login ----
    if (method === 'POST' && path === '/admin/api/kiro/login') {
      const session = await startDeviceLogin();
      json(res, 200, {
        loginId: session.loginId,
        userCode: session.userCode,
        verificationUri: session.verificationUri,
        verificationUriComplete: session.verificationUriComplete,
      });
      return;
    }
    const kiroLoginMatch = /^\/admin\/api\/kiro\/login\/([\w-]+)$/.exec(path);
    if (method === 'GET' && kiroLoginMatch) {
      const session = getLoginSession(kiroLoginMatch[1]!);
      if (!session) {
        json(res, 404, { error: 'Unknown login session' });
        return;
      }
      const responseAccount = session.account ? sanitizeAccount(session.account) : undefined;
      if (session.state === 'done' && session.account) {
        store.upsertAccount(session.account);
        void refreshAccountQuota(session.account, store).catch(() => {});
        session.account = undefined; // only add once
      }
      json(res, 200, {
        state: session.state,
        error: session.error,
        account: responseAccount,
      });
      return;
    }
    if (method === 'POST' && path === '/admin/api/kiro/import') {
      const body = await readBody(req);
      let token = body?.token;
      if (typeof token === 'string') {
        try {
          token = JSON.parse(token);
        } catch {
          json(res, 400, { error: 'Token is not valid JSON.' });
          return;
        }
      }
      if (!token || typeof token !== 'object') {
        json(res, 400, { error: 'Provide the kiro-auth-token.json contents in `token`.' });
        return;
      }
      const account = await importIdeToken(token as Record<string, unknown>);
      store.upsertAccount(account);
      void refreshAccountQuota(account, store).catch(() => {});
      json(res, 200, sanitizeAccount(account));
      return;
    }

    // ---- Antigravity OAuth ----
    if (method === 'GET' && path === '/admin/api/antigravity/login') {
      const { url: authUrl } = startLogin(publicBase());
      json(res, 200, { url: authUrl });
      return;
    }
    if (method === 'GET' && path === '/admin/api/antigravity/callback') {
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const oauthError = url.searchParams.get('error');
      if (oauthError || !code || !state) {
        res.writeHead(302, { location: `/?login_error=${encodeURIComponent(oauthError ?? 'missing code')}` });
        res.end();
        return;
      }
      try {
        const account = await handleCallback(code, state, publicBase());
        store.upsertAccount(account);
        void refreshAccountQuota(account, store).catch(() => {});
        res.writeHead(302, { location: '/?added=antigravity' });
        res.end();
      } catch (err) {
        res.writeHead(302, { location: `/?login_error=${encodeURIComponent(err instanceof Error ? err.message : String(err))}` });
        res.end();
      }
      return;
    }

    // ---- accounts ----
    if (method === 'GET' && path === '/admin/api/accounts') {
      json(res, 200, { accounts: store.accounts.map(sanitizeAccount) });
      return;
    }
    const accountIdMatch = /^\/admin\/api\/accounts\/([\w-]+)(\/\w+)?$/.exec(path);
    if (accountIdMatch) {
      const account = store.getAccount(accountIdMatch[1]!);
      const action = accountIdMatch[2];
      if (!account) {
        json(res, 404, { error: 'Unknown account' });
        return;
      }
      if (method === 'DELETE' && !action) {
        store.removeAccount(account.id);
        json(res, 200, { ok: true });
        return;
      }
      if (method === 'POST' && action === '/quota') {
        try {
          await refreshAccountQuota(account, store);
        } catch {
          // error already recorded on the account's lastError
        }
        json(res, 200, sanitizeAccount(account));
        return;
      }
      if (method === 'POST' && action === '/refresh-token') {
        try {
          await forceTokenRefresh(account);
          account.status = { state: 'ok' };
          store.markDirty();
          json(res, 200, sanitizeAccount(account));
        } catch (err) {
          account.status = { state: 'expired', lastError: err instanceof Error ? err.message : String(err) };
          store.markDirty();
          json(res, 200, sanitizeAccount(account));
        }
        return;
      }
    }

    // ---- state / keys / settings ----
    if (method === 'GET' && path === '/admin/api/state') {
      json(res, 200, {
        accounts: store.accounts.map(sanitizeAccount),
        models: MODEL_CATALOG,
        config: {
          port: store.config.port,
          host: store.config.host,
          publicBaseUrl: store.config.publicBaseUrl ?? null,
          adminPasswordSet: !!store.config.adminPassword,
          keyCount: store.config.apiKeys.length,
          keys: store.getSanitizedApiKeys(),
        },
      });
      return;
    }
    if (method === 'GET' && path === '/admin/api/keys') {
      json(res, 200, { keys: store.getSanitizedApiKeys() });
      return;
    }
    if (method === 'POST' && path === '/admin/api/keys') {
      const body = await readBody(req);
      const name = typeof body?.name === 'string' && body.name.trim() ? body.name.trim() : 'key';
      const expiresAt = typeof body?.expiresAt === 'number' && body.expiresAt > Date.now() ? body.expiresAt : undefined;
      const { apiKey, key } = store.createApiKey(name, expiresAt);
      json(res, 200, {
        ...sanitizeApiKey(apiKey),
        key,
      });
      return;
    }
    const keyActionMatch = /^\/admin\/api\/keys\/([\w-]+)\/(revoke|activate|unrevoke|toggle)$/.exec(path);
    if (method === 'POST' && keyActionMatch) {
      const idOrKey = decodeURIComponent(keyActionMatch[1]!);
      const action = keyActionMatch[2]!;
      const body = await readBody(req);
      let setRevoked: boolean;
      if (action === 'activate' || action === 'unrevoke') {
        setRevoked = false;
      } else if (action === 'toggle') {
        const existing = store.config.apiKeys.find((k) => k.id === idOrKey || k.key === idOrKey);
        setRevoked = existing ? !existing.revoked : true;
      } else {
        setRevoked = typeof body?.revoked === 'boolean' ? body.revoked : true;
      }
      const updated = store.revokeApiKey(idOrKey, setRevoked);
      if (!updated) {
        json(res, 404, { error: 'Unknown API key' });
        return;
      }
      json(res, 200, { ok: true, key: sanitizeApiKey(updated) });
      return;
    }
    if (method === 'DELETE' && path.startsWith('/admin/api/keys/')) {
      const idOrKey = decodeURIComponent(path.slice('/admin/api/keys/'.length));
      const removed = store.deleteApiKey(idOrKey);
      if (!removed) {
        json(res, 404, { error: 'Unknown API key' });
        return;
      }
      json(res, 200, { ok: true });
      return;
    }
    if (method === 'POST' && path === '/admin/api/settings') {
      const body = await readBody(req);
      let restartNeeded = false;
      if (typeof body?.publicBaseUrl === 'string') store.config.publicBaseUrl = body.publicBaseUrl.trim() || undefined;
      if (typeof body?.adminPassword === 'string') store.config.adminPassword = body.adminPassword.trim() || undefined;
      if (typeof body?.port === 'number' && body.port > 0 && body.port < 65536 && body.port !== store.config.port) {
        store.config.port = body.port;
        restartNeeded = true;
      }
      if (typeof body?.host === 'string' && body.host && body.host !== store.config.host) {
        store.config.host = body.host;
        restartNeeded = true;
      }
      store.saveConfig();
      json(res, 200, { ok: true, restartNeeded });
      return;
    }
    if (method === 'POST' && path === '/admin/api/quota/refresh') {
      refreshAllQuotas(store);
      json(res, 200, { ok: true });
      return;
    }

    // ---- backup & restore ----
    if (method === 'POST' && path === '/admin/api/backup') {
      const body = await readBody(req);
      const passphrase = typeof body?.passphrase === 'string' && body.passphrase ? body.passphrase : undefined;
      const content = createBackup(store, passphrase);
      const stamp = new Date().toISOString().slice(0, 10);
      json(res, 200, {
        filename: `ai-gateway-backup-${stamp}${passphrase ? '.encrypted' : ''}.json`,
        content,
        accountCount: store.accounts.length,
      });
      return;
    }
    if (method === 'POST' && path === '/admin/api/restore') {
      const body = await readBody(req);
      const content = typeof body?.content === 'string' ? body.content : '';
      if (!content.trim()) {
        json(res, 400, { error: 'Provide the backup file contents in `content`.' });
        return;
      }
      const passphrase = typeof body?.passphrase === 'string' && body.passphrase ? body.passphrase : undefined;
      try {
        const result = await restoreBackup(store, content, passphrase);
        json(res, 200, result);
      } catch (err) {
        json(res, 400, { error: err instanceof Error ? err.message : String(err) });
      }
      return;
    }

    json(res, 404, { error: `No such admin endpoint: ${method} ${path}` });
  }

  function publicBase(): string | undefined {
    return store.config.publicBaseUrl ?? `http://localhost:${(server.address() as { port?: number })?.port ?? store.config.port}`;
  }

  function forceTokenRefresh(account: Account): Promise<void> {
    if (account.provider === 'kiro') return kiroForceRefreshToken(account.credentials as never).then(() => undefined);
    return agyForceRefreshToken(account.credentials as never).then(() => undefined);
  }

  function logRequest(path: string, entry: { provider: string; upstream: string }, account: Account) {
    console.log(`[api] ${path} model=${entry.upstream} account=${account.email ?? account.id}`);
  }

  function estimateInputTokens(core: { system?: string; messages: { content: { type: string; text?: string }[] }[] }): number {
    let chars = core.system?.length ?? 0;
    for (const msg of core.messages) {
      for (const block of msg.content) {
        if (block.type === 'text' && block.text) chars += block.text.length;
      }
    }
    return Math.ceil(chars / 4);
  }

  return server;
}

// ---------- helpers ----------

async function readBody(req: IncomingMessage): Promise<any> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY) throw new Error('Request body too large.');
    chunks.push(chunk as Buffer);
  }
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}
