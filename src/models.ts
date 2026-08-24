// Model catalog for Kiro and Google Antigravity.
// Models are publicly exposed with their provider prefixes:
// - Kiro models: "kiro/{modelid}"
// - Antigravity models: "agy/{modelid}"
//
// Unprefixed model names and "antigravity/..." prefixes are also supported
// transparently by resolveModel().

import type { ProviderId } from './types.ts';

export interface ModelThinking {
  min?: number;
  max?: number;
  zeroAllowed?: boolean;
  dynamicAllowed?: boolean;
  levels?: string[];
}

export interface ModelEntry {
  id: string; // public model id served by the gateway (e.g. "kiro/...", "agy/...")
  provider: ProviderId;
  upstream: string; // exact model id sent to the upstream provider
  displayName?: string;
  description?: string;
  contextLength?: number;
  maxCompletionTokens?: number;
  supportsWebSearch?: boolean;
  thinking?: ModelThinking;
  inputModalities?: string[];
  outputModalities?: string[];
  isDynamic?: boolean;
}

export const BASE_MODEL_CATALOG: ModelEntry[] = [
  // =========================================================================
  // Kiro (AWS CodeWhisperer / Q Developer Runtime) -> kiro/{modelid}
  // Free Tier Models (Included in Kiro Free Plan):
  // - Claude Sonnet 4.5 / Haiku 4.5
  // - Open-Weight: DeepSeek 3.2, Qwen3 Coder Next, MiniMax M2.5/M2.1, GLM-5
  // - Auto Routing
  // =========================================================================

  // ---- Anthropic Claude (Kiro Free Tier) ----
  {
    id: 'kiro/claude-sonnet-4.5',
    provider: 'kiro',
    upstream: 'claude-sonnet-4.5',
    displayName: 'Claude Sonnet 4.5',
    description: 'Kiro · Claude Sonnet 4.5',
    contextLength: 200000,
    maxCompletionTokens: 64000,
    thinking: { min: 1024, max: 64000, zeroAllowed: true, dynamicAllowed: true },
    inputModalities: ['text', 'image'],
    outputModalities: ['text'],
  },
  {
    id: 'kiro/claude-sonnet-4.5-thinking',
    provider: 'kiro',
    upstream: 'claude-sonnet-4.5-thinking',
    displayName: 'Claude Sonnet 4.5 (Thinking)',
    description: 'Kiro · Claude Sonnet 4.5 (Thinking)',
    contextLength: 200000,
    maxCompletionTokens: 64000,
    thinking: { min: 1024, max: 64000, zeroAllowed: true, dynamicAllowed: true },
    inputModalities: ['text', 'image'],
    outputModalities: ['text'],
  },
  {
    id: 'kiro/claude-sonnet-4.5-agentic',
    provider: 'kiro',
    upstream: 'claude-sonnet-4.5-agentic',
    displayName: 'Claude Sonnet 4.5 (Agentic)',
    description: 'Kiro · Claude Sonnet 4.5 (Agentic)',
    contextLength: 200000,
    maxCompletionTokens: 64000,
    thinking: { min: 1024, max: 64000, zeroAllowed: true, dynamicAllowed: true },
    inputModalities: ['text', 'image'],
    outputModalities: ['text'],
  },
  {
    id: 'kiro/claude-sonnet-4-5',
    provider: 'kiro',
    upstream: 'claude-sonnet-4.5',
    displayName: 'Claude Sonnet 4.5',
    description: 'Kiro · Claude Sonnet 4.5',
    contextLength: 200000,
    maxCompletionTokens: 64000,
    thinking: { min: 1024, max: 64000, zeroAllowed: true, dynamicAllowed: true },
    inputModalities: ['text', 'image'],
    outputModalities: ['text'],
  },
  {
    id: 'kiro/claude-sonnet-4-5-20250929',
    provider: 'kiro',
    upstream: 'claude-sonnet-4.5',
    displayName: 'Claude Sonnet 4.5 (20250929)',
    description: 'Kiro · Claude Sonnet 4.5',
    contextLength: 200000,
    maxCompletionTokens: 64000,
    thinking: { min: 1024, max: 64000, zeroAllowed: true, dynamicAllowed: true },
    inputModalities: ['text', 'image'],
    outputModalities: ['text'],
  },
  {
    id: 'kiro/claude-sonnet-4',
    provider: 'kiro',
    upstream: 'claude-sonnet-4.5',
    displayName: 'Claude Sonnet 4',
    description: 'Kiro · Claude Sonnet 4',
    contextLength: 200000,
    maxCompletionTokens: 64000,
    inputModalities: ['text', 'image'],
    outputModalities: ['text'],
  },
  {
    id: 'kiro/claude-haiku-4.5',
    provider: 'kiro',
    upstream: 'claude-haiku-4.5',
    displayName: 'Claude Haiku 4.5',
    description: 'Kiro · Claude Haiku 4.5',
    contextLength: 200000,
    maxCompletionTokens: 64000,
    thinking: { min: 1024, max: 64000, zeroAllowed: true, dynamicAllowed: true },
    inputModalities: ['text', 'image'],
    outputModalities: ['text'],
  },
  {
    id: 'kiro/claude-haiku-4-5',
    provider: 'kiro',
    upstream: 'claude-haiku-4.5',
    displayName: 'Claude Haiku 4.5',
    description: 'Kiro · Claude Haiku 4.5',
    contextLength: 200000,
    maxCompletionTokens: 64000,
    thinking: { min: 1024, max: 64000, zeroAllowed: true, dynamicAllowed: true },
    inputModalities: ['text', 'image'],
    outputModalities: ['text'],
  },
  {
    id: 'kiro/claude-3-7-sonnet',
    provider: 'kiro',
    upstream: 'claude-sonnet-4.5',
    displayName: 'Claude 3.7 Sonnet (Alias)',
    description: 'Kiro · Claude 3.7 Sonnet',
    contextLength: 200000,
    maxCompletionTokens: 64000,
    inputModalities: ['text', 'image'],
    outputModalities: ['text'],
  },
  {
    id: 'kiro/claude-3.7-sonnet',
    provider: 'kiro',
    upstream: 'claude-sonnet-4.5',
    displayName: 'Claude 3.7 Sonnet (Alias)',
    description: 'Kiro · Claude 3.7 Sonnet',
    contextLength: 200000,
    maxCompletionTokens: 64000,
    inputModalities: ['text', 'image'],
    outputModalities: ['text'],
  },
  {
    id: 'kiro/claude-3-7-sonnet-thinking',
    provider: 'kiro',
    upstream: 'claude-sonnet-4.5-thinking',
    displayName: 'Claude 3.7 Sonnet (Thinking Alias)',
    description: 'Kiro · Claude 3.7 Sonnet (Thinking)',
    contextLength: 200000,
    maxCompletionTokens: 64000,
    thinking: { min: 1024, max: 64000, zeroAllowed: true, dynamicAllowed: true },
    inputModalities: ['text', 'image'],
    outputModalities: ['text'],
  },
  {
    id: 'kiro/claude-3.7-sonnet-thinking',
    provider: 'kiro',
    upstream: 'claude-sonnet-4.5-thinking',
    displayName: 'Claude 3.7 Sonnet (Thinking Alias)',
    description: 'Kiro · Claude 3.7 Sonnet (Thinking)',
    contextLength: 200000,
    maxCompletionTokens: 64000,
    thinking: { min: 1024, max: 64000, zeroAllowed: true, dynamicAllowed: true },
    inputModalities: ['text', 'image'],
    outputModalities: ['text'],
  },
  {
    id: 'kiro/claude-3-5-sonnet',
    provider: 'kiro',
    upstream: 'claude-sonnet-4.5',
    displayName: 'Claude 3.5 Sonnet (Alias)',
    description: 'Kiro · Claude 3.5 Sonnet',
    contextLength: 200000,
    maxCompletionTokens: 64000,
    inputModalities: ['text', 'image'],
    outputModalities: ['text'],
  },
  {
    id: 'kiro/claude-3.5-sonnet',
    provider: 'kiro',
    upstream: 'claude-sonnet-4.5',
    displayName: 'Claude 3.5 Sonnet (Alias)',
    description: 'Kiro · Claude 3.5 Sonnet',
    contextLength: 200000,
    maxCompletionTokens: 64000,
    inputModalities: ['text', 'image'],
    outputModalities: ['text'],
  },
  {
    id: 'kiro/claude-3-5-haiku',
    provider: 'kiro',
    upstream: 'claude-haiku-4.5',
    displayName: 'Claude 3.5 Haiku (Alias)',
    description: 'Kiro · Claude 3.5 Haiku',
    contextLength: 200000,
    maxCompletionTokens: 64000,
    inputModalities: ['text', 'image'],
    outputModalities: ['text'],
  },
  {
    id: 'kiro/claude-3.5-haiku',
    provider: 'kiro',
    upstream: 'claude-haiku-4.5',
    displayName: 'Claude 3.5 Haiku (Alias)',
    description: 'Kiro · Claude 3.5 Haiku',
    contextLength: 200000,
    maxCompletionTokens: 64000,
    inputModalities: ['text', 'image'],
    outputModalities: ['text'],
  },

  // ---- Open-Weight Models (Kiro Free Tier) ----
  {
    id: 'kiro/deepseek-3.2',
    provider: 'kiro',
    upstream: 'deepseek-3.2',
    displayName: 'DeepSeek 3.2',
    description: 'Kiro · DeepSeek 3.2 (text only)',
    contextLength: 131072,
    maxCompletionTokens: 8192,
    inputModalities: ['text'],
    outputModalities: ['text'],
  },
  {
    id: 'kiro/deepseek-v3',
    provider: 'kiro',
    upstream: 'deepseek-3.2',
    displayName: 'DeepSeek V3',
    description: 'Kiro · DeepSeek V3',
    contextLength: 131072,
    maxCompletionTokens: 8192,
    inputModalities: ['text'],
    outputModalities: ['text'],
  },
  {
    id: 'kiro/deepseek-r1',
    provider: 'kiro',
    upstream: 'claude-sonnet-4.5-thinking',
    displayName: 'DeepSeek R1 (Thinking)',
    description: 'Kiro · DeepSeek R1 (Thinking)',
    contextLength: 131072,
    maxCompletionTokens: 64000,
    thinking: { min: 1024, max: 64000, zeroAllowed: true, dynamicAllowed: true },
    inputModalities: ['text'],
    outputModalities: ['text'],
  },
  {
    id: 'kiro/deepseek-coder',
    provider: 'kiro',
    upstream: 'deepseek-3.2',
    displayName: 'DeepSeek Coder',
    description: 'Kiro · DeepSeek Coder',
    contextLength: 131072,
    maxCompletionTokens: 8192,
    inputModalities: ['text'],
    outputModalities: ['text'],
  },
  {
    id: 'kiro/qwen3-coder-next',
    provider: 'kiro',
    upstream: 'qwen3-coder-next',
    displayName: 'Qwen3 Coder Next',
    description: 'Kiro · Qwen3 Coder Next (text only)',
    contextLength: 131072,
    maxCompletionTokens: 8192,
    inputModalities: ['text'],
    outputModalities: ['text'],
  },
  {
    id: 'kiro/qwen-2.5-coder-32b',
    provider: 'kiro',
    upstream: 'qwen3-coder-next',
    displayName: 'Qwen 2.5 Coder 32B',
    description: 'Kiro · Qwen 2.5 Coder 32B',
    contextLength: 131072,
    maxCompletionTokens: 8192,
    inputModalities: ['text'],
    outputModalities: ['text'],
  },
  {
    id: 'kiro/qwen-2.5-coder',
    provider: 'kiro',
    upstream: 'qwen3-coder-next',
    displayName: 'Qwen 2.5 Coder',
    description: 'Kiro · Qwen 2.5 Coder',
    contextLength: 131072,
    maxCompletionTokens: 8192,
    inputModalities: ['text'],
    outputModalities: ['text'],
  },
  {
    id: 'kiro/glm-5',
    provider: 'kiro',
    upstream: 'glm-5',
    displayName: 'GLM 5',
    description: 'Kiro · GLM 5',
    contextLength: 131072,
    maxCompletionTokens: 8192,
    inputModalities: ['text'],
    outputModalities: ['text'],
  },
  {
    id: 'kiro/glm-4-plus',
    provider: 'kiro',
    upstream: 'glm-5',
    displayName: 'GLM 4 Plus',
    description: 'Kiro · GLM 4 Plus',
    contextLength: 131072,
    maxCompletionTokens: 8192,
    inputModalities: ['text'],
    outputModalities: ['text'],
  },
  {
    id: 'kiro/minimax-m2.5',
    provider: 'kiro',
    upstream: 'MiniMax-M2.5',
    displayName: 'MiniMax M2.5',
    description: 'Kiro · MiniMax M2.5',
    contextLength: 131072,
    maxCompletionTokens: 8192,
    inputModalities: ['text'],
    outputModalities: ['text'],
  },
  {
    id: 'kiro/minimax-m2.1',
    provider: 'kiro',
    upstream: 'MiniMax-M2.5',
    displayName: 'MiniMax M2.1',
    description: 'Kiro · MiniMax M2.1',
    contextLength: 131072,
    maxCompletionTokens: 8192,
    inputModalities: ['text'],
    outputModalities: ['text'],
  },
  {
    id: 'kiro/minimax-01',
    provider: 'kiro',
    upstream: 'MiniMax-M2.5',
    displayName: 'MiniMax 01',
    description: 'Kiro · MiniMax 01',
    contextLength: 131072,
    maxCompletionTokens: 8192,
    inputModalities: ['text'],
    outputModalities: ['text'],
  },
  {
    id: 'kiro/auto',
    provider: 'kiro',
    upstream: 'auto',
    displayName: 'Auto Routing',
    description: 'Kiro · Auto Routing',
    contextLength: 200000,
    maxCompletionTokens: 64000,
    inputModalities: ['text', 'image'],
    outputModalities: ['text'],
  },

  // =========================================================================
  // Google Antigravity (Cloud Code Runtime) -> agy/{modelid}
  // Available Models & Thinking Tiers:
  // - Gemini 3.x Series (3.7 Flash, 3.6 Flash, 3.5 Flash, 3.1 Pro, 3.1 Flash Lite, 3 Pro, 3 Flash)
  // - Claude 4.6 (Sonnet & Opus Thinking)
  // - GPT-OSS 120b (Medium)
  // =========================================================================

  // ---- Gemini 3.7 Flash ----
  {
    id: 'agy/gemini-3.7-flash',
    provider: 'antigravity',
    upstream: 'gemini-3.7-flash-high',
    displayName: 'Gemini 3.7 Flash',
    description: 'Antigravity · Gemini 3.7 Flash (High Thinking)',
    contextLength: 1048576,
    maxCompletionTokens: 65536,
    supportsWebSearch: true,
    thinking: { min: 1, max: 65535, dynamicAllowed: true, levels: ['minimal', 'low', 'medium', 'high'] },
    inputModalities: ['text', 'image', 'audio', 'video'],
    outputModalities: ['text'],
  },
  {
    id: 'agy/gemini-3.7-flash-high',
    provider: 'antigravity',
    upstream: 'gemini-3.7-flash-high',
    displayName: 'Gemini 3.7 Flash (High)',
    description: 'Antigravity · Gemini 3.7 Flash (High Thinking)',
    contextLength: 1048576,
    maxCompletionTokens: 65536,
    supportsWebSearch: true,
    thinking: { min: 1, max: 65535, dynamicAllowed: true, levels: ['minimal', 'low', 'medium', 'high'] },
    inputModalities: ['text', 'image', 'audio', 'video'],
    outputModalities: ['text'],
  },
  {
    id: 'agy/gemini-3.7-flash-thinking',
    provider: 'antigravity',
    upstream: 'gemini-3.7-flash-high',
    displayName: 'Gemini 3.7 Flash (Thinking)',
    description: 'Antigravity · Gemini 3.7 Flash (Thinking)',
    contextLength: 1048576,
    maxCompletionTokens: 65536,
    supportsWebSearch: true,
    thinking: { min: 1, max: 65535, dynamicAllowed: true, levels: ['minimal', 'low', 'medium', 'high'] },
    inputModalities: ['text', 'image', 'audio', 'video'],
    outputModalities: ['text'],
  },
  {
    id: 'agy/gemini-3.7-flash-medium',
    provider: 'antigravity',
    upstream: 'gemini-3.6-flash-medium',
    displayName: 'Gemini 3.7 Flash (Medium)',
    description: 'Antigravity · Gemini 3.7 Flash (Medium Thinking)',
    contextLength: 1048576,
    maxCompletionTokens: 65536,
    supportsWebSearch: true,
    thinking: { min: 1, max: 65535, dynamicAllowed: true, levels: ['minimal', 'low', 'medium', 'high'] },
    inputModalities: ['text', 'image', 'audio', 'video'],
    outputModalities: ['text'],
  },
  {
    id: 'agy/gemini-3.7-flash-low',
    provider: 'antigravity',
    upstream: 'gemini-3.6-flash-low',
    displayName: 'Gemini 3.7 Flash (Low)',
    description: 'Antigravity · Gemini 3.7 Flash (Low Thinking)',
    contextLength: 1048576,
    maxCompletionTokens: 65536,
    supportsWebSearch: true,
    thinking: { min: 1, max: 65535, dynamicAllowed: true, levels: ['minimal', 'low', 'medium', 'high'] },
    inputModalities: ['text', 'image', 'audio', 'video'],
    outputModalities: ['text'],
  },

  // ---- Gemini 3.6 Flash ----
  {
    id: 'agy/gemini-3.6-flash',
    provider: 'antigravity',
    upstream: 'gemini-3.6-flash-high',
    displayName: 'Gemini 3.6 Flash',
    description: 'Antigravity · Gemini 3.6 Flash',
    contextLength: 1048576,
    maxCompletionTokens: 65536,
    supportsWebSearch: true,
    thinking: { min: 1, max: 65535, dynamicAllowed: true, levels: ['minimal', 'low', 'medium', 'high'] },
    inputModalities: ['text', 'image', 'audio', 'video'],
    outputModalities: ['text'],
  },
  {
    id: 'agy/gemini-3.6-flash-high',
    provider: 'antigravity',
    upstream: 'gemini-3.6-flash-high',
    displayName: 'Gemini 3.6 Flash (High)',
    description: 'Antigravity · Gemini 3.6 Flash (high)',
    contextLength: 1048576,
    maxCompletionTokens: 65536,
    supportsWebSearch: true,
    thinking: { min: 1, max: 65535, dynamicAllowed: true, levels: ['minimal', 'low', 'medium', 'high'] },
    inputModalities: ['text', 'image', 'audio', 'video'],
    outputModalities: ['text'],
  },
  {
    id: 'agy/gemini-3.6-flash-thinking',
    provider: 'antigravity',
    upstream: 'gemini-3.6-flash-high',
    displayName: 'Gemini 3.6 Flash (Thinking)',
    description: 'Antigravity · Gemini 3.6 Flash (thinking)',
    contextLength: 1048576,
    maxCompletionTokens: 65536,
    supportsWebSearch: true,
    thinking: { min: 1, max: 65535, dynamicAllowed: true, levels: ['minimal', 'low', 'medium', 'high'] },
    inputModalities: ['text', 'image', 'audio', 'video'],
    outputModalities: ['text'],
  },
  {
    id: 'agy/gemini-3.6-flash-medium',
    provider: 'antigravity',
    upstream: 'gemini-3.6-flash-medium',
    displayName: 'Gemini 3.6 Flash (Medium)',
    description: 'Antigravity · Gemini 3.6 Flash (medium)',
    contextLength: 1048576,
    maxCompletionTokens: 65536,
    supportsWebSearch: true,
    thinking: { min: 1, max: 65535, dynamicAllowed: true, levels: ['minimal', 'low', 'medium', 'high'] },
    inputModalities: ['text', 'image', 'audio', 'video'],
    outputModalities: ['text'],
  },
  {
    id: 'agy/gemini-3.6-flash-low',
    provider: 'antigravity',
    upstream: 'gemini-3.6-flash-low',
    displayName: 'Gemini 3.6 Flash (Low)',
    description: 'Antigravity · Gemini 3.6 Flash (low)',
    contextLength: 1048576,
    maxCompletionTokens: 65536,
    supportsWebSearch: true,
    thinking: { min: 1, max: 65535, dynamicAllowed: true, levels: ['minimal', 'low', 'medium', 'high'] },
    inputModalities: ['text', 'image', 'audio', 'video'],
    outputModalities: ['text'],
  },

  // ---- Gemini 3.5 Flash ----
  {
    id: 'agy/gemini-3.5-flash',
    provider: 'antigravity',
    upstream: 'gemini-3-flash-agent',
    displayName: 'Gemini 3.5 Flash',
    description: 'Antigravity · Gemini 3.5 Flash',
    contextLength: 1048576,
    maxCompletionTokens: 65536,
    supportsWebSearch: true,
    thinking: { min: 128, max: 32768, dynamicAllowed: true, levels: ['minimal', 'low', 'medium', 'high'] },
    inputModalities: ['text', 'image', 'audio', 'video'],
    outputModalities: ['text'],
  },
  {
    id: 'agy/gemini-3.5-flash-high',
    provider: 'antigravity',
    upstream: 'gemini-3-flash-agent',
    displayName: 'Gemini 3.5 Flash (High)',
    description: 'Antigravity · Gemini 3.5 Flash (high)',
    contextLength: 1048576,
    maxCompletionTokens: 65536,
    supportsWebSearch: true,
    thinking: { min: 128, max: 32768, dynamicAllowed: true, levels: ['minimal', 'low', 'medium', 'high'] },
    inputModalities: ['text', 'image', 'audio', 'video'],
    outputModalities: ['text'],
  },
  {
    id: 'agy/gemini-3.5-flash-thinking',
    provider: 'antigravity',
    upstream: 'gemini-3-flash-agent',
    displayName: 'Gemini 3.5 Flash (Thinking)',
    description: 'Antigravity · Gemini 3.5 Flash (thinking)',
    contextLength: 1048576,
    maxCompletionTokens: 65536,
    supportsWebSearch: true,
    thinking: { min: 128, max: 32768, dynamicAllowed: true, levels: ['minimal', 'low', 'medium', 'high'] },
    inputModalities: ['text', 'image', 'audio', 'video'],
    outputModalities: ['text'],
  },
  {
    id: 'agy/gemini-3.5-flash-medium',
    provider: 'antigravity',
    upstream: 'gemini-3.5-flash-low',
    displayName: 'Gemini 3.5 Flash (Medium)',
    description: 'Antigravity · Gemini 3.5 Flash (medium)',
    contextLength: 1048576,
    maxCompletionTokens: 65536,
    supportsWebSearch: true,
    thinking: { min: 128, max: 32768, dynamicAllowed: true, levels: ['minimal', 'low', 'medium', 'high'] },
    inputModalities: ['text', 'image', 'audio', 'video'],
    outputModalities: ['text'],
  },
  {
    id: 'agy/gemini-3.5-flash-low',
    provider: 'antigravity',
    upstream: 'gemini-3.5-flash-extra-low',
    displayName: 'Gemini 3.5 Flash (Low)',
    description: 'Antigravity · Gemini 3.5 Flash (low)',
    contextLength: 1048576,
    maxCompletionTokens: 65536,
    supportsWebSearch: true,
    thinking: { min: 128, max: 32768, dynamicAllowed: true, levels: ['minimal', 'low', 'medium', 'high'] },
    inputModalities: ['text', 'image', 'audio', 'video'],
    outputModalities: ['text'],
  },

  // ---- Gemini 3.1 Pro ----
  {
    id: 'agy/gemini-3.1-pro',
    provider: 'antigravity',
    upstream: 'gemini-pro-agent',
    displayName: 'Gemini 3.1 Pro',
    description: 'Antigravity · Gemini 3.1 Pro',
    contextLength: 1048576,
    maxCompletionTokens: 65535,
    supportsWebSearch: true,
    thinking: { min: 1, max: 65535, dynamicAllowed: true, levels: ['low', 'medium', 'high'] },
    inputModalities: ['text', 'image', 'audio', 'video'],
    outputModalities: ['text'],
  },
  {
    id: 'agy/gemini-3.1-pro-high',
    provider: 'antigravity',
    upstream: 'gemini-pro-agent',
    displayName: 'Gemini 3.1 Pro (High)',
    description: 'Antigravity · Gemini 3.1 Pro (high)',
    contextLength: 1048576,
    maxCompletionTokens: 65535,
    supportsWebSearch: true,
    thinking: { min: 1, max: 65535, dynamicAllowed: true, levels: ['low', 'medium', 'high'] },
    inputModalities: ['text', 'image', 'audio', 'video'],
    outputModalities: ['text'],
  },
  {
    id: 'agy/gemini-3.1-pro-thinking',
    provider: 'antigravity',
    upstream: 'gemini-pro-agent',
    displayName: 'Gemini 3.1 Pro (Thinking)',
    description: 'Antigravity · Gemini 3.1 Pro (thinking)',
    contextLength: 1048576,
    maxCompletionTokens: 65535,
    supportsWebSearch: true,
    thinking: { min: 1, max: 65535, dynamicAllowed: true, levels: ['low', 'medium', 'high'] },
    inputModalities: ['text', 'image', 'audio', 'video'],
    outputModalities: ['text'],
  },
  {
    id: 'agy/gemini-3.1-pro-low',
    provider: 'antigravity',
    upstream: 'gemini-3.1-pro-low',
    displayName: 'Gemini 3.1 Pro (Low)',
    description: 'Antigravity · Gemini 3.1 Pro (low)',
    contextLength: 1048576,
    maxCompletionTokens: 65535,
    supportsWebSearch: true,
    thinking: { min: 1, max: 65535, dynamicAllowed: true, levels: ['low', 'medium', 'high'] },
    inputModalities: ['text', 'image', 'audio', 'video'],
    outputModalities: ['text'],
  },
  {
    id: 'agy/gemini-3.1-flash-lite',
    provider: 'antigravity',
    upstream: 'gemini-3.1-flash-lite',
    displayName: 'Gemini 3.1 Flash Lite',
    description: 'Antigravity · Gemini 3.1 Flash Lite',
    contextLength: 1048576,
    maxCompletionTokens: 65535,
    supportsWebSearch: true,
    thinking: { min: 1, max: 65535, zeroAllowed: true, dynamicAllowed: true, levels: ['minimal', 'low', 'medium', 'high'] },
    inputModalities: ['text', 'image', 'audio', 'video'],
    outputModalities: ['text'],
  },

  // ---- Gemini 3 Pro & Agent Profiles ----
  {
    id: 'agy/gemini-3-pro',
    provider: 'antigravity',
    upstream: 'gemini-pro-agent',
    displayName: 'Gemini 3 Pro',
    description: 'Antigravity · Gemini 3 Pro',
    contextLength: 1048576,
    maxCompletionTokens: 65535,
    supportsWebSearch: true,
    thinking: { min: 1, max: 65535, dynamicAllowed: true, levels: ['low', 'medium', 'high'] },
    inputModalities: ['text', 'image', 'audio', 'video'],
    outputModalities: ['text'],
  },
  {
    id: 'agy/gemini-3.0-pro',
    provider: 'antigravity',
    upstream: 'gemini-pro-agent',
    displayName: 'Gemini 3.0 Pro',
    description: 'Antigravity · Gemini 3.0 Pro',
    contextLength: 1048576,
    maxCompletionTokens: 65535,
    supportsWebSearch: true,
    thinking: { min: 1, max: 65535, dynamicAllowed: true, levels: ['low', 'medium', 'high'] },
    inputModalities: ['text', 'image', 'audio', 'video'],
    outputModalities: ['text'],
  },
  {
    id: 'agy/gemini-3-pro-high',
    provider: 'antigravity',
    upstream: 'gemini-pro-agent',
    displayName: 'Gemini 3 Pro (High)',
    description: 'Antigravity · Gemini 3 Pro (high)',
    contextLength: 1048576,
    maxCompletionTokens: 65535,
    supportsWebSearch: true,
    thinking: { min: 1, max: 65535, dynamicAllowed: true, levels: ['low', 'medium', 'high'] },
    inputModalities: ['text', 'image', 'audio', 'video'],
    outputModalities: ['text'],
  },
  {
    id: 'agy/gemini-3-flash',
    provider: 'antigravity',
    upstream: 'gemini-3-flash-agent',
    displayName: 'Gemini 3 Flash',
    description: 'Antigravity · Gemini 3 Flash',
    contextLength: 1048576,
    maxCompletionTokens: 65536,
    supportsWebSearch: true,
    thinking: { min: 128, max: 32768, dynamicAllowed: true, levels: ['minimal', 'low', 'medium', 'high'] },
    inputModalities: ['text', 'image', 'audio', 'video'],
    outputModalities: ['text'],
  },
  {
    id: 'agy/gemini-3.0-flash',
    provider: 'antigravity',
    upstream: 'gemini-3-flash-agent',
    displayName: 'Gemini 3.0 Flash',
    description: 'Antigravity · Gemini 3.0 Flash',
    contextLength: 1048576,
    maxCompletionTokens: 65536,
    supportsWebSearch: true,
    thinking: { min: 128, max: 32768, dynamicAllowed: true, levels: ['minimal', 'low', 'medium', 'high'] },
    inputModalities: ['text', 'image', 'audio', 'video'],
    outputModalities: ['text'],
  },
  {
    id: 'agy/gemini-3-flash-agent',
    provider: 'antigravity',
    upstream: 'gemini-3-flash-agent',
    displayName: 'Gemini 3 Flash Agent',
    description: 'Antigravity · Gemini 3 Flash Agent',
    contextLength: 1048576,
    maxCompletionTokens: 65536,
    supportsWebSearch: true,
    thinking: { min: 128, max: 32768, dynamicAllowed: true, levels: ['minimal', 'low', 'medium', 'high'] },
    inputModalities: ['text', 'image', 'audio', 'video'],
    outputModalities: ['text'],
  },
  {
    id: 'agy/gemini-pro-agent',
    provider: 'antigravity',
    upstream: 'gemini-pro-agent',
    displayName: 'Gemini Pro Agent',
    description: 'Antigravity · Gemini Pro Agent Profile',
    contextLength: 1048576,
    maxCompletionTokens: 65535,
    supportsWebSearch: true,
    thinking: { min: 1, max: 65535, dynamicAllowed: true, levels: ['low', 'medium', 'high'] },
    inputModalities: ['text', 'image', 'audio', 'video'],
    outputModalities: ['text'],
  },

  // ---- Claude 4.6 Hosted on GCP (Antigravity) ----
  {
    id: 'agy/claude-sonnet-4.6',
    provider: 'antigravity',
    upstream: 'claude-sonnet-4-6',
    displayName: 'Claude Sonnet 4.6 (Thinking)',
    description: 'Antigravity · Claude Sonnet 4.6 (thinking)',
    contextLength: 200000,
    maxCompletionTokens: 64000,
    thinking: { min: 1024, max: 64000, zeroAllowed: true, dynamicAllowed: true },
    inputModalities: ['text', 'image'],
    outputModalities: ['text'],
  },
  {
    id: 'agy/claude-sonnet-4-6',
    provider: 'antigravity',
    upstream: 'claude-sonnet-4-6',
    displayName: 'Claude Sonnet 4.6 (Thinking)',
    description: 'Antigravity · Claude Sonnet 4.6 (thinking)',
    contextLength: 200000,
    maxCompletionTokens: 64000,
    thinking: { min: 1024, max: 64000, zeroAllowed: true, dynamicAllowed: true },
    inputModalities: ['text', 'image'],
    outputModalities: ['text'],
  },
  {
    id: 'agy/claude-sonnet-4.6-thinking',
    provider: 'antigravity',
    upstream: 'claude-sonnet-4-6',
    displayName: 'Claude Sonnet 4.6 (Thinking)',
    description: 'Antigravity · Claude Sonnet 4.6 (thinking)',
    contextLength: 200000,
    maxCompletionTokens: 64000,
    thinking: { min: 1024, max: 64000, zeroAllowed: true, dynamicAllowed: true },
    inputModalities: ['text', 'image'],
    outputModalities: ['text'],
  },
  {
    id: 'agy/claude-sonnet-4-6-thinking',
    provider: 'antigravity',
    upstream: 'claude-sonnet-4-6',
    displayName: 'Claude Sonnet 4.6 (Thinking)',
    description: 'Antigravity · Claude Sonnet 4.6 (thinking)',
    contextLength: 200000,
    maxCompletionTokens: 64000,
    thinking: { min: 1024, max: 64000, zeroAllowed: true, dynamicAllowed: true },
    inputModalities: ['text', 'image'],
    outputModalities: ['text'],
  },
  {
    id: 'agy/claude-opus-4.6',
    provider: 'antigravity',
    upstream: 'claude-opus-4-6-thinking',
    displayName: 'Claude Opus 4.6 (Thinking)',
    description: 'Antigravity · Claude Opus 4.6 (thinking)',
    contextLength: 200000,
    maxCompletionTokens: 64000,
    thinking: { min: 1024, max: 64000, zeroAllowed: true, dynamicAllowed: true },
    inputModalities: ['text', 'image'],
    outputModalities: ['text'],
  },
  {
    id: 'agy/claude-opus-4-6',
    provider: 'antigravity',
    upstream: 'claude-opus-4-6-thinking',
    displayName: 'Claude Opus 4.6 (Thinking)',
    description: 'Antigravity · Claude Opus 4.6 (thinking)',
    contextLength: 200000,
    maxCompletionTokens: 64000,
    thinking: { min: 1024, max: 64000, zeroAllowed: true, dynamicAllowed: true },
    inputModalities: ['text', 'image'],
    outputModalities: ['text'],
  },
  {
    id: 'agy/claude-opus-4.6-thinking',
    provider: 'antigravity',
    upstream: 'claude-opus-4-6-thinking',
    displayName: 'Claude Opus 4.6 (Thinking)',
    description: 'Antigravity · Claude Opus 4.6 (thinking)',
    contextLength: 200000,
    maxCompletionTokens: 64000,
    thinking: { min: 1024, max: 64000, zeroAllowed: true, dynamicAllowed: true },
    inputModalities: ['text', 'image'],
    outputModalities: ['text'],
  },
  {
    id: 'agy/claude-opus-4-6-thinking',
    provider: 'antigravity',
    upstream: 'claude-opus-4-6-thinking',
    displayName: 'Claude Opus 4.6 (Thinking)',
    description: 'Antigravity · Claude Opus 4.6 (thinking)',
    contextLength: 200000,
    maxCompletionTokens: 64000,
    thinking: { min: 1024, max: 64000, zeroAllowed: true, dynamicAllowed: true },
    inputModalities: ['text', 'image'],
    outputModalities: ['text'],
  },

  // ---- Open Source on GCP (Antigravity) ----
  {
    id: 'agy/gpt-oss-120b',
    provider: 'antigravity',
    upstream: 'gpt-oss-120b-medium',
    displayName: 'GPT-OSS 120B',
    description: 'Antigravity · GPT-OSS 120B',
    contextLength: 114000,
    maxCompletionTokens: 32768,
    inputModalities: ['text'],
    outputModalities: ['text'],
  },
  {
    id: 'agy/gpt-oss-120b-medium',
    provider: 'antigravity',
    upstream: 'gpt-oss-120b-medium',
    displayName: 'GPT-OSS 120B (Medium)',
    description: 'Antigravity · GPT-OSS 120B (medium)',
    contextLength: 114000,
    maxCompletionTokens: 32768,
    inputModalities: ['text'],
    outputModalities: ['text'],
  },
];

