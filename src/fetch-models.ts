// Command fetch-models connects to the Google Antigravity (Cloud Code Pa) API
// using stored auth credentials or an explicit token and saves the dynamically
// fetched model list to a JSON file for inspection or offline use.
//
// Usage:
//   npx tsx src/fetch-models.ts [options]
//
// Options:
//   --token <token>     Direct access token to use for query
//   --project <id>      Project ID to query
//   --account <id>      Account email or ID to load from data directory
//   --output <path>     Output JSON file path (default: "antigravity_models.json")
//   --remote            Also test syncing from remote models.json catalog
//   --help              Show this help message

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Store } from './store.ts';
import { fetchAntigravityModelEntries, getValidAccessToken } from './auth/antigravity.ts';
import { syncModelsFromRemote, getModelCatalog } from './models.ts';
import type { AntigravityCreds } from './types.ts';

async function main() {
  const args = process.argv.slice(2);
  let directToken = '';
  let projectId = '';
  let accountSelector = '';
  let outputPath = 'antigravity_models.json';
  let testRemote = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--token' && args[i + 1]) directToken = args[++i]!;
    else if (arg === '--project' && args[i + 1]) projectId = args[++i]!;
    else if (arg === '--account' && args[i + 1]) accountSelector = args[++i]!;
    else if (arg === '--output' && args[i + 1]) outputPath = args[++i]!;
    else if (arg === '--remote') testRemote = true;
    else if (arg === '--help' || arg === '-h') {
      console.log(`
AI Gateway Model Fetcher
Usage: npx tsx src/fetch-models.ts [options]

Options:
  --token <token>     Direct Google OAuth access token
  --project <id>      Google Cloud companion project ID
  --account <id>      Account ID or email from data directory
  --output <path>     Output JSON path (default: antigravity_models.json)
  --remote            Test syncing from remote models.json repository
  --help              Show this help
`);
      process.exit(0);
    }
  }

  if (testRemote) {
    console.log('Fetching remote model catalog definitions...');
    const res = await syncModelsFromRemote();
    console.log(`Remote sync completed: success=${res.success}, added=${res.added}, source=${res.sourceUrl ?? 'none'}`);
  }

  let token = directToken;
  let selectedAccountEmail = '';

  if (!token) {
    const dataDir = process.env.GATEWAY_DATA_DIR ?? join(process.cwd(), 'data');
    const store = new Store(dataDir);
    const agyAccounts = store.accounts.filter((a) => a.provider === 'antigravity');

    if (agyAccounts.length === 0) {
      console.error('No Antigravity accounts found in data store.');
      console.error('Either log in via the dashboard or provide --token <access_token>.');
      process.exit(1);
    }

    const chosen = accountSelector
      ? agyAccounts.find((a) => a.id === accountSelector || a.email === accountSelector || a.label === accountSelector)
      : agyAccounts.find((a) => a.status.state !== 'expired') ?? agyAccounts[0];

    if (!chosen) {
      console.error(`Antigravity account matching "${accountSelector}" not found.`);
      process.exit(1);
    }

    selectedAccountEmail = chosen.email ?? chosen.id;
    projectId = projectId || (chosen.providerData?.projectId ?? '');
    console.log(`Using Antigravity account: ${selectedAccountEmail} (project: ${projectId || 'default'})`);
    token = await getValidAccessToken(chosen.credentials as AntigravityCreds);
  }

  console.log('Fetching available models from Antigravity upstream (Cloud Code Pa)...');
  const models = await fetchAntigravityModelEntries(token, projectId);

  if (models.length === 0) {
    console.warn('Warning: No models returned from upstream API (token may be expired or API unavailable).');
  } else {
    console.log(`Successfully fetched ${models.length} models from Antigravity:`);
    console.log('--------------------------------------------------------------------------------');
    for (const m of models) {
      const searchFlag = m.supportsWebSearch ? ' [🔍 WebSearch]' : '';
      const thinkingInfo = m.thinking ? ` (Thinking: ${m.thinking.levels?.join('/') ?? `${m.thinking.min}-${m.thinking.max}`})` : '';
      const ctx = m.contextLength ? `${Math.round(m.contextLength / 1024)}k ctx` : '';
      console.log(`  • ${m.id.padEnd(36)} -> ${m.upstream.padEnd(28)} ${ctx.padEnd(10)}${searchFlag}${thinkingInfo}`);
    }
    console.log('--------------------------------------------------------------------------------');
  }

  const payload = {
    timestamp: new Date().toISOString(),
    account: selectedAccountEmail || 'direct-token',
    project: projectId || null,
    modelsCount: models.length,
    models,
    fullCatalog: getModelCatalog(),
  };

  writeFileSync(outputPath, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`Model definitions saved to: ${outputPath}\n`);
}

main().catch((err) => {
  console.error('Error fetching models:', err);
  process.exit(1);
});
