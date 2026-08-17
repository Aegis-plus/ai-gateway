// Model catalog. Edit this file to add/rename models.
// Models can also be requested raw with a "kiro/..." or "antigravity/..."
// prefix (e.g. "kiro/claude-sonnet-4.5-agentic"), which bypasses the
// catalog — useful when the IDEs ship new models before this file is updated.
//
// Upstream ids verified against 9router's Kiro registry and OmniRoute's
// Antigravity model aliases (August 2026).

import type { ProviderId } from './types.ts';

export interface ModelEntry {
  id: string; // public model id served by the gateway
  provider: ProviderId;
  upstream: string; // model id sent to the provider
  description?: string;
}

export const MODEL_CATALOG: ModelEntry[] = [
  // ---- Kiro (CodeWhisperer runtime) ----
  { id: 'claude-opus-5', provider: 'kiro', upstream: 'claude-opus-5', description: 'Kiro · Claude Opus 5' },
  { id: 'claude-opus-5-thinking', provider: 'kiro', upstream: 'claude-opus-5-thinking', description: 'Kiro · Claude Opus 5 (Thinking)' },
  { id: 'claude-sonnet-5', provider: 'kiro', upstream: 'claude-sonnet-5', description: 'Kiro · Claude Sonnet 5' },
  { id: 'claude-sonnet-5-thinking', provider: 'kiro', upstream: 'claude-sonnet-5-thinking', description: 'Kiro · Claude Sonnet 5 (Thinking)' },
  { id: 'claude-sonnet-4.5', provider: 'kiro', upstream: 'claude-sonnet-4.5', description: 'Kiro · Claude Sonnet 4.5' },
  { id: 'claude-sonnet-4.5-thinking', provider: 'kiro', upstream: 'claude-sonnet-4.5-thinking', description: 'Kiro · Claude Sonnet 4.5 (Thinking)' },
  { id: 'claude-opus-4.8', provider: 'kiro', upstream: 'claude-opus-4.8', description: 'Kiro · Claude Opus 4.8' },
  { id: 'claude-opus-4.8-thinking', provider: 'kiro', upstream: 'claude-opus-4.8-thinking', description: 'Kiro · Claude Opus 4.8 (Thinking)' },
  { id: 'claude-haiku-4.5', provider: 'kiro', upstream: 'claude-haiku-4.5', description: 'Kiro · Claude Haiku 4.5' },
  { id: 'gpt-5.6-sol', provider: 'kiro', upstream: 'gpt-5.6-sol', description: 'Kiro · GPT 5.6 Sol (272k)' },
  { id: 'gpt-5.6-terra', provider: 'kiro', upstream: 'gpt-5.6-terra', description: 'Kiro · GPT 5.6 Terra (272k)' },
  { id: 'gpt-5.6-luna', provider: 'kiro', upstream: 'gpt-5.6-luna', description: 'Kiro · GPT 5.6 Luna (272k)' },
  { id: 'gpt-5.6-sol-thinking', provider: 'kiro', upstream: 'gpt-5.6-sol-thinking', description: 'Kiro · GPT 5.6 Sol (Thinking)' },
  { id: 'deepseek-3.2', provider: 'kiro', upstream: 'deepseek-3.2', description: 'Kiro · DeepSeek 3.2 (text only)' },
  { id: 'qwen3-coder-next', provider: 'kiro', upstream: 'qwen3-coder-next', description: 'Kiro · Qwen3 Coder Next (text only)' },
  { id: 'glm-5', provider: 'kiro', upstream: 'glm-5', description: 'Kiro · GLM 5' },
  { id: 'minimax-m2.5', provider: 'kiro', upstream: 'MiniMax-M2.5', description: 'Kiro · MiniMax M2.5' },
  // Agentic variants (Kiro-specific prompt profiles)
  { id: 'claude-sonnet-4.5-agentic', provider: 'kiro', upstream: 'claude-sonnet-4.5-agentic', description: 'Kiro · Claude Sonnet 4.5 (Agentic)' },
  { id: 'claude-sonnet-5-agentic', provider: 'kiro', upstream: 'claude-sonnet-5-agentic', description: 'Kiro · Claude Sonnet 5 (Agentic)' },
  { id: 'claude-opus-5-agentic', provider: 'kiro', upstream: 'claude-opus-5-agentic', description: 'Kiro · Claude Opus 5 (Agentic)' },
  // Compat & OmniRoute baseline aliases
  { id: 'claude-sonnet-4-5', provider: 'kiro', upstream: 'claude-sonnet-4.5', description: 'Kiro · Claude Sonnet 4.5' },
  { id: 'claude-sonnet-4-5-20250929', provider: 'kiro', upstream: 'claude-sonnet-4.5', description: 'Kiro · Claude Sonnet 4.5' },
  { id: 'claude-sonnet-4', provider: 'kiro', upstream: 'claude-sonnet-4.5', description: 'Kiro · Claude Sonnet 4' },
  { id: 'claude-3-7-sonnet', provider: 'kiro', upstream: 'claude-sonnet-4.5', description: 'Kiro · Claude 3.7 Sonnet' },
  { id: 'claude-3-7-sonnet-20250219', provider: 'kiro', upstream: 'claude-sonnet-4.5', description: 'Kiro · Claude 3.7 Sonnet' },
  { id: 'claude-3-5-sonnet', provider: 'kiro', upstream: 'claude-sonnet-4.5', description: 'Kiro · Claude 3.5 Sonnet' },
  { id: 'claude-3-5-sonnet-20241022', provider: 'kiro', upstream: 'claude-sonnet-4.5', description: 'Kiro · Claude 3.5 Sonnet' },
  { id: 'claude-3-5-sonnet-latest', provider: 'kiro', upstream: 'claude-sonnet-4.5', description: 'Kiro · Claude 3.5 Sonnet' },
  { id: 'claude-3-5-haiku', provider: 'kiro', upstream: 'auto', description: 'Kiro · auto-routed haiku' },
  { id: 'claude-3-5-haiku-20241022', provider: 'kiro', upstream: 'claude-haiku-4.5', description: 'Kiro · Claude Haiku 4.5' },
  { id: 'claude-3-haiku', provider: 'kiro', upstream: 'claude-haiku-4.5', description: 'Kiro · Claude Haiku' },
  { id: 'claude-3-opus', provider: 'kiro', upstream: 'claude-opus-5', description: 'Kiro · Claude Opus' },
  { id: 'claude-3-opus-20240229', provider: 'kiro', upstream: 'claude-opus-5', description: 'Kiro · Claude Opus' },

  // ---- Antigravity (Cloud Code) ----
  { id: 'gemini-3.1-pro-high', provider: 'antigravity', upstream: 'gemini-pro-agent', description: 'Antigravity · Gemini 3.1 Pro (high)' },
  { id: 'gemini-3.1-pro-low', provider: 'antigravity', upstream: 'gemini-3.1-pro-low', description: 'Antigravity · Gemini 3.1 Pro (low)' },
  { id: 'gemini-3.7-flash-high', provider: 'antigravity', upstream: 'gemini-3.6-flash-high', description: 'Antigravity · Gemini 3.7 Flash (high)' },
  { id: 'gemini-3.7-flash-medium', provider: 'antigravity', upstream: 'gemini-3.6-flash-medium', description: 'Antigravity · Gemini 3.7 Flash (medium)' },
  { id: 'gemini-3.6-flash-high', provider: 'antigravity', upstream: 'gemini-3.6-flash-high', description: 'Antigravity · Gemini 3.6 Flash (high)' },
  { id: 'gemini-3.6-flash-medium', provider: 'antigravity', upstream: 'gemini-3.6-flash-medium', description: 'Antigravity · Gemini 3.6 Flash (medium)' },
  { id: 'gemini-3.6-flash-low', provider: 'antigravity', upstream: 'gemini-3.6-flash-low', description: 'Antigravity · Gemini 3.6 Flash (low)' },
  { id: 'gemini-3.5-flash-high', provider: 'antigravity', upstream: 'gemini-3-flash-agent', description: 'Antigravity · Gemini 3.5 Flash (high)' },
  { id: 'gemini-3.5-flash-medium', provider: 'antigravity', upstream: 'gemini-3.5-flash-low', description: 'Antigravity · Gemini 3.5 Flash (medium)' },
  { id: 'gemini-3.5-flash-low', provider: 'antigravity', upstream: 'gemini-3.5-flash-extra-low', description: 'Antigravity · Gemini 3.5 Flash (low)' },
  { id: 'gemini-3.1-flash-lite', provider: 'antigravity', upstream: 'gemini-3.1-flash-lite', description: 'Antigravity · Gemini 3.1 Flash Lite' },
  { id: 'gemini-2.5-flash', provider: 'antigravity', upstream: 'gemini-2.5-flash', description: 'Antigravity · Gemini 2.5 Flash' },
  { id: 'gemini-2.5-flash-thinking', provider: 'antigravity', upstream: 'gemini-2.5-flash-thinking', description: 'Antigravity · Gemini 2.5 Flash (Thinking)' },
  { id: 'gemini-2.5-flash-lite', provider: 'antigravity', upstream: 'gemini-2.5-flash-lite', description: 'Antigravity · Gemini 2.5 Flash Lite' },
  { id: 'claude-sonnet-4-6', provider: 'antigravity', upstream: 'claude-sonnet-4-6', description: 'Antigravity · Claude Sonnet 4.6 (thinking)' },
  { id: 'claude-opus-4-6-thinking', provider: 'antigravity', upstream: 'claude-opus-4-6-thinking', description: 'Antigravity · Claude Opus 4.6 (Thinking)' },
  { id: 'gpt-oss-120b-medium', provider: 'antigravity', upstream: 'gpt-oss-120b-medium', description: 'Antigravity · GPT-OSS 120B (medium)' },
  // Compat & OmniRoute baseline aliases
  { id: 'gemini-3-pro', provider: 'antigravity', upstream: 'gemini-pro-agent', description: 'Antigravity · Gemini 3.1 Pro (high)' },
  { id: 'gemini-3-pro-high', provider: 'antigravity', upstream: 'gemini-pro-agent', description: 'Antigravity · Gemini 3.1 Pro (high)' },
  { id: 'gemini-3.0-pro', provider: 'antigravity', upstream: 'gemini-pro-agent', description: 'Antigravity · Gemini 3.1 Pro (high)' },
  { id: 'gemini-pro-agent', provider: 'antigravity', upstream: 'gemini-pro-agent', description: 'Antigravity · Gemini Pro agent profile' },
  { id: 'gemini-3-flash', provider: 'antigravity', upstream: 'gemini-3-flash-agent', description: 'Antigravity · Gemini 3.5 Flash (high)' },
  { id: 'gemini-3.0-flash', provider: 'antigravity', upstream: 'gemini-3-flash-agent', description: 'Antigravity · Gemini 3.5 Flash (high)' },
  { id: 'gemini-2.5-pro', provider: 'antigravity', upstream: 'gemini-2.5-pro', description: 'Antigravity · Gemini 2.5 Pro' },
  { id: 'gemini-2.0-flash', provider: 'antigravity', upstream: 'gemini-2.5-flash', description: 'Antigravity · Gemini 2.5 Flash' },
  { id: 'gemini-2.0-flash-exp', provider: 'antigravity', upstream: 'gemini-2.5-flash', description: 'Antigravity · Gemini 2.5 Flash' },
  { id: 'gemini-2.0-pro', provider: 'antigravity', upstream: 'gemini-2.5-pro', description: 'Antigravity · Gemini 2.5 Pro' },
  { id: 'gemini-2.0-pro-exp', provider: 'antigravity', upstream: 'gemini-2.5-pro', description: 'Antigravity · Gemini 2.5 Pro' },
  { id: 'gemini-1.5-pro', provider: 'antigravity', upstream: 'gemini-2.5-pro', description: 'Antigravity · Gemini 2.5 Pro' },
  { id: 'gemini-1.5-flash', provider: 'antigravity', upstream: 'gemini-2.5-flash', description: 'Antigravity · Gemini 2.5 Flash' },
  { id: 'claude-sonnet-4-5-gcp', provider: 'antigravity', upstream: 'claude-sonnet-4-6', description: 'Antigravity · Claude Sonnet 4.6' },
  { id: 'gpt-oss-120b', provider: 'antigravity', upstream: 'gpt-oss-120b-medium', description: 'Antigravity · GPT-OSS 120B (medium)' },
];

export function resolveModel(requested: string): ModelEntry | undefined {
  const direct = MODEL_CATALOG.find((m) => m.id === requested);
  if (direct) return direct;
  for (const provider of ['kiro', 'antigravity'] as ProviderId[]) {
    if (requested.startsWith(`${provider}/`)) {
      return { id: requested, provider, upstream: requested.slice(provider.length + 1) };
    }
  }
  // Convenience: unqualified catalog upstream names still resolve.
  return MODEL_CATALOG.find((m) => m.upstream === requested);
}