// In-memory dynamic model registry
const dynamicRegistry = new Map<string, ModelEntry>();

// Remote model catalog URLs (mirrors CLIProxyAPI)
export const REMOTE_MODELS_URLS = [
  'https://raw.githubusercontent.com/router-for-me/models/refs/heads/main/models.json',
  'https://models.router-for.me/models.json',
];

/**
 * Returns all active models combining the base static catalog and dynamic runtime registrations.
 */
export function getModelCatalog(): ModelEntry[] {
  const merged = new Map<string, ModelEntry>();
  for (const m of BASE_MODEL_CATALOG) {
    merged.set(m.id, { ...m });
  }
  for (const [id, m] of dynamicRegistry.entries()) {
    const existing = merged.get(id);
    if (existing) {
      merged.set(id, { ...existing, ...m });
    } else {
      merged.set(id, { ...m });
    }
  }
  return Array.from(merged.values());
}

/** Backward compatibility alias for MODEL_CATALOG */
export const MODEL_CATALOG: ModelEntry[] = BASE_MODEL_CATALOG;

/**
 * Registers dynamically fetched models from an active provider (e.g. Antigravity Cloud Code Pa API).
 */
export function registerDynamicModels(provider: ProviderId, models: ModelEntry[]): number {
  let count = 0;
  for (const model of models) {
    if (!model || !model.id) continue;
    const prefix = provider === 'antigravity' ? 'agy/' : 'kiro/';
    const normalizedId = model.id.startsWith(prefix) ? model.id : `${prefix}${model.id.replace(/^(kiro|agy|antigravity)\//, '')}`;
    const entry: ModelEntry = {
      ...model,
      id: normalizedId,
      provider,
      isDynamic: true,
    };
    dynamicRegistry.set(normalizedId, entry);
    count++;
  }
  return count;
}

