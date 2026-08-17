// JSON file persistence with atomic writes and restrictive permissions.
// State is intentionally simple: two files under data/.

import { mkdirSync, readFileSync, renameSync, writeFileSync, chmodSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import type { Account, Config } from './types.ts';

export interface GatewayState {
  config: Config;
  accounts: Account[];
}

const DEFAULT_CONFIG: Config = {
  port: 8787,
  host: '127.0.0.1',
  apiKeys: [],
};

export class Store {
  private configPath: string;
  private accountsPath: string;
  config: Config;
  accounts: Account[];
  private saveTimer: NodeJS.Timeout | undefined;
  private dirty = false;

  constructor(dataDir: string) {
    mkdirSync(dataDir, { recursive: true });
    this.configPath = join(dataDir, 'config.json');
    this.accountsPath = join(dataDir, 'accounts.json');
    this.config = this.loadJson(this.configPath, DEFAULT_CONFIG);
    // Merge defaults for fields added in newer versions.
    this.config = { ...DEFAULT_CONFIG, ...this.config };
    this.accounts = this.loadJson<Account[]>(this.accountsPath, []);
    // Stagger periodic saves so token refreshes don't write on every tick.
    this.saveTimer = setInterval(() => this.flush(), 5_000);
    this.saveTimer.unref();
  }

  private loadJson<T>(path: string, fallback: T): T {
    try {
      if (!existsSync(path)) return fallback;
      return JSON.parse(readFileSync(path, 'utf8')) as T;
    } catch (err) {
      console.error(`[store] failed to parse ${path}, starting fresh:`, err);
      return fallback;
    }
  }

  private atomicWrite(path: string, data: string) {
    const tmp = join(dirname(path), `.${Math.random().toString(36).slice(2)}.tmp`);
    writeFileSync(tmp, data, { encoding: 'utf8', mode: 0o600 });
    chmodSync(tmp, 0o600);
    renameSync(tmp, path);
  }

  markDirty() {
    this.dirty = true;
  }

  flush() {
    if (!this.dirty) return;
    this.dirty = false;
    try {
      this.atomicWrite(this.accountsPath, JSON.stringify(this.accounts, null, 2));
    } catch (err) {
      console.error('[store] failed to save accounts:', err);
      this.dirty = true;
    }
  }

  saveConfig() {
    this.atomicWrite(this.configPath, JSON.stringify(this.config, null, 2));
  }

  saveAccounts() {
    this.atomicWrite(this.accountsPath, JSON.stringify(this.accounts, null, 2));
  }

  upsertAccount(account: Account) {
    const idx = this.accounts.findIndex((a) => a.id === account.id);
    if (idx >= 0) this.accounts[idx] = account;
    else this.accounts.push(account);
    this.markDirty();
    this.flush();
  }

  removeAccount(id: string): boolean {
    const before = this.accounts.length;
    this.accounts = this.accounts.filter((a) => a.id !== id);
    const removed = this.accounts.length < before;
    if (removed) {
      this.markDirty();
      this.flush();
    }
    return removed;
  }

  getAccount(id: string): Account | undefined {
    return this.accounts.find((a) => a.id === id);
  }
}
