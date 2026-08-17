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
  // =========================================================================

  // ---- Anthropic Claude 5 & 4.x Series ----
  { id: 'kiro/claude-opus-5', provider: 'kiro', upstream: 'claude-opus-5', description: 'Kiro · Claude Opus 5' },
  { id: 'kiro/claude-opus-5-thinking', provider: 'kiro', upstream: 'claude-opus-5-thinking', description: 'Kiro · Claude Opus 5 (Thinking)' },
  { id: 'kiro/claude-opus-5-agentic', provider: 'kiro', upstream: 'claude-opus-5-agentic', description: 'Kiro · Claude Opus 5 (Agentic)' },
  { id: 'kiro/claude-sonnet-5', provider: 'kiro', upstream: 'claude-sonnet-5', description: 'Kiro · Claude Sonnet 5' },
  { id: 'kiro/claude-sonnet-5-thinking', provider: 'kiro', upstream: 'claude-sonnet-5-thinking', description: 'Kiro · Claude Sonnet 5 (Thinking)' },
  { id: 'kiro/claude-sonnet-5-agentic', provider: 'kiro', upstream: 'claude-sonnet-5-agentic', description: 'Kiro · Claude Sonnet 5 (Agentic)' },
  { id: 'kiro/claude-opus-4.8', provider: 'kiro', upstream: 'claude-opus-4.8', description: 'Kiro · Claude Opus 4.8' },
  { id: 'kiro/claude-opus-4.8-thinking', provider: 'kiro', upstream: 'claude-opus-4.8-thinking', description: 'Kiro · Claude Opus 4.8 (Thinking)' },
  { id: 'kiro/claude-sonnet-4.5', provider: 'kiro', upstream: 'claude-sonnet-4.5', description: 'Kiro · Claude Sonnet 4.5' },
  { id: 'kiro/claude-sonnet-4.5-thinking', provider: 'kiro', upstream: 'claude-sonnet-4.5-thinking', description: 'Kiro · Claude Sonnet 4.5 (Thinking)' },
  { id: 'kiro/claude-sonnet-4.5-agentic', provider: 'kiro', upstream: 'claude-sonnet-4.5-agentic', description: 'Kiro · Claude Sonnet 4.5 (Agentic)' },
  { id: 'kiro/claude-sonnet-4-5', provider: 'kiro', upstream: 'claude-sonnet-4.5', description: 'Kiro · Claude Sonnet 4.5' },
  { id: 'kiro/claude-sonnet-4-5-20250929', provider: 'kiro', upstream: 'claude-sonnet-4.5', description: 'Kiro · Claude Sonnet 4.5' },
  { id: 'kiro/claude-sonnet-4', provider: 'kiro', upstream: 'claude-sonnet-4.5', description: 'Kiro · Claude Sonnet 4' },
  { id: 'kiro/claude-haiku-4.5', provider: 'kiro', upstream: 'claude-haiku-4.5', description: 'Kiro · Claude Haiku 4.5' },
  { id: 'kiro/claude-haiku-4-5', provider: 'kiro', upstream: 'claude-haiku-4.5', description: 'Kiro · Claude Haiku 4.5' },

  // ---- Anthropic Claude 3.x Series ----
  { id: 'kiro/claude-3-7-sonnet', provider: 'kiro', upstream: 'claude-sonnet-4.5', description: 'Kiro · Claude 3.7 Sonnet' },
  { id: 'kiro/claude-3.7-sonnet', provider: 'kiro', upstream: 'claude-sonnet-4.5', description: 'Kiro · Claude 3.7 Sonnet' },
  { id: 'kiro/claude-3-7-sonnet-thinking', provider: 'kiro', upstream: 'claude-sonnet-4.5-thinking', description: 'Kiro · Claude 3.7 Sonnet (Thinking)' },
  { id: 'kiro/claude-3.7-sonnet-thinking', provider: 'kiro', upstream: 'claude-sonnet-4.5-thinking', description: 'Kiro · Claude 3.7 Sonnet (Thinking)' },
  { id: 'kiro/claude-3-7-sonnet-20250219', provider: 'kiro', upstream: 'claude-sonnet-4.5', description: 'Kiro · Claude 3.7 Sonnet' },
  { id: 'kiro/claude-3-5-sonnet', provider: 'kiro', upstream: 'claude-sonnet-4.5', description: 'Kiro · Claude 3.5 Sonnet' },
  { id: 'kiro/claude-3.5-sonnet', provider: 'kiro', upstream: 'claude-sonnet-4.5', description: 'Kiro · Claude 3.5 Sonnet' },
  { id: 'kiro/claude-3-5-sonnet-20241022', provider: 'kiro', upstream: 'claude-sonnet-4.5', description: 'Kiro · Claude 3.5 Sonnet' },
  { id: 'kiro/claude-3-5-sonnet-20240620', provider: 'kiro', upstream: 'claude-sonnet-4.5', description: 'Kiro · Claude 3.5 Sonnet' },
  { id: 'kiro/claude-3-5-sonnet-latest', provider: 'kiro', upstream: 'claude-sonnet-4.5', description: 'Kiro · Claude 3.5 Sonnet' },
  { id: 'kiro/claude-3-5-haiku', provider: 'kiro', upstream: 'claude-haiku-4.5', description: 'Kiro · Claude 3.5 Haiku' },
  { id: 'kiro/claude-3.5-haiku', provider: 'kiro', upstream: 'claude-haiku-4.5', description: 'Kiro · Claude 3.5 Haiku' },
  { id: 'kiro/claude-3-5-haiku-20241022', provider: 'kiro', upstream: 'claude-haiku-4.5', description: 'Kiro · Claude 3.5 Haiku' },
  { id: 'kiro/claude-3-haiku', provider: 'kiro', upstream: 'claude-haiku-4.5', description: 'Kiro · Claude Haiku' },
  { id: 'kiro/claude-3-opus', provider: 'kiro', upstream: 'claude-opus-5', description: 'Kiro · Claude 3 Opus' },
  { id: 'kiro/claude-3-opus-20240229', provider: 'kiro', upstream: 'claude-opus-5', description: 'Kiro · Claude 3 Opus' },

  // ---- OpenAI GPT 5.x & Frontier Models on Kiro ----
  { id: 'kiro/gpt-5.6-sol', provider: 'kiro', upstream: 'gpt-5.6-sol', description: 'Kiro · GPT 5.6 Sol (272k context)' },
  { id: 'kiro/gpt-5.6-sol-thinking', provider: 'kiro', upstream: 'gpt-5.6-sol-thinking', description: 'Kiro · GPT 5.6 Sol (Thinking)' },
  { id: 'kiro/gpt-5.6-terra', provider: 'kiro', upstream: 'gpt-5.6-terra', description: 'Kiro · GPT 5.6 Terra (272k context)' },
  { id: 'kiro/gpt-5.6-luna', provider: 'kiro', upstream: 'gpt-5.6-luna', description: 'Kiro · GPT 5.6 Luna (272k context)' },
  { id: 'kiro/gpt-5', provider: 'kiro', upstream: 'gpt-5.6-sol', description: 'Kiro · GPT 5' },
  { id: 'kiro/gpt-5-mini', provider: 'kiro', upstream: 'gpt-5.6-luna', description: 'Kiro · GPT 5 Mini' },

  // ---- OpenAI GPT 4.x & Reasoning Series on Kiro ----
  { id: 'kiro/gpt-4.5', provider: 'kiro', upstream: 'gpt-5.6-sol', description: 'Kiro · GPT 4.5' },
  { id: 'kiro/gpt-4.5-preview', provider: 'kiro', upstream: 'gpt-5.6-sol', description: 'Kiro · GPT 4.5 Preview' },
  { id: 'kiro/gpt-4o', provider: 'kiro', upstream: 'claude-sonnet-4.5', description: 'Kiro · GPT-4o' },
  { id: 'kiro/gpt-4o-mini', provider: 'kiro', upstream: 'claude-haiku-4.5', description: 'Kiro · GPT-4o Mini' },
  { id: 'kiro/gpt-4-turbo', provider: 'kiro', upstream: 'claude-sonnet-4.5', description: 'Kiro · GPT-4 Turbo' },
  { id: 'kiro/gpt-4', provider: 'kiro', upstream: 'claude-sonnet-4.5', description: 'Kiro · GPT-4' },
  { id: 'kiro/o3-mini', provider: 'kiro', upstream: 'claude-sonnet-4.5-thinking', description: 'Kiro · o3-mini' },
  { id: 'kiro/o3', provider: 'kiro', upstream: 'claude-opus-5-thinking', description: 'Kiro · o3' },
  { id: 'kiro/o1', provider: 'kiro', upstream: 'claude-opus-5-thinking', description: 'Kiro · o1' },
  { id: 'kiro/o1-mini', provider: 'kiro', upstream: 'claude-sonnet-4.5-thinking', description: 'Kiro · o1-mini' },
  { id: 'kiro/o1-preview', provider: 'kiro', upstream: 'claude-opus-5-thinking', description: 'Kiro · o1-preview' },

  // ---- Open-Weights & Specialist Models on Kiro ----
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
  { id: 'kiro/minimax-01', provider: 'kiro', upstream: 'MiniMax-M2.5', description: 'Kiro · MiniMax 01' },
  { id: 'kiro/mistral-large', provider: 'kiro', upstream: 'claude-sonnet-4.5', description: 'Kiro · Mistral Large' },
  { id: 'kiro/mistral-codestral', provider: 'kiro', upstream: 'claude-sonnet-4.5', description: 'Kiro · Mistral Codestral' },
  { id: 'kiro/codestral', provider: 'kiro', upstream: 'claude-sonnet-4.5', description: 'Kiro · Codestral' },

  // =========================================================================
  // Google Antigravity (Cloud Code Runtime) -> agy/{modelid}
  // Active Google Cloud Code Upstream Tiers:
  // - gemini-3.6-flash-high (Gemini 3.7 / 3.6 Flash High Thinking)
  // - gemini-3.6-flash-medium / low
  // - gemini-3-flash-agent
  // - gemini-pro-agent
  // - gemini-2.5-flash / gemini-2.5-pro
  // - claude-sonnet-4-6
  // - gpt-oss-120b-medium
  // =========================================================================

  // ---- Gemini 3.x Series ----
  { id: 'agy/gemini-3.7-flash', provider: 'antigravity', upstream: 'gemini-3.6-flash-high', description: 'Antigravity · Gemini 3.7 Flash' },
  { id: 'agy/gemini-3.7-flash-high', provider: 'antigravity', upstream: 'gemini-3.6-flash-high', description: 'Antigravity · Gemini 3.7 Flash (high)' },
  { id: 'agy/gemini-3.7-flash-medium', provider: 'antigravity', upstream: 'gemini-3.6-flash-medium', description: 'Antigravity · Gemini 3.7 Flash (medium)' },
  { id: 'agy/gemini-3.7-flash-low', provider: 'antigravity', upstream: 'gemini-3.6-flash-low', description: 'Antigravity · Gemini 3.7 Flash (low)' },
  { id: 'agy/gemini-3.6-flash', provider: 'antigravity', upstream: 'gemini-3.6-flash-high', description: 'Antigravity · Gemini 3.6 Flash' },
  { id: 'agy/gemini-3.6-flash-high', provider: 'antigravity', upstream: 'gemini-3.6-flash-high', description: 'Antigravity · Gemini 3.6 Flash (high)' },
  { id: 'agy/gemini-3.6-flash-medium', provider: 'antigravity', upstream: 'gemini-3.6-flash-medium', description: 'Antigravity · Gemini 3.6 Flash (medium)' },
  { id: 'agy/gemini-3.6-flash-low', provider: 'antigravity', upstream: 'gemini-3.6-flash-low', description: 'Antigravity · Gemini 3.6 Flash (low)' },
  { id: 'agy/gemini-3.5-flash', provider: 'antigravity', upstream: 'gemini-3-flash-agent', description: 'Antigravity · Gemini 3.5 Flash' },
  { id: 'agy/gemini-3.5-flash-high', provider: 'antigravity', upstream: 'gemini-3-flash-agent', description: 'Antigravity · Gemini 3.5 Flash (high)' },
  { id: 'agy/gemini-3.5-flash-medium', provider: 'antigravity', upstream: 'gemini-3.5-flash-low', description: 'Antigravity · Gemini 3.5 Flash (medium)' },
  { id: 'agy/gemini-3.5-flash-low', provider: 'antigravity', upstream: 'gemini-3.5-flash-extra-low', description: 'Antigravity · Gemini 3.5 Flash (low)' },
  { id: 'agy/gemini-3.1-pro', provider: 'antigravity', upstream: 'gemini-pro-agent', description: 'Antigravity · Gemini 3.1 Pro' },
  { id: 'agy/gemini-3.1-pro-high', provider: 'antigravity', upstream: 'gemini-pro-agent', description: 'Antigravity · Gemini 3.1 Pro (high)' },
  { id: 'agy/gemini-3.1-pro-low', provider: 'antigravity', upstream: 'gemini-3.1-pro-low', description: 'Antigravity · Gemini 3.1 Pro (low)' },
  { id: 'agy/gemini-3.1-flash-lite', provider: 'antigravity', upstream: 'gemini-3.1-flash-lite', description: 'Antigravity · Gemini 3.1 Flash Lite' },
  { id: 'agy/gemini-3-pro', provider: 'antigravity', upstream: 'gemini-pro-agent', description: 'Antigravity · Gemini 3 Pro' },
  { id: 'agy/gemini-3.0-pro', provider: 'antigravity', upstream: 'gemini-pro-agent', description: 'Antigravity · Gemini 3.0 Pro' },
  { id: 'agy/gemini-3-pro-high', provider: 'antigravity', upstream: 'gemini-pro-agent', description: 'Antigravity · Gemini 3 Pro (high)' },
  { id: 'agy/gemini-3-flash', provider: 'antigravity', upstream: 'gemini-3-flash-agent', description: 'Antigravity · Gemini 3 Flash' },
  { id: 'agy/gemini-3.0-flash', provider: 'antigravity', upstream: 'gemini-3-flash-agent', description: 'Antigravity · Gemini 3.0 Flash' },
  { id: 'agy/gemini-3-flash-agent', provider: 'antigravity', upstream: 'gemini-3-flash-agent', description: 'Antigravity · Gemini 3 Flash Agent' },
  { id: 'agy/gemini-pro-agent', provider: 'antigravity', upstream: 'gemini-pro-agent', description: 'Antigravity · Gemini Pro Agent Profile' },

  // ---- Gemini 2.5 & 2.x Series ----
  { id: 'agy/gemini-2.5-flash', provider: 'antigravity', upstream: 'gemini-2.5-flash', description: 'Antigravity · Gemini 2.5 Flash' },
  { id: 'agy/gemini-2.5-flash-thinking', provider: 'antigravity', upstream: 'gemini-2.5-flash-thinking', description: 'Antigravity · Gemini 2.5 Flash (Thinking)' },
  { id: 'agy/gemini-2.5-flash-lite', provider: 'antigravity', upstream: 'gemini-2.5-flash-lite', description: 'Antigravity · Gemini 2.5 Flash Lite' },
  { id: 'agy/gemini-2.5-pro', provider: 'antigravity', upstream: 'gemini-2.5-pro', description: 'Antigravity · Gemini 2.5 Pro' },
  { id: 'agy/gemini-2.0-flash', provider: 'antigravity', upstream: 'gemini-2.5-flash', description: 'Antigravity · Gemini 2.5 Flash' },
  { id: 'agy/gemini-2.0-flash-exp', provider: 'antigravity', upstream: 'gemini-2.5-flash', description: 'Antigravity · Gemini 2.5 Flash (Exp)' },
  { id: 'agy/gemini-2.0-flash-thinking-exp', provider: 'antigravity', upstream: 'gemini-2.5-flash-thinking', description: 'Antigravity · Gemini 2.5 Flash (Thinking Exp)' },
  { id: 'agy/gemini-2.0-pro', provider: 'antigravity', upstream: 'gemini-2.5-pro', description: 'Antigravity · Gemini 2.5 Pro' },
  { id: 'agy/gemini-2.0-pro-exp', provider: 'antigravity', upstream: 'gemini-2.5-pro', description: 'Antigravity · Gemini 2.5 Pro (Exp)' },
  { id: 'agy/gemini-1.5-pro', provider: 'antigravity', upstream: 'gemini-2.5-pro', description: 'Antigravity · Gemini 2.5 Pro' },
  { id: 'agy/gemini-1.5-pro-latest', provider: 'antigravity', upstream: 'gemini-2.5-pro', description: 'Antigravity · Gemini 2.5 Pro (Latest)' },
  { id: 'agy/gemini-1.5-flash', provider: 'antigravity', upstream: 'gemini-2.5-flash', description: 'Antigravity · Gemini 2.5 Flash' },
  { id: 'agy/gemini-1.5-flash-latest', provider: 'antigravity', upstream: 'gemini-2.5-flash', description: 'Antigravity · Gemini 2.5 Flash (Latest)' },

  // ---- Claude Hosted on GCP (Antigravity) ----
  { id: 'agy/claude-sonnet-4-6', provider: 'antigravity', upstream: 'claude-sonnet-4-6', description: 'Antigravity · Claude Sonnet 4.6 (thinking)' },
  { id: 'agy/claude-sonnet-4.6', provider: 'antigravity', upstream: 'claude-sonnet-4-6', description: 'Antigravity · Claude Sonnet 4.6 (thinking)' },
  { id: 'agy/claude-opus-4-6-thinking', provider: 'antigravity', upstream: 'claude-opus-4-6-thinking', description: 'Antigravity · Claude Opus 4.6 (Thinking)' },
  { id: 'agy/claude-opus-4.6-thinking', provider: 'antigravity', upstream: 'claude-opus-4-6-thinking', description: 'Antigravity · Claude Opus 4.6 (Thinking)' },
  { id: 'agy/claude-sonnet-4-5-gcp', provider: 'antigravity', upstream: 'claude-sonnet-4-6', description: 'Antigravity · Claude Sonnet 4.6 (GCP)' },
  { id: 'agy/claude-sonnet-4.5-gcp', provider: 'antigravity', upstream: 'claude-sonnet-4-6', description: 'Antigravity · Claude Sonnet 4.6 (GCP)' },

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
