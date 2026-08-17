// Model catalog for Kiro and Google Antigravity.
// Edit this file to add/rename models or aliases.
//
// Raw upstream models can also be requested with a "kiro/..." or "antigravity/..."
// prefix (e.g. "kiro/claude-sonnet-4.5-agentic"), which bypasses the catalog.

import type { ProviderId } from './types.ts';

export interface ModelEntry {
  id: string; // public model id served by the gateway
  provider: ProviderId;
  upstream: string; // exact model id sent to the provider
  description?: string;
}

export const MODEL_CATALOG: ModelEntry[] = [
  // =========================================================================
  // Kiro (AWS CodeWhisperer / Q Developer Runtime)
  // =========================================================================

  // ---- Anthropic Claude 5 & 4.x Series ----
  { id: 'claude-opus-5', provider: 'kiro', upstream: 'claude-opus-5', description: 'Kiro · Claude Opus 5' },
  { id: 'claude-opus-5-thinking', provider: 'kiro', upstream: 'claude-opus-5-thinking', description: 'Kiro · Claude Opus 5 (Thinking)' },
  { id: 'claude-opus-5-agentic', provider: 'kiro', upstream: 'claude-opus-5-agentic', description: 'Kiro · Claude Opus 5 (Agentic)' },
  { id: 'claude-sonnet-5', provider: 'kiro', upstream: 'claude-sonnet-5', description: 'Kiro · Claude Sonnet 5' },
  { id: 'claude-sonnet-5-thinking', provider: 'kiro', upstream: 'claude-sonnet-5-thinking', description: 'Kiro · Claude Sonnet 5 (Thinking)' },
  { id: 'claude-sonnet-5-agentic', provider: 'kiro', upstream: 'claude-sonnet-5-agentic', description: 'Kiro · Claude Sonnet 5 (Agentic)' },
  { id: 'claude-opus-4.8', provider: 'kiro', upstream: 'claude-opus-4.8', description: 'Kiro · Claude Opus 4.8' },
  { id: 'claude-opus-4.8-thinking', provider: 'kiro', upstream: 'claude-opus-4.8-thinking', description: 'Kiro · Claude Opus 4.8 (Thinking)' },
  { id: 'claude-sonnet-4.5', provider: 'kiro', upstream: 'claude-sonnet-4.5', description: 'Kiro · Claude Sonnet 4.5' },
  { id: 'claude-sonnet-4.5-thinking', provider: 'kiro', upstream: 'claude-sonnet-4.5-thinking', description: 'Kiro · Claude Sonnet 4.5 (Thinking)' },
  { id: 'claude-sonnet-4.5-agentic', provider: 'kiro', upstream: 'claude-sonnet-4.5-agentic', description: 'Kiro · Claude Sonnet 4.5 (Agentic)' },
  { id: 'claude-sonnet-4-5', provider: 'kiro', upstream: 'claude-sonnet-4.5', description: 'Kiro · Claude Sonnet 4.5' },
  { id: 'claude-sonnet-4-5-20250929', provider: 'kiro', upstream: 'claude-sonnet-4.5', description: 'Kiro · Claude Sonnet 4.5' },
  { id: 'claude-sonnet-4', provider: 'kiro', upstream: 'claude-sonnet-4', description: 'Kiro · Claude Sonnet 4' },
  { id: 'claude-haiku-4.5', provider: 'kiro', upstream: 'claude-haiku-4.5', description: 'Kiro · Claude Haiku 4.5' },
  { id: 'claude-haiku-4-5', provider: 'kiro', upstream: 'claude-haiku-4.5', description: 'Kiro · Claude Haiku 4.5' },

  // ---- Anthropic Claude 3.x Series ----
  { id: 'claude-3-7-sonnet', provider: 'kiro', upstream: 'claude-3.7-sonnet', description: 'Kiro · Claude 3.7 Sonnet' },
  { id: 'claude-3.7-sonnet', provider: 'kiro', upstream: 'claude-3.7-sonnet', description: 'Kiro · Claude 3.7 Sonnet' },
  { id: 'claude-3-7-sonnet-thinking', provider: 'kiro', upstream: 'claude-3.7-sonnet-thinking', description: 'Kiro · Claude 3.7 Sonnet (Thinking)' },
  { id: 'claude-3.7-sonnet-thinking', provider: 'kiro', upstream: 'claude-3.7-sonnet-thinking', description: 'Kiro · Claude 3.7 Sonnet (Thinking)' },
  { id: 'claude-3-7-sonnet-20250219', provider: 'kiro', upstream: 'claude-3.7-sonnet', description: 'Kiro · Claude 3.7 Sonnet' },
  { id: 'claude-3-5-sonnet', provider: 'kiro', upstream: 'claude-3.5-sonnet', description: 'Kiro · Claude 3.5 Sonnet' },
  { id: 'claude-3.5-sonnet', provider: 'kiro', upstream: 'claude-3.5-sonnet', description: 'Kiro · Claude 3.5 Sonnet' },
  { id: 'claude-3-5-sonnet-20241022', provider: 'kiro', upstream: 'claude-3.5-sonnet', description: 'Kiro · Claude 3.5 Sonnet' },
  { id: 'claude-3-5-sonnet-20240620', provider: 'kiro', upstream: 'claude-3.5-sonnet', description: 'Kiro · Claude 3.5 Sonnet' },
  { id: 'claude-3-5-sonnet-latest', provider: 'kiro', upstream: 'claude-3.5-sonnet', description: 'Kiro · Claude 3.5 Sonnet' },
  { id: 'claude-3-5-haiku', provider: 'kiro', upstream: 'claude-3.5-haiku', description: 'Kiro · Claude 3.5 Haiku' },
  { id: 'claude-3.5-haiku', provider: 'kiro', upstream: 'claude-3.5-haiku', description: 'Kiro · Claude 3.5 Haiku' },
  { id: 'claude-3-5-haiku-20241022', provider: 'kiro', upstream: 'claude-3.5-haiku', description: 'Kiro · Claude 3.5 Haiku' },
  { id: 'claude-3-haiku', provider: 'kiro', upstream: 'claude-3-haiku', description: 'Kiro · Claude Haiku' },
  { id: 'claude-3-opus', provider: 'kiro', upstream: 'claude-3-opus', description: 'Kiro · Claude 3 Opus' },
  { id: 'claude-3-opus-20240229', provider: 'kiro', upstream: 'claude-3-opus', description: 'Kiro · Claude 3 Opus' },

  // ---- OpenAI GPT 5.x & Frontier Models on Kiro ----
  { id: 'gpt-5.6-sol', provider: 'kiro', upstream: 'gpt-5.6-sol', description: 'Kiro · GPT 5.6 Sol (272k context)' },
  { id: 'gpt-5.6-sol-thinking', provider: 'kiro', upstream: 'gpt-5.6-sol-thinking', description: 'Kiro · GPT 5.6 Sol (Thinking)' },
  { id: 'gpt-5.6-terra', provider: 'kiro', upstream: 'gpt-5.6-terra', description: 'Kiro · GPT 5.6 Terra (272k context)' },
  { id: 'gpt-5.6-luna', provider: 'kiro', upstream: 'gpt-5.6-luna', description: 'Kiro · GPT 5.6 Luna (272k context)' },
  { id: 'gpt-5', provider: 'kiro', upstream: 'gpt-5', description: 'Kiro · GPT 5' },
  { id: 'gpt-5-mini', provider: 'kiro', upstream: 'gpt-5-mini', description: 'Kiro · GPT 5 Mini' },

  // ---- OpenAI GPT 4.x & Reasoning Series on Kiro ----
  { id: 'gpt-4.5', provider: 'kiro', upstream: 'gpt-4.5', description: 'Kiro · GPT 4.5' },
  { id: 'gpt-4.5-preview', provider: 'kiro', upstream: 'gpt-4.5-preview', description: 'Kiro · GPT 4.5 Preview' },
  { id: 'gpt-4o', provider: 'kiro', upstream: 'gpt-4o', description: 'Kiro · GPT-4o' },
  { id: 'gpt-4o-mini', provider: 'kiro', upstream: 'gpt-4o-mini', description: 'Kiro · GPT-4o Mini' },
  { id: 'gpt-4-turbo', provider: 'kiro', upstream: 'gpt-4-turbo', description: 'Kiro · GPT-4 Turbo' },
  { id: 'gpt-4', provider: 'kiro', upstream: 'gpt-4', description: 'Kiro · GPT-4' },
  { id: 'o3-mini', provider: 'kiro', upstream: 'o3-mini', description: 'Kiro · o3-mini' },
  { id: 'o3', provider: 'kiro', upstream: 'o3', description: 'Kiro · o3' },
  { id: 'o1', provider: 'kiro', upstream: 'o1', description: 'Kiro · o1' },
  { id: 'o1-mini', provider: 'kiro', upstream: 'o1-mini', description: 'Kiro · o1-mini' },
  { id: 'o1-preview', provider: 'kiro', upstream: 'o1-preview', description: 'Kiro · o1-preview' },

  // ---- Open-Weights & Specialist Models on Kiro ----
  { id: 'deepseek-3.2', provider: 'kiro', upstream: 'deepseek-3.2', description: 'Kiro · DeepSeek 3.2 (text only)' },
  { id: 'deepseek-v3', provider: 'kiro', upstream: 'deepseek-v3', description: 'Kiro · DeepSeek V3' },
  { id: 'deepseek-r1', provider: 'kiro', upstream: 'deepseek-r1', description: 'Kiro · DeepSeek R1 (Thinking)' },
  { id: 'deepseek-coder', provider: 'kiro', upstream: 'deepseek-coder', description: 'Kiro · DeepSeek Coder' },
  { id: 'qwen3-coder-next', provider: 'kiro', upstream: 'qwen3-coder-next', description: 'Kiro · Qwen3 Coder Next (text only)' },
  { id: 'qwen-2.5-coder-32b', provider: 'kiro', upstream: 'qwen-2.5-coder-32b', description: 'Kiro · Qwen 2.5 Coder 32B' },
  { id: 'qwen-2.5-coder', provider: 'kiro', upstream: 'qwen-2.5-coder', description: 'Kiro · Qwen 2.5 Coder' },
  { id: 'glm-5', provider: 'kiro', upstream: 'glm-5', description: 'Kiro · GLM 5' },
  { id: 'glm-4-plus', provider: 'kiro', upstream: 'glm-4-plus', description: 'Kiro · GLM 4 Plus' },
  { id: 'minimax-m2.5', provider: 'kiro', upstream: 'MiniMax-M2.5', description: 'Kiro · MiniMax M2.5' },
  { id: 'minimax-01', provider: 'kiro', upstream: 'minimax-01', description: 'Kiro · MiniMax 01' },
  { id: 'mistral-large', provider: 'kiro', upstream: 'mistral-large', description: 'Kiro · Mistral Large' },
  { id: 'mistral-codestral', provider: 'kiro', upstream: 'mistral-codestral', description: 'Kiro · Mistral Codestral' },
  { id: 'codestral', provider: 'kiro', upstream: 'codestral', description: 'Kiro · Codestral' },

  // =========================================================================
  // Google Antigravity (Cloud Code Runtime)
  // =========================================================================

  // ---- Gemini 3.x Series ----
  { id: 'gemini-3.7-flash', provider: 'antigravity', upstream: 'gemini-3.7-flash', description: 'Antigravity · Gemini 3.7 Flash' },
  { id: 'gemini-3.7-flash-high', provider: 'antigravity', upstream: 'gemini-3.7-flash-high', description: 'Antigravity · Gemini 3.7 Flash (high)' },
  { id: 'gemini-3.7-flash-medium', provider: 'antigravity', upstream: 'gemini-3.7-flash-medium', description: 'Antigravity · Gemini 3.7 Flash (medium)' },
  { id: 'gemini-3.7-flash-low', provider: 'antigravity', upstream: 'gemini-3.7-flash-low', description: 'Antigravity · Gemini 3.7 Flash (low)' },
  { id: 'gemini-3.6-flash', provider: 'antigravity', upstream: 'gemini-3.6-flash', description: 'Antigravity · Gemini 3.6 Flash' },
  { id: 'gemini-3.6-flash-high', provider: 'antigravity', upstream: 'gemini-3.6-flash-high', description: 'Antigravity · Gemini 3.6 Flash (high)' },
  { id: 'gemini-3.6-flash-medium', provider: 'antigravity', upstream: 'gemini-3.6-flash-medium', description: 'Antigravity · Gemini 3.6 Flash (medium)' },
  { id: 'gemini-3.6-flash-low', provider: 'antigravity', upstream: 'gemini-3.6-flash-low', description: 'Antigravity · Gemini 3.6 Flash (low)' },
  { id: 'gemini-3.5-flash', provider: 'antigravity', upstream: 'gemini-3.5-flash', description: 'Antigravity · Gemini 3.5 Flash' },
  { id: 'gemini-3.5-flash-high', provider: 'antigravity', upstream: 'gemini-3.5-flash-high', description: 'Antigravity · Gemini 3.5 Flash (high)' },
  { id: 'gemini-3.5-flash-medium', provider: 'antigravity', upstream: 'gemini-3.5-flash-medium', description: 'Antigravity · Gemini 3.5 Flash (medium)' },
  { id: 'gemini-3.5-flash-low', provider: 'antigravity', upstream: 'gemini-3.5-flash-extra-low', description: 'Antigravity · Gemini 3.5 Flash (low)' },
  { id: 'gemini-3.1-pro', provider: 'antigravity', upstream: 'gemini-3.1-pro', description: 'Antigravity · Gemini 3.1 Pro' },
  { id: 'gemini-3.1-pro-high', provider: 'antigravity', upstream: 'gemini-3.1-pro-high', description: 'Antigravity · Gemini 3.1 Pro (high)' },
  { id: 'gemini-3.1-pro-low', provider: 'antigravity', upstream: 'gemini-3.1-pro-low', description: 'Antigravity · Gemini 3.1 Pro (low)' },
  { id: 'gemini-3.1-flash-lite', provider: 'antigravity', upstream: 'gemini-3.1-flash-lite', description: 'Antigravity · Gemini 3.1 Flash Lite' },
  { id: 'gemini-3-pro', provider: 'antigravity', upstream: 'gemini-3-pro', description: 'Antigravity · Gemini 3 Pro' },
  { id: 'gemini-3.0-pro', provider: 'antigravity', upstream: 'gemini-3.0-pro', description: 'Antigravity · Gemini 3.0 Pro' },
  { id: 'gemini-3-pro-high', provider: 'antigravity', upstream: 'gemini-3-pro-high', description: 'Antigravity · Gemini 3 Pro (high)' },
  { id: 'gemini-3-flash', provider: 'antigravity', upstream: 'gemini-3-flash', description: 'Antigravity · Gemini 3 Flash' },
  { id: 'gemini-3.0-flash', provider: 'antigravity', upstream: 'gemini-3.0-flash', description: 'Antigravity · Gemini 3.0 Flash' },
  { id: 'gemini-3-flash-agent', provider: 'antigravity', upstream: 'gemini-3-flash-agent', description: 'Antigravity · Gemini 3 Flash Agent' },
  { id: 'gemini-pro-agent', provider: 'antigravity', upstream: 'gemini-pro-agent', description: 'Antigravity · Gemini Pro Agent Profile' },

  // ---- Gemini 2.5 & 2.x Series ----
  { id: 'gemini-2.5-flash', provider: 'antigravity', upstream: 'gemini-2.5-flash', description: 'Antigravity · Gemini 2.5 Flash' },
  { id: 'gemini-2.5-flash-thinking', provider: 'antigravity', upstream: 'gemini-2.5-flash-thinking', description: 'Antigravity · Gemini 2.5 Flash (Thinking)' },
  { id: 'gemini-2.5-flash-lite', provider: 'antigravity', upstream: 'gemini-2.5-flash-lite', description: 'Antigravity · Gemini 2.5 Flash Lite' },
  { id: 'gemini-2.5-pro', provider: 'antigravity', upstream: 'gemini-2.5-pro', description: 'Antigravity · Gemini 2.5 Pro' },
  { id: 'gemini-2.0-flash', provider: 'antigravity', upstream: 'gemini-2.0-flash', description: 'Antigravity · Gemini 2.0 Flash' },
  { id: 'gemini-2.0-flash-exp', provider: 'antigravity', upstream: 'gemini-2.0-flash-exp', description: 'Antigravity · Gemini 2.0 Flash (Exp)' },
  { id: 'gemini-2.0-flash-thinking-exp', provider: 'antigravity', upstream: 'gemini-2.0-flash-thinking-exp', description: 'Antigravity · Gemini 2.0 Flash (Thinking Exp)' },
  { id: 'gemini-2.0-pro', provider: 'antigravity', upstream: 'gemini-2.0-pro', description: 'Antigravity · Gemini 2.0 Pro' },
  { id: 'gemini-2.0-pro-exp', provider: 'antigravity', upstream: 'gemini-2.0-pro-exp', description: 'Antigravity · Gemini 2.0 Pro (Exp)' },
  { id: 'gemini-1.5-pro', provider: 'antigravity', upstream: 'gemini-1.5-pro', description: 'Antigravity · Gemini 1.5 Pro' },
  { id: 'gemini-1.5-pro-latest', provider: 'antigravity', upstream: 'gemini-1.5-pro-latest', description: 'Antigravity · Gemini 1.5 Pro (Latest)' },
  { id: 'gemini-1.5-flash', provider: 'antigravity', upstream: 'gemini-1.5-flash', description: 'Antigravity · Gemini 1.5 Flash' },
  { id: 'gemini-1.5-flash-latest', provider: 'antigravity', upstream: 'gemini-1.5-flash-latest', description: 'Antigravity · Gemini 1.5 Flash (Latest)' },

  // ---- Claude Hosted on GCP (Antigravity) ----
  { id: 'claude-sonnet-4-6', provider: 'antigravity', upstream: 'claude-sonnet-4-6', description: 'Antigravity · Claude Sonnet 4.6 (thinking)' },
  { id: 'claude-sonnet-4.6', provider: 'antigravity', upstream: 'claude-sonnet-4-6', description: 'Antigravity · Claude Sonnet 4.6 (thinking)' },
  { id: 'claude-opus-4-6-thinking', provider: 'antigravity', upstream: 'claude-opus-4-6-thinking', description: 'Antigravity · Claude Opus 4.6 (Thinking)' },
  { id: 'claude-opus-4.6-thinking', provider: 'antigravity', upstream: 'claude-opus-4-6-thinking', description: 'Antigravity · Claude Opus 4.6 (Thinking)' },
  { id: 'claude-sonnet-4-5-gcp', provider: 'antigravity', upstream: 'claude-sonnet-4-6', description: 'Antigravity · Claude Sonnet 4.6 (GCP)' },
  { id: 'claude-sonnet-4.5-gcp', provider: 'antigravity', upstream: 'claude-sonnet-4-6', description: 'Antigravity · Claude Sonnet 4.6 (GCP)' },

  // ---- Open Source on GCP (Antigravity) ----
  { id: 'gpt-oss-120b', provider: 'antigravity', upstream: 'gpt-oss-120b', description: 'Antigravity · GPT-OSS 120B' },
  { id: 'gpt-oss-120b-medium', provider: 'antigravity', upstream: 'gpt-oss-120b-medium', description: 'Antigravity · GPT-OSS 120B (medium)' },
];