/**
 * Clears dynamically registered models for a provider or all.
 */
export function clearDynamicModels(provider?: ProviderId): void {
  if (!provider) {
    dynamicRegistry.clear();
    return;
  }
  for (const [id, entry] of dynamicRegistry.entries()) {
    if (entry.provider === provider) {
      dynamicRegistry.delete(id);
    }
  }
}

/**
 * Synchronizes model definitions from remote models.json catalogs (with graceful fallback).
 */
export async function syncModelsFromRemote(timeoutMs = 8000): Promise<{ success: boolean; added: number; sourceUrl?: string }> {
  for (const url of REMOTE_MODELS_URLS) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) continue;
      const data = (await res.json()) as Record<string, any>;
      if (!data || typeof data !== 'object') continue;

      let added = 0;
      // 1. Process Antigravity section
      if (Array.isArray(data.antigravity)) {
        const agyEntries: ModelEntry[] = [];
        for (const item of data.antigravity) {
          if (!item?.id) continue;
          const rawId = String(item.id).trim();
          if (!rawId) continue;
          agyEntries.push({
            id: `agy/${rawId}`,
            provider: 'antigravity',
            upstream: rawId,
            displayName: item.display_name || item.name || rawId,
            description: item.description || `Antigravity · ${item.display_name || rawId}`,
            contextLength: item.context_length || item.maxTokens,
            maxCompletionTokens: item.max_completion_tokens || item.maxOutputTokens,
            supportsWebSearch: Boolean(item.supports_web_search),
            thinking: item.thinking,
            inputModalities: item.supportedInputModalities,
            outputModalities: item.supportedOutputModalities,
            isDynamic: true,
          });
        }
        added += registerDynamicModels('antigravity', agyEntries);
      }

      // 2. Process Claude section for Kiro aliases
      if (Array.isArray(data.claude)) {
        const kiroEntries: ModelEntry[] = [];
        for (const item of data.claude) {
          if (!item?.id) continue;
          const rawId = String(item.id).trim();
          if (!rawId) continue;
          kiroEntries.push({
            id: `kiro/${rawId}`,
            provider: 'kiro',
            upstream: rawId,
            displayName: item.display_name || rawId,
            description: item.description || `Kiro · ${item.display_name || rawId}`,
            contextLength: item.context_length,
            maxCompletionTokens: item.max_completion_tokens,
            thinking: item.thinking,
            inputModalities: item.supportedInputModalities,
            outputModalities: item.supportedOutputModalities,
            isDynamic: true,
          });
        }
        added += registerDynamicModels('kiro', kiroEntries);
      }

      return { success: true, added, sourceUrl: url };
    } catch {
      // Try next remote URL
    }
  }
  return { success: false, added: 0 };
}

