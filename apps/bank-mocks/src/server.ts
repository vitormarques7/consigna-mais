import { createMockApp, modes, type Mode } from './app.js';
function mode(name: string): Mode {
  const value = process.env[name] ?? 'normal';
  if (!modes.includes(value as Mode)) throw new Error(`${name} deve ser: ${modes.join(', ')}`);
  return value as Mode;
}
const server = createMockApp({ a: mode('BANK_A_MODE'), b: mode('BANK_B_MODE') }).listen(
  Number(process.env.MOCK_PORT ?? 4001),
  '0.0.0.0',
  () => console.info('Bancos simulados em http://localhost:4001'),
);
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.close());
