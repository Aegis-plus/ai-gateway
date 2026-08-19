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
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : (process.env.GATEWAY_PORT ? parseInt(process.env.GATEWAY_PORT, 10) : (store.config.port || 8787));
const host = process.env.HOST ?? process.env.BIND_HOST ?? (store.config.host && store.config.host !== '127.0.0.1' ? store.config.host : '0.0.0.0');

server.on('error', (err: NodeJS.ErrnoException) => {
  console.error(`[gateway] server failed to start on ${host}:${port}:`, err.message);
  process.exit(1);
});

server.listen(port, host, () => {
  console.log(`\n  AI Gateway (Kiro + Antigravity)`);
  console.log(`  Dashboard : http://${host === '0.0.0.0' ? 'localhost' : host}:${port}/`);
  console.log(`  OpenAI    : http://${host === '0.0.0.0' ? 'localhost' : host}:${port}/v1/chat/completions`);
  console.log(`  Anthropic : http://${host === '0.0.0.0' ? 'localhost' : host}:${port}/v1/messages`);
  console.log(`  Accounts  : ${store.accounts.length} (${store.accounts.filter((a) => a.provider === 'kiro').length} kiro, ${store.accounts.filter((a) => a.provider === 'antigravity').length} antigravity)\n`);
  try {
    refreshAllQuotas(store);
    startQuotaLoop(store);
  } catch (err) {
    console.warn('[gateway] quota loop initialization notice:', err);
  }
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
