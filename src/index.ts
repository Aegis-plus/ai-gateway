// Gateway entry point.
try {
  process.loadEnvFile?.();
} catch {}

import { join } from 'node:path';
import { Store } from './store.ts';
import { createGatewayServer } from './server.ts';
import { startQuotaLoop, refreshAllQuotas } from './quota.ts';

const dataDir = process.env.GATEWAY_DATA_DIR ?? join(process.cwd(), 'data');
const store = new Store(dataDir);

const server = createGatewayServer(store);
const { port, host } = store.config;

server.listen(port, host, () => {
  console.log(`\n  AI Gateway (Kiro + Antigravity)`);
  console.log(`  Dashboard : http://${host === '0.0.0.0' ? 'localhost' : host}:${port}/`);
  console.log(`  OpenAI    : http://${host === '0.0.0.0' ? 'localhost' : host}:${port}/v1/chat/completions`);
  console.log(`  Anthropic : http://${host === '0.0.0.0' ? 'localhost' : host}:${port}/v1/messages`);
  console.log(`  Accounts  : ${store.accounts.length} (${store.accounts.filter((a) => a.provider === 'kiro').length} kiro, ${store.accounts.filter((a) => a.provider === 'antigravity').length} antigravity)\n`);
  refreshAllQuotas(store);
  startQuotaLoop(store);
});

function shutdown() {
  console.log('\nShutting down…');
  store.flush();
  store.saveConfig();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000).unref();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
