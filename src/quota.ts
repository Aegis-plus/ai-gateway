// Quota checking: refreshes per-account usage from Kiro (getUsageLimits) and
// Antigravity (loadCodeAssist + retrieveUserQuotaSummary), periodically and
// on demand.

import type { Account, AccountQuota, AntigravityCreds } from './types.ts';
import { ProviderError } from './types.ts';
import type { Store } from './store.ts';
import { getUsageLimits } from './auth/kiro.ts';
import { getValidAccessToken, loadCodeAssist, retrieveQuotaSummary } from './auth/antigravity.ts';

const QUOTA_INTERVAL_MS = 10 * 60_000;
const inFlight = new Map<string, Promise<void>>();

export async function refreshAccountQuota(account: Account, store: Store): Promise<void> {
  let p = inFlight.get(account.id);
  if (!p) {
    p = doRefresh(account, store).finally(() => inFlight.delete(account.id));
    inFlight.set(account.id, p);
  }
  await p;
}

async function doRefresh(account: Account, store: Store): Promise<void> {
  try {
    if (account.provider === 'kiro') {
      const limits = await getUsageLimits(account.credentials as never);
      const kiro: NonNullable<AccountQuota['kiro']> = {
        usage: (limits.usageBreakdownList ?? []).map((u) => ({
          resourceType: u.resourceType ?? '',
          currentUsage: u.currentUsage ?? 0,
          usageLimit: u.usageLimit ?? 0,
        })),
        nextDateReset: limits.nextDateReset,
        subscriptionType: limits.subscriptionInfo?.subscriptionType,
      };
      account.quota = { checkedAt: new Date().toISOString(), kiro };
      if (limits.userInfo?.email && !account.email) {
        account.email = limits.userInfo.email;
        account.label = account.email;
      }
    } else {
      const creds = account.credentials as AntigravityCreds;
      const token = await getValidAccessToken(creds);
      const [codeAssist, summary] = await Promise.allSettled([loadCodeAssist(token), retrieveQuotaSummary(token)]);
      const buckets: NonNullable<AccountQuota['antigravity']>['buckets'] = [];
      const groups = summary.status === 'fulfilled' ? summary.value.groups ?? [] : [];

      groups.forEach((group, groupIdx) => {
        const groupLabel = group.displayName ?? group.groupName ?? '';
        for (const bucket of group.buckets ?? []) {
          const rawId = (bucket.bucketId ?? '').toLowerCase();
          const rawName = (bucket.displayName ?? '').toLowerCase();
          const rawGroup = groupLabel.toLowerCase();

          let category: 'gemini' | 'claude_gptoss' | 'general' = 'gemini';
          if (
            rawId.includes('claude') || rawName.includes('claude') ||
            rawId.includes('gpt') || rawName.includes('gpt') ||
            rawId.includes('oss') || rawName.includes('oss') ||
            rawId.includes('partner') || rawId.includes('third_party') ||
            rawGroup.includes('claude') || rawGroup.includes('partner') ||
            rawGroup.includes('third_party') || groupIdx === 1
          ) {
            category = 'claude_gptoss';
          } else if (rawId.includes('gemini') || rawName.includes('gemini') || groupIdx === 0) {
            category = 'gemini';
          }

          buckets.push({
            bucketId: bucket.bucketId ?? '',
            displayName: bucket.displayName ?? bucket.bucketId ?? '',
            remainingFraction: bucket.remainingFraction ?? 1,
            resetTime: bucket.resetTime,
            groupName: groupLabel || undefined,
            category,
          });
        }
      });

      const antigravity: NonNullable<AccountQuota['antigravity']> = {
        buckets,
        tier: codeAssist.status === 'fulfilled' ? (codeAssist.value.currentTier?.id ?? undefined) : undefined,
        credits:
          codeAssist.status === 'fulfilled'
            ? codeAssist.value.paidTier?.availableCredits?.[0]?.creditAmount
            : undefined,
      };
      account.quota = { checkedAt: new Date().toISOString(), antigravity };
      const project =
        codeAssist.status === 'fulfilled'
          ? typeof codeAssist.value.cloudaicompanionProject === 'string'
            ? codeAssist.value.cloudaicompanionProject
            : codeAssist.value.cloudaicompanionProject?.id
          : undefined;
      if (project) account.providerData = { ...account.providerData, projectId: project };
    }
    store.markDirty();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    account.status.lastError = msg;
    if (err instanceof ProviderError && err.kind === 'invalid_grant') {
      account.status.state = 'expired';
    }
    store.markDirty();
    throw err;
  }
}

export function refreshAllQuotas(store: Store) {
  for (const account of store.accounts) {
    void refreshAccountQuota(account, store).catch(() => {});
  }
}

export function startQuotaLoop(store: Store) {
  const timer = setInterval(() => refreshAllQuotas(store), QUOTA_INTERVAL_MS);
  timer.unref();
}