/**
 * Resolves a requested model name to its catalog entry or dynamic upstream definition.
 *
 * Resolution strategy:
 * 1. Direct match on `id` (e.g. `kiro/claude-sonnet-4.5`, `agy/gemini-3.7-flash`).
 * 2. Prefix mapping (`kiro/...`, `agy/...`, `antigravity/...`).
 * 3. Unprefixed match against live catalog items (e.g. `gemini-3.7-flash` -> `agy/gemini-3.7-flash`).
 * 4. Dot/hyphen normalization (e.g. `kiro/claude-sonnet-4-5` <-> `kiro/claude-sonnet-4.5`).
 * 5. Upstream ID match.
 * 6. Dynamic family-based inference for future uncataloged models.
 */
export function resolveModel(requested: string): ModelEntry | undefined {
  if (!requested || typeof requested !== 'string') return undefined;

  const catalog = getModelCatalog();

  // 1. Direct match on full ID
  const direct = catalog.find((m) => m.id === requested);
  if (direct) return direct;

  // 2. Normalize prefixes: "antigravity/" -> "agy/"
  let normalizedRequested = requested;
  if (requested.startsWith('antigravity/')) {
    normalizedRequested = `agy/${requested.slice('antigravity/'.length)}`;
    const agyMatch = catalog.find((m) => m.id === normalizedRequested);
    if (agyMatch) return agyMatch;
  }

  // 3. Dot/hyphen normalized direct match
  const dotNorm = normalizedRequested.replace(/\./g, '-');
  const directNorm = catalog.find((m) => m.id.replace(/\./g, '-') === dotNorm);
  if (directNorm) return directNorm;

  // 4. Explicit prefix handling (e.g. "kiro/...", "agy/...", "antigravity/...")
  if (requested.startsWith('kiro/')) {
    const raw = requested.slice('kiro/'.length);
    const cat = catalog.find(
      (m) => m.provider === 'kiro' && (m.id === requested || m.upstream === raw || m.upstream.replace(/\./g, '-') === raw.replace(/\./g, '-'))
    );
    return cat ?? { id: requested, provider: 'kiro', upstream: raw };
  }

  if (requested.startsWith('agy/') || requested.startsWith('antigravity/')) {
    const raw = requested.startsWith('agy/') ? requested.slice('agy/'.length) : requested.slice('antigravity/'.length);
    const cat = catalog.find(
      (m) => m.provider === 'antigravity' && (m.id === `agy/${raw}` || m.upstream === raw || m.upstream.replace(/\./g, '-') === raw.replace(/\./g, '-'))
    );
    return cat ?? { id: `agy/${raw}`, provider: 'antigravity', upstream: raw };
  }

  // 5. Unprefixed match against catalog items (e.g. user sends "gemini-3.7-flash" or "claude-sonnet-4.5")
  const bareMatch = catalog.find((m) => {
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
