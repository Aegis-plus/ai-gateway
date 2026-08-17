import { describe, expect, it, vi } from 'vitest';
import { createBackup, restoreBackup } from '../src/backup.ts';
import { Store } from '../src/store.ts';
import type { Account } from '../src/types.ts';

// Keep quota refresh from hitting the network in these tests.
vi.mock('../src/quota.ts', () => ({
  refreshAccountQuota: vi.fn(async () => {}),
  refreshAllQuotas: vi.fn(),
  startQuotaLoop: vi.fn(),
}));

function fakeAccount(email: string): Account {
  return {
    id: `id-${email}`,
    provider: 'antigravity',
    email,
    label: email,
    createdAt: 123,
    credentials: {
      kind: 'antigravity',
      accessToken: `at-${email}`,
      refreshToken: `rt-${email}`,
      expiresAt: 1, // long expired — restore must not care
      scope: 'cloud-platform',
    },
    status: { state: 'cooldown', cooldownUntil: 9999999999999, lastError: 'old' },
    stats: { requests: 42, errors: 7 },
    providerData: { projectId: 'proj-1' },
  };
}

function tempStore(accounts: Account[] = []): Store {
  const store = new Store(`/tmp/gw-test-${Math.random().toString(36).slice(2)}`);
  store.accounts = accounts;
  return store;
}

describe('backup round-trip', () => {
  it('round-trips plain backups and resets transient state', async () => {
    const store = tempStore([fakeAccount('a@x.com'), fakeAccount('b@x.com')]);
    const backupText = createBackup(store);

    const target = tempStore();
    const result = await restoreBackup(target, backupText);
    expect(result.added).toHaveLength(2);
    expect(result.errors).toEqual([]);
    expect(target.accounts).toHaveLength(2);

    const restored = target.accounts.find((a) => a.email === 'a@x.com')!;
    expect(restored.credentials).toMatchObject({ refreshToken: 'rt-a@x.com' });
    expect(restored.providerData?.projectId).toBe('proj-1');
    // Cooldowns and stats must not survive a restore.
    expect(restored.status).toEqual({ state: 'ok' });
    expect(restored.stats).toEqual({ requests: 0, errors: 0 });
    expect(restored.id).not.toBe('id-a@x.com'); // ids are regenerated
  });

  it('skips duplicates by email and by refresh token', async () => {
    const store = tempStore([fakeAccount('a@x.com')]);
    const backupText = createBackup(store);

    const target = tempStore([fakeAccount('a@x.com'), { ...fakeAccount('b@x.com'), email: undefined }]);
    const result = await restoreBackup(target, backupText);
    expect(result.added).toHaveLength(0);
    expect(result.skipped).toHaveLength(1);
    expect(target.accounts).toHaveLength(2);
  });

  it('encrypts with a passphrase and rejects the wrong one', async () => {
    const store = tempStore([fakeAccount('a@x.com')]);
    const encrypted = createBackup(store, 'hunter2');
    const envelope = JSON.parse(encrypted);
    expect(envelope.encrypted).toBe(true);
    expect(envelope.data).not.toContain('rt-a@x.com');

    const target = tempStore();
    await expect(restoreBackup(target, encrypted, 'wrong')).rejects.toThrow(/passphrase|corrupted/i);
    await expect(restoreBackup(target, encrypted)).rejects.toThrow(/passphrase/i);

    const ok = await restoreBackup(target, encrypted, 'hunter2');
    expect(ok.added).toHaveLength(1);
  });

  it('detects tampering with encrypted backups', async () => {
    const store = tempStore([fakeAccount('a@x.com')]);
    const encrypted = createBackup(store, 'pw');
    const envelope = JSON.parse(encrypted);
    const bytes = Buffer.from(envelope.data, 'base64');
    bytes[0] = (bytes[0] ?? 0) ^ 0xff;
    envelope.data = Buffer.from(bytes).toString('base64');
    await expect(restoreBackup(tempStore(), JSON.stringify(envelope), 'pw')).rejects.toThrow(/passphrase|corrupted/i);
  });

  it('rejects foreign files and malformed entries', async () => {
    await expect(restoreBackup(tempStore(), '{"hello":1}')).rejects.toThrow(/not an AI Gateway backup/i);
    const bogus = JSON.stringify({
      format: 'ai-gateway-backup',
      version: 1,
      encrypted: false,
      accounts: [{ provider: 'openai' }, { provider: 'kiro', credentials: { kind: 'oidc' } }],
    });
    const result = await restoreBackup(tempStore(), bogus);
    expect(result.added).toHaveLength(0);
    expect(result.errors).toHaveLength(2);
  });
});
