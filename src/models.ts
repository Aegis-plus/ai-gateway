// Model catalog for Kiro and Google Antigravity.
// Models are publicly exposed with their provider prefixes:
// - Kiro models: "kiro/{modelid}"
// - Antigravity models: "agy/{modelid}"
//
// Unprefixed model names and "antigravity/..." prefixes are also supported
// transparently by resolveModel().

import type { ProviderId } from './types.ts';

export interface ModelEntry {
  id: string; // public model id served by the gateway (e.g. "kiro/...", "agy/...")
  provider: ProviderId;
  upstream: string; // exact model id sent to the upstream provider
  description?: string;
}

export const MODEL_CATALOG: ModelEntry[] = [
  // =========================================================================
  // Kiro (AWS CodeWhisperer / Q Developer Runtime) -> kiro/{modelid}
  // Free Tier Models (Included in Kiro Free Plan):
  // - Claude Sonnet 4.5 / Haiku 4.5
  // - Open-Weight: DeepSeek 3.2, Qwen3 Coder Next, MiniMax M2.5/M2.1, GLM-5
  // - Auto Routing
  // =========================================================================

  // ---- Anthropic Claude (Kiro Free Tier) ----
  { id: 'kiro/claude-sonnet-4.5', provider: 'kiro', upstream: 'claude-sonnet-4.5', description: 'Kiro · Claude Sonnet 4.5' },
  { id: 'kiro/claude-sonnet-4.5-thinking', provider: 'kiro', upstream: 'claude-sonnet-4.5-thinking', description: 'Kiro · Claude Sonnet 4.5 (Thinking)' },
  { id: 'kiro/claude-sonnet-4.5-agentic', provider: 'kiro', upstream: 'claude-sonnet-4.5-agentic', description: 'Kiro · Claude Sonnet 4.5 (Agentic)' },
  { id: 'kiro/claude-sonnet-4-5', provider: 'kiro', upstream: 'claude-sonnet-4.5', description: 'Kiro · Claude Sonnet 4.5' },
  { id: 'kiro/claude-sonnet-4-5-20250929', provider: 'kiro', upstream: 'claude-sonnet-4.5', description: 'Kiro · Claude Sonnet 4.5' },
  { id: 'kiro/claude-sonnet-4', provider: 'kiro', upstream: 'claude-sonnet-4.5', description: 'Kiro · Claude Sonnet 4' },
  { id: 'kiro/claude-haiku-4.5', provider: 'kiro', upstream: 'claude-haiku-4.5', description: 'Kiro · Claude Haiku 4.5' },
  { id: 'kiro/claude-haiku-4-5', provider: 'kiro', upstream: 'claude-haiku-4.5', description: 'Kiro · Claude Haiku 4.5' },
  { id: 'kiro/claude-3-7-sonnet', provider: 'kiro', upstream: 'claude-sonnet-4.5', description: 'Kiro · Claude 3.7 Sonnet' },
  { id: 'kiro/claude-3.7-sonnet', provider: 'kiro', upstream: 'claude-sonnet-4.5', description: 'Kiro · Claude 3.7 Sonnet' },
  { id: 'kiro/claude-3-7-sonnet-thinking', provider: 'kiro', upstream: 'claude-sonnet-4.5-thinking', description: 'Kiro · Claude 3.7 Sonnet (Thinking)' },
  { id: 'kiro/claude-3.7-sonnet-thinking', provider: 'kiro', upstream: 'claude-sonnet-4.5-thinking', description: 'Kiro · Claude 3.7 Sonnet (Thinking)' },
  { id: 'kiro/claude-3-5-sonnet', provider: 'kiro', upstream: 'claude-sonnet-4.5', description: 'Kiro · Claude 3.5 Sonnet' },
  { id: 'kiro/claude-3.5-sonnet', provider: 'kiro', upstream: 'claude-sonnet-4.5', description: 'Kiro · Claude 3.5 Sonnet' },
  { id: 'kiro/claude-3-5-haiku', provider: 'kiro', upstream: 'claude-haiku-4.5', description: 'Kiro · Claude 3.5 Haiku' },
  { id: 'kiro/claude-3.5-haiku', provider: 'kiro', upstream: 'claude-haiku-4.5', description: 'Kiro · Claude 3.5 Haiku' },

  // ---- Open-Weight Models (Kiro Free Tier) ----
  { id: 'kiro/deepseek-3.2', provider: 'kiro', upstream: 'deepseek-3.2', description: 'Kiro · DeepSeek 3.2 (text only)' },
  { id: 'kiro/deepseek-v3', provider: 'kiro', upstream: 'deepseek-3.2', description: 'Kiro · DeepSeek V3' },
  { id: 'kiro/deepseek-r1', provider: 'kiro', upstream: 'claude-sonnet-4.5-thinking', description: 'Kiro · DeepSeek R1 (Thinking)' },
  { id: 'kiro/deepseek-coder', provider: 'kiro', upstream: 'deepseek-3.2', description: 'Kiro · DeepSeek Coder' },
  { id: 'kiro/qwen3-coder-next', provider: 'kiro', upstream: 'qwen3-coder-next', description: 'Kiro · Qwen3 Coder Next (text only)' },
  { id: 'kiro/qwen-2.5-coder-32b', provider: 'kiro', upstream: 'qwen3-coder-next', description: 'Kiro · Qwen 2.5 Coder 32B' },
  { id: 'kiro/qwen-2.5-coder', provider: 'kiro', upstream: 'qwen3-coder-next', description: 'Kiro · Qwen 2.5 Coder' },
  { id: 'kiro/glm-5', provider: 'kiro', upstream: 'glm-5', description: 'Kiro · GLM 5' },
  { id: 'kiro/glm-4-plus', provider: 'kiro', upstream: 'glm-5', description: 'Kiro · GLM 4 Plus' },
  { id: 'kiro/minimax-m2.5', provider: 'kiro', upstream: 'MiniMax-M2.5', description: 'Kiro · MiniMax M2.5' },
  { id: 'kiro/minimax-m2.1', provider: 'kiro', upstream: 'MiniMax-M2.5', description: 'Kiro · MiniMax M2.1' },
  { id: 'kiro/minimax-01', provider: 'kiro', upstream: 'MiniMax-M2.5', description: 'Kiro · MiniMax 01' },
  { id: 'kiro/auto', provider: 'kiro', upstream: 'auto', description: 'Kiro · Auto Routing' },

  // =========================================================================
  // Google Antigravity (Cloud Code Runtime) -> agy/{modelid}
  // Available Models & Thinking Tiers:
  // - Gemini 3.x Series (3.7 Flash, 3.6 Flash, 3.5 Flash, 3.1 Pro, 3.1 Flash Lite, 3 Pro, 3 Flash)
  // - Claude 4.6 (Sonnet & Opus Thinking)
  // - GPT-OSS 120b (Medium)
  // =========================================================================

  // ---- Gemini 3.7 Flash ----
  { id: 'agy/gemini-3.7-flash', provider: 'antigravity', upstream: 'gemini-3.6-flash-high', description: 'Antigravity · Gemini 3.7 Flash (High Thinking)' },
  { id: 'agy/gemini-3.7-flash-high', provider: 'antigravity', upstream: 'gemini-3.6-flash-high', description: 'Antigravity · Gemini 3.7 Flash (High Thinking)' },
  { id: 'agy/gemini-3.7-flash-thinking', provider: 'antigravity', upstream: 'gemini-3.6-flash-high', description: 'Antigravity · Gemini 3.7 Flash (Thinking)' },
  { id: 'agy/gemini-3.7-flash-medium', provider: 'antigravity', upstream: 'gemini-3.6-flash-medium', description: 'Antigravity · Gemini 3.7 Flash (Medium Thinking)' },
  { id: 'agy/gemini-3.7-flash-low', provider: 'antigravity', upstream: 'gemini-3.6-flash-low', description: 'Antigravity · Gemini 3.7 Flash (Low Thinking)' },

  // ---- Gemini 3.6 Flash ----
  { id: 'agy/gemini-3.6-flash', provider: 'antigravity', upstream: 'gemini-3.6-flash-high', description: 'Antigravity · Gemini 3.6 Flash' },
  { id: 'agy/gemini-3.6-flash-high', provider: 'antigravity', upstream: 'gemini-3.6-flash-high', description: 'Antigravity · Gemini 3.6 Flash (high)' },
  { id: 'agy/gemini-3.6-flash-thinking', provider: 'antigravity', upstream: 'gemini-3.6-flash-high', description: 'Antigravity · Gemini 3.6 Flash (thinking)' },
  { id: 'agy/gemini-3.6-flash-medium', provider: 'antigravity', upstream: 'gemini-3.6-flash-medium', description: 'Antigravity · Gemini 3.6 Flash (medium)' },
  { id: 'agy/gemini-3.6-flash-low', provider: 'antigravity', upstream: 'gemini-3.6-flash-low', description: 'Antigravity · Gemini 3.6 Flash (low)' },

  // ---- Gemini 3.5 Flash ----
  { id: 'agy/gemini-3.5-flash', provider: 'antigravity', upstream: 'gemini-3-flash-agent', description: 'Antigravity · Gemini 3.5 Flash' },
  { id: 'agy/gemini-3.5-flash-high', provider: 'antigravity', upstream: 'gemini-3-flash-agent', description: 'Antigravity · Gemini 3.5 Flash (high)' },
  { id: 'agy/gemini-3.5-flash-thinking', provider: 'antigravity', upstream: 'gemini-3-flash-agent', description: 'Antigravity · Gemini 3.5 Flash (thinking)' },
  { id: 'agy/gemini-3.5-flash-medium', provider: 'antigravity', upstream: 'gemini-3.5-flash-low', description: 'Antigravity · Gemini 3.5 Flash (medium)' },
  { id: 'agy/gemini-3.5-flash-low', provider: 'antigravity', upstream: 'gemini-3.5-flash-extra-low', description: 'Antigravity · Gemini 3.5 Flash (low)' },

  // ---- Gemini 3.1 Pro ----
  { id: 'agy/gemini-3.1-pro', provider: 'antigravity', upstream: 'gemini-pro-agent', description: 'Antigravity · Gemini 3.1 Pro' },
  { id: 'agy/gemini-3.1-pro-high', provider: 'antigravity', upstream: 'gemini-pro-agent', description: 'Antigravity · Gemini 3.1 Pro (high)' },
  { id: 'agy/gemini-3.1-pro-thinking', provider: 'antigravity', upstream: 'gemini-pro-agent', description: 'Antigravity · Gemini 3.1 Pro (thinking)' },
  { id: 'agy/gemini-3.1-pro-low', provider: 'antigravity', upstream: 'gemini-3.1-pro-low', description: 'Antigravity · Gemini 3.1 Pro (low)' },
  { id: 'agy/gemini-3.1-flash-lite', provider: 'antigravity', upstream: 'gemini-3.1-flash-lite', description: 'Antigravity · Gemini 3.1 Flash Lite' },

  // ---- Gemini 3 Pro & Agent Profiles ----
  { id: 'agy/gemini-3-pro', provider: 'antigravity', upstream: 'gemini-pro-agent', description: 'Antigravity · Gemini 3 Pro' },
  { id: 'agy/gemini-3.0-pro', provider: 'antigravity', upstream: 'gemini-pro-agent', description: 'Antigravity · Gemini 3.0 Pro' },
  { id: 'agy/gemini-3-pro-high', provider: 'antigravity', upstream: 'gemini-pro-agent', description: 'Antigravity · Gemini 3 Pro (high)' },
  { id: 'agy/gemini-3-flash', provider: 'antigravity', upstream: 'gemini-3-flash-agent', description: 'Antigravity · Gemini 3 Flash' },
  { id: 'agy/gemini-3.0-flash', provider: 'antigravity', upstream: 'gemini-3-flash-agent', description: 'Antigravity · Gemini 3.0 Flash' },
  { id: 'agy/gemini-3-flash-agent', provider: 'antigravity', upstream: 'gemini-3-flash-agent', description: 'Antigravity · Gemini 3 Flash Agent' },
  { id: 'agy/gemini-pro-agent', provider: 'antigravity', upstream: 'gemini-pro-agent', description: 'Antigravity · Gemini Pro Agent Profile' },

  // ---- Claude 4.6 Hosted on GCP (Antigravity) ----
  { id: 'agy/claude-sonnet-4.6', provider: 'antigravity', upstream: 'claude-sonnet-4-6', description: 'Antigravity · Claude Sonnet 4.6 (thinking)' },
  { id: 'agy/claude-sonnet-4-6', provider: 'antigravity', upstream: 'claude-sonnet-4-6', description: 'Antigravity · Claude Sonnet 4.6 (thinking)' },
  { id: 'agy/claude-sonnet-4.6-thinking', provider: 'antigravity', upstream: 'claude-sonnet-4-6', description: 'Antigravity · Claude Sonnet 4.6 (thinking)' },
  { id: 'agy/claude-sonnet-4-6-thinking', provider: 'antigravity', upstream: 'claude-sonnet-4-6', description: 'Antigravity · Claude Sonnet 4.6 (thinking)' },
  { id: 'agy/claude-opus-4.6', provider: 'antigravity', upstream: 'claude-opus-4-6-thinking', description: 'Antigravity · Claude Opus 4.6 (thinking)' },
  { id: 'agy/claude-opus-4-6', provider: 'antigravity', upstream: 'claude-opus-4-6-thinking', description: 'Antigravity · Claude Opus 4.6 (thinking)' },
  { id: 'agy/claude-opus-4.6-thinking', provider: 'antigravity', upstream: 'claude-opus-4-6-thinking', description: 'Antigravity · Claude Opus 4.6 (thinking)' },
  { id: 'agy/claude-opus-4-6-thinking', provider: 'antigravity', upstream: 'claude-opus-4-6-thinking', description: 'Antigravity · Claude Opus 4.6 (thinking)' },

  // ---- Open Source on GCP (Antigravity) ----
  { id: 'agy/gpt-oss-120b', provider: 'antigravity', upstream: 'gpt-oss-120b-medium', description: 'Antigravity · GPT-OSS 120B' },
  { id: 'agy/gpt-oss-120b-medium', provider: 'antigravity', upstream: 'gpt-oss-120b-medium', description: 'Antigravity · GPT-OSS 120B (medium)' },
];

