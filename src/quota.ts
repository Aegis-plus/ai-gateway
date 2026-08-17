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
      try {
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
        account.status.lastError = undefined;
      } catch (err) {
        account.quota = {
          checkedAt: new Date().toISOString(),
          kiro: account.quota?.kiro || { usage: [] },
        };
        // Quota check is best-effort telemetry; only set lastError if account state is not ok
        if (account.status.state === 'ok') {
          account.status.lastError = undefined;
        } else {
          account.status.lastError = err instanceof Error ? err.message : String(err);
        }
      }
    } else {
      const creds = account.credentials as AntigravityCreds;
      const token = await getValidAccessToken(creds);
      const [codeAssist, summary] = await Promise.allSettled([loadCodeAssist(token), retrieveQuotaSummary(token)]);
      const buckets: NonNullable<AccountQuota['antigravity']>['buckets'] = [];
      const groups = summary.status === 'fulfilled' ? summary.value.groups ?? [] : [];

      groups.forEach((group, groupIdx) => {
        const groupLabel = group.displayName ?? group.groupName ?? '';
        const groupBuckets = group.buckets ?? [];

        groupBuckets.forEach((bucket, bIdx) => {
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
            rawGroup.includes('third_party')
          ) {
            category = 'claude_gptoss';
          } else if (rawId.includes('gemini') || rawName.includes('gemini') || rawGroup.includes('gemini')) {
            category = 'gemini';
          } else if (groups.length > 1) {
            category = groupIdx === 0 ? 'gemini' : 'claude_gptoss';
          } else if (groupBuckets.length >= 4) {
            category = bIdx < 2 ? 'gemini' : 'claude_gptoss';
          }

          // Format clean descriptive name
          let cleanName = bucket.displayName ?? bucket.bucketId ?? 'Quota Limit';
          if (cleanName.toLowerCase().includes('5-hour') || cleanName.toLowerCase().includes('5 hour')) {
            cleanName = '⏱ Rolling 5-Hour Limit';
          } else if (cleanName.toLowerCase().includes('week')) {
            cleanName = '📅 Weekly Limit';
          } else if (cleanName.toLowerCase().includes('day') || cleanName.toLowerCase().includes('daily')) {
            cleanName = '🕒 Daily Limit';
          }

          buckets.push({
            bucketId: bucket.bucketId ?? '',
            displayName: cleanName,
            remainingFraction: bucket.remainingFraction ?? 1,
            resetTime: bucket.resetTime,
            groupName: groupLabel || undefined,
            category,
          });
        });
      });

      const ca = codeAssist.status === 'fulfilled' ? codeAssist.value : undefined;
      const activeTier = ca?.paidTier?.id ?? ca?.currentTier?.id ?? ca?.allowedTiers?.find((t) => t.isDefault)?.id ?? ca?.allowedTiers?.[0]?.id;

      const antigravity: NonNullable<AccountQuota['antigravity']> = {
        buckets,
        tier: activeTier,
        credits: ca?.paidTier?.availableCredits?.[0]?.creditAmount,
      };
      account.quota = { checkedAt: new Date().toISOString(), antigravity };
      const project =
        ca
          ? typeof ca.cloudaicompanionProject === 'string'
            ? ca.cloudaicompanionProject
            : ca.cloudaicompanionProject?.id
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