/**
 * Resolves a requested model name to its catalog entry or dynamic upstream definition.
 *
 * Resolution strategy:
 * 1. Direct match on `id`.
 * 2. Dot/hyphen normalized match on `id` (e.g. `claude-sonnet-4.5` <-> `claude-sonnet-4-5`).
 * 3. Explicit prefix (`kiro/...`, `antigravity/...`).
 * 4. Match on `upstream` name.
 * 5. Intelligent family-based provider inference for uncataloged frontier models.
 */
export function resolveModel(requested: string): ModelEntry | undefined {
  if (!requested || typeof requested !== 'string') return undefined;

  // 1. Direct match
  const direct = MODEL_CATALOG.find((m) => m.id === requested);
  if (direct) return direct;

  // 2. Dot/hyphen normalization
  const normalized = requested.replace(/\./g, '-');
  const directNorm = MODEL_CATALOG.find((m) => m.id.replace(/\./g, '-') === normalized);
  if (directNorm) return directNorm;

  // 3. Explicit provider prefix (e.g. "kiro/...", "antigravity/...")
  for (const provider of ['kiro', 'antigravity'] as ProviderId[]) {
    if (requested.startsWith(`${provider}/`)) {
      const upstream = requested.slice(provider.length + 1);
      const catalogEntry = MODEL_CATALOG.find(
        (m) => m.provider === provider && (m.id === upstream || m.upstream === upstream || m.id.replace(/\./g, '-') === upstream.replace(/\./g, '-'))
      );
      return catalogEntry ? { ...catalogEntry, id: requested } : { id: requested, provider, upstream };
    }
  }

  // 4. Match by upstream directly
  const matchUpstream = MODEL_CATALOG.find(
    (m) => m.upstream === requested || m.upstream.replace(/\./g, '-') === normalized
  );
  if (matchUpstream) return matchUpstream;

  // 5. Dynamic fallback for future uncataloged models based on name patterns
  if (/^(gemini|gpt-oss)/i.test(requested)) {
    return { id: requested, provider: 'antigravity', upstream: requested };
  }
  if (/^(claude|gpt|deepseek|qwen|glm|minimax|mistral|codestral)/i.test(requested)) {
    return { id: requested, provider: 'kiro', upstream: requested };
  }

  return undefined;
}