/**
 * Resolves a requested model name to its catalog entry or dynamic upstream definition.
 *
 * Resolution strategy:
 * 1. Direct match on `id` (e.g. `kiro/claude-sonnet-4.5`, `agy/gemini-3.7-flash`).
 * 2. Prefix mapping (`kiro/...`, `agy/...`, `antigravity/...`).
 * 3. Unprefixed match against catalog items (e.g. `gemini-3.7-flash` -> `agy/gemini-3.7-flash`).
 * 4. Dot/hyphen normalization (e.g. `kiro/claude-sonnet-4-5` <-> `kiro/claude-sonnet-4.5`).
 * 5. Upstream ID match.
 * 6. Dynamic family-based inference for future uncataloged models.
 */
export function resolveModel(requested: string): ModelEntry | undefined {
  if (!requested || typeof requested !== 'string') return undefined;

  // 1. Direct match on full ID
  const direct = MODEL_CATALOG.find((m) => m.id === requested);
  if (direct) return direct;

  // 2. Normalize prefixes: "antigravity/" -> "agy/"
  let normalizedRequested = requested;
  if (requested.startsWith('antigravity/')) {
    normalizedRequested = `agy/${requested.slice('antigravity/'.length)}`;
    const agyMatch = MODEL_CATALOG.find((m) => m.id === normalizedRequested);
    if (agyMatch) return agyMatch;
  }

  // 3. Dot/hyphen normalized direct match
  const dotNorm = normalizedRequested.replace(/\./g, '-');
  const directNorm = MODEL_CATALOG.find((m) => m.id.replace(/\./g, '-') === dotNorm);
  if (directNorm) return directNorm;

  // 4. Explicit prefix handling (e.g. "kiro/...", "agy/...", "antigravity/...")
  if (requested.startsWith('kiro/')) {
    const raw = requested.slice('kiro/'.length);
    const cat = MODEL_CATALOG.find(
      (m) => m.provider === 'kiro' && (m.id === requested || m.upstream === raw || m.upstream.replace(/\./g, '-') === raw.replace(/\./g, '-'))
    );
    return cat ?? { id: requested, provider: 'kiro', upstream: raw };
  }

  if (requested.startsWith('agy/') || requested.startsWith('antigravity/')) {
    const raw = requested.startsWith('agy/') ? requested.slice('agy/'.length) : requested.slice('antigravity/'.length);
    const cat = MODEL_CATALOG.find(
      (m) => m.provider === 'antigravity' && (m.id === `agy/${raw}` || m.upstream === raw || m.upstream.replace(/\./g, '-') === raw.replace(/\./g, '-'))
    );
    return cat ?? { id: `agy/${raw}`, provider: 'antigravity', upstream: raw };
  }

  // 5. Unprefixed match against catalog items (e.g. user sends "gemini-3.7-flash" or "claude-sonnet-4.5")
  const bareMatch = MODEL_CATALOG.find((m) => {
    const bareId = m.id.replace(/^(kiro|agy)\//, '');
    return bareId === requested || bareId.replace(/\./g, '-') === dotNorm || m.upstream === requested || m.upstream.replace(/\./g, '-') === dotNorm;
  });
  if (bareMatch) return bareMatch;

  // 6. Dynamic fallback for future uncataloged models based on name patterns
  if (/^(gemini|gpt-oss)/i.test(requested)) {
    return { id: `agy/${requested}`, provider: 'antigravity', upstream: requested };
  }
  if (/^(claude|gpt|deepseek|qwen|glm|minimax|mistral|codestral)/i.test(requested)) {
    return { id: `kiro/${requested}`, provider: 'kiro', upstream: requested };
  }

  return undefined;
}
