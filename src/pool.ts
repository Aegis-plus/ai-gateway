// Account pool: healthy-account selection (round-robin), cooldown bookkeeping,
// and the retry/rotation loop used by the API endpoints.

import type { Account, CoreRequest, ProviderId, ProviderEvent } from './types.ts';
import { ProviderError as PE } from './types.ts';
import type { Store } from './store.ts';
import type { ModelEntry } from './models.ts';
import { streamKiro } from './providers/kiro.ts';
import { streamAntigravity } from './providers/antigravity.ts';
import { refreshAccountQuota } from './quota.ts';

const rrIndex: Record<ProviderId, number> = { kiro: 0, antigravity: 0 };

export function accountsFor(store: Store, provider: ProviderId): Account[] {
  return store.accounts.filter((a) => a.provider === provider);
}

function isUsable(a: Account): boolean {
  if (a.status.state === 'expired') return false;
  if (a.status.state === 'cooldown' && (a.status.cooldownUntil ?? 0) > Date.now()) return false;
  return true;
}

/** Ordered candidate list: healthy accounts first (starting at the round-robin cursor). */
function candidates(store: Store, provider: ProviderId): Account[] {
  const all = accountsFor(store, provider);
  const healthy = all.filter(isUsable);
  if (healthy.length > 0) {
    const start = rrIndex[provider] % healthy.length;
    rrIndex[provider] = (rrIndex[provider] + 1) % healthy.length;
    return [...healthy.slice(start), ...healthy.slice(0, start)];
  }
  // Everything is cooling down — surface the account that recovers soonest
  // so requests still have a chance instead of failing outright.
  return [...all]
    .filter((a) => a.status.state !== 'expired')
    .sort((a, b) => (a.status.cooldownUntil ?? 0) - (b.status.cooldownUntil ?? 0))
    .slice(0, 1);
}

function markSuccess(account: Account, store: Store) {
  account.status = { state: 'ok' };
  account.stats.requests += 1;
  account.stats.lastUsedAt = Date.now();
  store.markDirty();
}

export function applyErrorState(account: Account, err: PE, store: Store): void {
  account.stats.errors += 1;
  switch (err.kind) {
    case 'invalid_grant':
      account.status = { state: 'expired', lastError: err.message };
      break;
    case 'quota': {
      let until = err.cooldownMs ? Date.now() + err.cooldownMs : Date.now() + 3600_000;
      const resetS = account.quota?.kiro?.nextDateReset;
      if (resetS && resetS * 1000 > Date.now() && resetS * 1000 < Date.now() + 45 * 24 * 3600_000) {
        until = resetS * 1000;
      }
      account.status = { state: 'cooldown', cooldownUntil: until, lastError: err.message };
      break;
    }
    case 'rate_limit':
      account.status = { state: 'cooldown', cooldownUntil: Date.now() + (err.cooldownMs ?? 60_000), lastError: err.message };
      break;
    case 'auth':
      account.status = { state: 'cooldown', cooldownUntil: Date.now() + 60_000, lastError: err.message };
      break;
    default:
      account.status = { state: 'cooldown', cooldownUntil: Date.now() + 30_000, lastError: err.message };
  }
  store.markDirty();
}

export interface StartedStream {
  account: Account;
  events: AsyncGenerator<ProviderEvent>;
}

/**
 * Try accounts in rotation order. Only errors thrown before the first event
 * rotate to the next account; once bytes are flowing the stream is committed.
 * The returned generator applies account status updates as it drains.
 */
export async function startStreamWithRotation(
  entry: ModelEntry,
  req: CoreRequest,
  store: Store,
): Promise<StartedStream> {
  const tried = new Set<string>();
  let lastError: PE = new PE('upstream', 'No accounts available for this provider — add one in the dashboard.');

  while (true) {
    const account = candidates(store, entry.provider).find((a) => !tried.has(a.id));
    if (!account) break;
    tried.add(account.id);

    const makeIterator = (): AsyncGenerator<ProviderEvent> =>
      entry.provider === 'kiro'
        ? streamKiro(req, entry.upstream, account.credentials as never)
        : streamAntigravity(req, entry.upstream, account);

    let iterator = makeIterator();
    let first: IteratorResult<ProviderEvent, undefined>;
    try {
      first = await iterator.next();
    } catch (err) {
      const pe = asProviderError(err);
      if (pe.kind === 'auth') {
        // Token refresh already ran inside the provider; retry the same
        // account once with the fresh token before rotating.
        try {
          iterator = makeIterator();
          first = await iterator.next();
        } catch (err2) {
          const pe2 = asProviderError(err2);
          applyErrorState(account, pe2, store);
          lastError = pe2;
          continue;
        }
      } else {
        applyErrorState(account, pe, store);
        lastError = pe;
        if (pe.kind === 'quota' || pe.kind === 'rate_limit') {
          void refreshAccountQuota(account, store).catch(() => {});
        }
        continue;
      }
    }

    markSuccess(account, store);

    // Re-bind so the closure below keeps the non-undefined narrowing.
    const active: Account = account;

    async function* drain(): AsyncGenerator<ProviderEvent> {
      try {
        if (!first.done) yield first.value;
        while (true) {
          const { done, value } = await iterator.next();
          if (done) break;
          yield value;
        }
      } catch (err) {
        const pe = asProviderError(err);
        applyErrorState(active, pe, store);
        throw pe;
      }
    }

    return { account: active, events: drain() };
  }
  throw lastError;
}

function asProviderError(err: unknown): PE {
  if (err instanceof PE) return err;
  return new PE('upstream', err instanceof Error ? err.message : String(err));
}
