import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Server } from 'node:http';
import { Store } from '../src/store.ts';
import { createGatewayServer } from '../src/server.ts';
import { sanitizeApiKey, type ApiKey, type SanitizedApiKey } from '../src/types.ts';

describe('API Key Management', () => {
  let tmpDir: string;
  let store: Store;
  let server: Server;
  let baseUrl: string;

  beforeEach(async () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'ai-gw-test-'));
    store = new Store(tmpDir);
    server = createGatewayServer(store);
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address() as { port: number };
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    try {
      rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  });

  it('creates an API key with sk-gw- prefix, unique id, and initial stats', () => {
    const { apiKey, key } = store.createApiKey('test-cursor');
    expect(key).toMatch(/^sk-gw-[a-f0-9]+$/);
    expect(apiKey.id).toMatch(/^key_[a-f0-9]+$/);
    expect(apiKey.name).toBe('test-cursor');
    expect(apiKey.revoked).toBe(false);
    expect(apiKey.requests).toBe(0);
    expect(apiKey.createdAt).toBeGreaterThan(0);

    const keys = store.getApiKeys();
    expect(keys).toHaveLength(1);
    expect(keys[0]!.id).toBe(apiKey.id);
  });

  it('sanitizes keys by masking secret while preserving id and metadata', () => {
    const rawKey: ApiKey = {
      id: 'key_123456',
      key: 'sk-gw-1234567890abcdef1234567890abcdef',
      name: 'prod-agent',
      createdAt: 1700000000000,
      lastUsedAt: 1700000050000,
      requests: 42,
      revoked: false,
    };

    const sanitized = sanitizeApiKey(rawKey);
    expect(sanitized.id).toBe('key_123456');
    expect(sanitized.name).toBe('prod-agent');
    expect(sanitized.keyPreview).toBe('sk-gw-1234...cdef');
    expect((sanitized as any).key).toBeUndefined();
    expect(sanitized.requests).toBe(42);
    expect(sanitized.revoked).toBe(false);
  });

  it('revokes and reactivates an API key', () => {
    const { apiKey } = store.createApiKey('agent-key');
    expect(apiKey.revoked).toBe(false);

    // Revoke
    const revoked = store.revokeApiKey(apiKey.id, true);
    expect(revoked).toBeDefined();
    expect(revoked!.revoked).toBe(true);

    const list1 = store.getSanitizedApiKeys();
    expect(list1[0]!.revoked).toBe(true);

    // Reactivate
    const reactivated = store.revokeApiKey(apiKey.id, false);
    expect(reactivated).toBeDefined();
    expect(reactivated!.revoked).toBe(false);

    const list2 = store.getSanitizedApiKeys();
    expect(list2[0]!.revoked).toBe(false);
  });

  it('deletes an API key by id or raw key', () => {
    const key1 = store.createApiKey('key-one');
    const key2 = store.createApiKey('key-two');
    expect(store.getApiKeys()).toHaveLength(2);

    // Delete by id
    const deleted1 = store.deleteApiKey(key1.apiKey.id);
    expect(deleted1).toBe(true);
    expect(store.getApiKeys()).toHaveLength(1);

    // Delete by raw key
    const deleted2 = store.deleteApiKey(key2.key);
    expect(deleted2).toBe(true);
    expect(store.getApiKeys()).toHaveLength(0);

    // Deleting non-existent key returns false
    expect(store.deleteApiKey('unknown-id')).toBe(false);
  });

  it('records key usage and tracks request counts and lastUsedAt timestamp', () => {
    const { key, apiKey } = store.createApiKey('worker');
    expect(apiKey.requests).toBe(0);
    expect(apiKey.lastUsedAt).toBeUndefined();

    store.recordApiKeyUsage(key);
    const updated = store.getApiKeys().find((k) => k.id === apiKey.id);
    expect(updated!.requests).toBe(1);
    expect(updated!.lastUsedAt).toBeGreaterThan(0);

    store.recordApiKeyUsage(key);
    expect(updated!.requests).toBe(2);
  });

  it('enforces authentication via HTTP endpoints', async () => {
    const { key, apiKey } = store.createApiKey('http-test');

    // 1. Missing Authorization header -> 401
    const unauth = await fetch(`${baseUrl}/v1/models`);
    expect(unauth.status).toBe(401);

    // 2. Valid Authorization header -> 200
    const authRes = await fetch(`${baseUrl}/v1/models`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    expect(authRes.status).toBe(200);

    // Verify usage recorded
    const keyAfter = store.getApiKeys().find((k) => k.id === apiKey.id);
    expect(keyAfter!.requests).toBe(1);
    expect(keyAfter!.lastUsedAt).toBeGreaterThan(0);

    // 3. Revoked key -> 401
    store.revokeApiKey(apiKey.id, true);
    const revokedRes = await fetch(`${baseUrl}/v1/models`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    expect(revokedRes.status).toBe(401);

    // 4. Reactivated key -> 200
    store.revokeApiKey(apiKey.id, false);
    const reactivatedRes = await fetch(`${baseUrl}/v1/models`, {
      headers: { 'X-API-Key': key },
    });
    expect(reactivatedRes.status).toBe(200);
  });

  it('provides full Admin REST API for listing, creating, revoking, and deleting keys', async () => {
    // 1. List keys initially empty
    const listRes1 = await fetch(`${baseUrl}/admin/api/keys`);
    const list1 = (await listRes1.json()) as { keys: SanitizedApiKey[] };
    expect(list1.keys).toHaveLength(0);

    // 2. Create key via Admin API
    const createRes = await fetch(`${baseUrl}/admin/api/keys`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'cursor-laptop' }),
    });
    expect(createRes.status).toBe(200);
    const created = (await createRes.json()) as SanitizedApiKey & { key: string };
    expect(created.name).toBe('cursor-laptop');
    expect(created.key).toMatch(/^sk-gw-/);
    expect(created.id).toMatch(/^key_/);
    expect(created.keyPreview).toBeDefined();

    // 3. List keys has 1 key
    const listRes2 = await fetch(`${baseUrl}/admin/api/keys`);
    const list2 = (await listRes2.json()) as { keys: SanitizedApiKey[] };
    expect(list2.keys).toHaveLength(1);
    expect(list2.keys[0]!.id).toBe(created.id);

    // 4. Revoke key via Admin API
    const revokeRes = await fetch(`${baseUrl}/admin/api/keys/${created.id}/revoke`, {
      method: 'POST',
    });
    expect(revokeRes.status).toBe(200);
    const revokedData = (await revokeRes.json()) as { ok: boolean; key: SanitizedApiKey };
    expect(revokedData.ok).toBe(true);
    expect(revokedData.key.revoked).toBe(true);

    // 5. Reactivate key via Admin API
    const activateRes = await fetch(`${baseUrl}/admin/api/keys/${created.id}/activate`, {
      method: 'POST',
    });
    expect(activateRes.status).toBe(200);
    const actData = (await activateRes.json()) as { ok: boolean; key: SanitizedApiKey };
    expect(actData.key.revoked).toBe(false);

    // 6. Delete key via Admin API
    const delRes = await fetch(`${baseUrl}/admin/api/keys/${created.id}`, {
      method: 'DELETE',
    });
    expect(delRes.status).toBe(200);
    const delData = (await delRes.json()) as { ok: boolean };
    expect(delData.ok).toBe(true);

    // 7. List is empty again
    const listRes3 = await fetch(`${baseUrl}/admin/api/keys`);
    const list3 = (await listRes3.json()) as { keys: SanitizedApiKey[] };
    expect(list3.keys).toHaveLength(0);
  });
});
