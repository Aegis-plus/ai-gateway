// Account backup & restore.
//
// A backup is a JSON document containing full account objects (including
// refresh tokens — treat it like a password). With a passphrase it is
// encrypted with AES-256-GCM (scrypt-derived key). Restore merges accounts,
// skipping ones that already exist (same provider+email, or same refresh
// token for anonymous accounts).

import { createCipheriv, createDecipheriv, randomBytes, randomUUID, scryptSync } from 'node:crypto';
import type { Account, ProviderId } from './types.ts';
import type { Store } from './store.ts';
import { refreshAccountQuota } from './quota.ts';

const FORMAT = 'ai-gateway-backup';
const VERSION = 1;

interface BackupEnvelope {
  format: string;
  version: number;
  encrypted: boolean;
  createdAt: string;
  accountCount?: number;
  accounts?: Account[];
  kdf?: string;
  salt?: string;
  iv?: string;
  authTag?: string;
  data?: string;
}

export function createBackup(store: Store, passphrase?: string): string {
  const payload: BackupEnvelope = {
    format: FORMAT,
    version: VERSION,
    encrypted: false,
    createdAt: new Date().toISOString(),
    accounts: store.accounts,
  };
  if (!passphrase) return JSON.stringify(payload, null, 2);

  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = scryptSync(passphrase, salt, 32);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const plaintext = JSON.stringify(payload);
  const data = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const envelope: BackupEnvelope = {
    format: FORMAT,
    version: VERSION,
    encrypted: true,
    createdAt: payload.createdAt,
    accountCount: store.accounts.length,
    kdf: 'scrypt',
    salt: salt.toString('hex'),
    iv: iv.toString('hex'),
    authTag: cipher.getAuthTag().toString('hex'),
    data: data.toString('base64'),
  };
  return JSON.stringify(envelope, null, 2);
}

export interface RestoreResult {
  added: { provider: ProviderId; email?: string }[];
  skipped: { provider: ProviderId; email?: string; reason: string }[];
  errors: string[];
}

export async function restoreBackup(store: Store, text: string, passphrase?: string): Promise<RestoreResult> {
  const result: RestoreResult = { added: [], skipped: [], errors: [] };

  let envelope: BackupEnvelope;
  try {
    envelope = JSON.parse(text) as BackupEnvelope;
  } catch {
    throw new Error('Backup file is not valid JSON.');
  }
  if (envelope.format !== FORMAT || typeof envelope.version !== 'number') {
    throw new Error('This file is not an AI Gateway backup.');
  }

  let payload: BackupEnvelope;
  if (envelope.encrypted) {
    if (!passphrase) throw new Error('This backup is encrypted — enter its passphrase.');
    if (!envelope.salt || !envelope.iv || !envelope.authTag || !envelope.data) {
      throw new Error('Encrypted backup is missing fields.');
    }
    try {
      const key = scryptSync(passphrase, Buffer.from(envelope.salt, 'hex'), 32);
      const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(envelope.iv, 'hex'));
      decipher.setAuthTag(Buffer.from(envelope.authTag, 'hex'));
      const plain = Buffer.concat([
        decipher.update(Buffer.from(envelope.data, 'base64')),
        decipher.final(),
      ]).toString('utf8');
      payload = JSON.parse(plain) as BackupEnvelope;
    } catch {
      throw new Error('Wrong passphrase or corrupted backup.');
    }
  } else {
    payload = envelope;
  }

  if (!Array.isArray(payload.accounts)) {
    throw new Error('Backup contains no account list.');
  }

  for (const raw of payload.accounts) {
    const issues = validateAccount(raw);
    if (issues) {
      result.errors.push(issues);
      continue;
    }
    const account = raw as Account;
    const dupe = store.accounts.find(
      (existing) =>
        existing.provider === account.provider &&
        ((account.email && existing.email === account.email) ||
          existing.credentials.refreshToken === account.credentials.refreshToken),
    );
    if (dupe) {
      result.skipped.push({
        provider: account.provider,
        email: account.email,
        reason: dupe.email === account.email ? 'same email already present' : 'same token already present',
      });
      continue;
    }

    const restored: Account = {
      ...account,
      id: randomUUID(), // never collide with an existing id
      createdAt: Date.now(),
      status: { state: 'ok' },
      stats: { requests: 0, errors: 0 },
    };
    store.upsertAccount(restored);
    result.added.push({ provider: restored.provider, email: restored.email });
    void refreshAccountQuota(restored, store).catch(() => {});
  }

  return result;
}

function validateAccount(raw: unknown): string | undefined {
  if (!raw || typeof raw !== 'object') return 'Skipping malformed account entry.';
  const a = raw as Partial<Account>;
  if (a.provider !== 'kiro' && a.provider !== 'antigravity') return 'Skipping account with unknown provider.';
  const creds = a.credentials as { kind?: string; accessToken?: string; refreshToken?: string } | undefined;
  if (!creds || typeof creds !== 'object') return `Skipping ${a.provider} account without credentials.`;
  if (a.provider === 'kiro' && creds.kind !== 'oidc' && creds.kind !== 'desktop') {
    return 'Skipping kiro account with unknown credential kind.';
  }
  if (a.provider === 'antigravity' && creds.kind !== 'antigravity') {
    return 'Skipping antigravity account with unknown credential kind.';
  }
  if (typeof creds.refreshToken !== 'string' || !creds.refreshToken) return 'Skipping account without a refresh token.';
  return undefined;
}
