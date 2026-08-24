import { describe, it, expect, beforeEach } from 'vitest';
import {
  BASE_MODEL_CATALOG,
  getModelCatalog,
  registerDynamicModels,
  clearDynamicModels,
  resolveModel,
  syncModelsFromRemote,
} from '../src/models.ts';
import { fetchAntigravityModelEntries } from '../src/auth/antigravity.ts';

describe('Model Catalog & Dynamic Registry', () => {
  beforeEach(() => {
    clearDynamicModels();
  });

  it('provides base model catalog for both Kiro and Antigravity', () => {
    const catalog = getModelCatalog();
    expect(catalog.length).toBeGreaterThan(15);

    const agyFlash = catalog.find((m) => m.id === 'agy/gemini-3.7-flash');
    expect(agyFlash).toBeDefined();
    expect(agyFlash?.provider).toBe('antigravity');
    expect(agyFlash?.supportsWebSearch).toBe(true);
    expect(agyFlash?.contextLength).toBe(1048576);
    expect(agyFlash?.thinking?.levels).toContain('high');

    const kiroSonnet = catalog.find((m) => m.id === 'kiro/claude-sonnet-4.5');
    expect(kiroSonnet).toBeDefined();
    expect(kiroSonnet?.provider).toBe('kiro');
    expect(kiroSonnet?.contextLength).toBe(200000);
    expect(kiroSonnet?.thinking?.max).toBe(64000);

    // Verify zero duplicate upstreams per provider
    const pairs = catalog.map((m) => `${m.provider}:${m.upstream}`);
    const uniquePairs = new Set(pairs);
    expect(pairs.length).toBe(uniquePairs.size);
  });

  it('allows dynamic registration of new models without duplicating existing upstreams', () => {
    const initialCount = getModelCatalog().length;
    
    // Register duplicate existing upstream alongside one genuinely new model
    registerDynamicModels('antigravity', [
      {
        id: 'agy/gemini-3.7-flash-tiered',
        provider: 'antigravity',
        upstream: 'gemini-3.7-flash-tiered',
        displayName: 'Duplicate Flash Tiered',
      },
      {
        id: 'agy/claude-opus-4-6-thinking',
        provider: 'antigravity',
        upstream: 'claude-opus-4-6-thinking',
        displayName: 'Duplicate Opus',
      },
      {
        id: 'agy/gemini-future-4-ultra',
        provider: 'antigravity',
        upstream: 'gemini-future-4-ultra',
        displayName: 'Gemini 4 Ultra',
        contextLength: 2000000,
        maxCompletionTokens: 100000,
        supportsWebSearch: true,
      },
    ]);

    const updated = getModelCatalog();
    // Only the 1 genuinely new model should be added, duplicates ignored
    expect(updated.length).toBe(initialCount + 1);

    const found = updated.find((m) => m.id === 'agy/gemini-future-4-ultra');
    expect(found).toBeDefined();
    expect(found?.displayName).toBe('Gemini 4 Ultra');
    expect(found?.isDynamic).toBe(true);

    // Verify zero duplicate upstreams per provider
    const pairs = updated.map((m) => `${m.provider}:${m.upstream}`);
    const uniquePairs = new Set(pairs);
    expect(pairs.length).toBe(uniquePairs.size);
  });

  it('resolves direct IDs, prefixed IDs, unprefixed names, and dot-hyphen variants', () => {
    expect(resolveModel('kiro/claude-sonnet-4.5')?.upstream).toBe('claude-sonnet-4.5');
    expect(resolveModel('kiro/claude-sonnet-4-5')?.upstream).toBe('claude-sonnet-4.5');
    expect(resolveModel('agy/gemini-3.7-flash')?.upstream).toBe('gemini-3.7-flash-tiered');
    expect(resolveModel('antigravity/gemini-3.7-flash')?.upstream).toBe('gemini-3.7-flash-tiered');

    // Unprefixed
    expect(resolveModel('gemini-3.7-flash')?.provider).toBe('antigravity');
    expect(resolveModel('claude-sonnet-4.5')?.provider).toBe('kiro');
    expect(resolveModel('deepseek-3.2')?.provider).toBe('kiro');

    // Dynamic fallback for uncataloged future models
    expect(resolveModel('gemini-4.5-flash-pro')?.provider).toBe('antigravity');
    expect(resolveModel('claude-5-sonnet')?.provider).toBe('kiro');
  });

  it('clears dynamic registrations correctly', () => {
    registerDynamicModels('antigravity', [
      { id: 'agy/temp-model', provider: 'antigravity', upstream: 'temp-model' },
    ]);
    expect(getModelCatalog().some((m) => m.id === 'agy/temp-model')).toBe(true);

    clearDynamicModels('antigravity');
    expect(getModelCatalog().some((m) => m.id === 'agy/temp-model')).toBe(false);
  });
});
