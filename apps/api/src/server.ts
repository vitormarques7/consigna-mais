import { createApp } from './app.js';
import { createBankAdapters } from './banks.js';
const timeout = Number(process.env.BANK_TIMEOUT_MS ?? 3000);
if (!Number.isFinite(timeout) || timeout <= 0 || timeout > 30000)
  throw new Error('BANK_TIMEOUT_MS deve estar entre 1 e 30000.');
const app = createApp(
  createBankAdapters(process.env.BANK_BASE_URL ?? 'http://localhost:4001', timeout),
  (event) => console.info(JSON.stringify(event)),
);
const server = app.listen(Number(process.env.API_PORT ?? 4000), '0.0.0.0', () =>
  console.info('API em http://localhost:4000'),
);
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.close());
