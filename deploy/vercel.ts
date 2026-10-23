import express from 'express';
import { createApp, type Event } from '../apps/api/src/app.js';
import { createBankAdapters } from '../apps/api/src/banks.js';
import { createMockApp, modes, type Mode } from '../apps/bank-mocks/src/app.js';

type Environment = Record<string, string | undefined>;

export function deploymentConfig(env: Environment) {
  const bankBaseUrl =
    env.BANK_BASE_URL ?? (env.VERCEL_URL ? `https://${env.VERCEL_URL}/api/mock-banks` : undefined);
  if (!bankBaseUrl) throw new Error('Defina VERCEL_URL ou BANK_BASE_URL para a função.');
  const url = new URL(bankBaseUrl);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
    throw new Error('BANK_BASE_URL deve ser um endereço HTTP ou HTTPS sem credenciais.');
  const timeoutMs = Number(env.BANK_TIMEOUT_MS ?? 3000);
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 30000)
    throw new Error('BANK_TIMEOUT_MS deve estar entre 1 e 30000.');
  function mode(name: string): Mode {
    const value = env[name] ?? 'normal';
    if (!modes.includes(value as Mode)) throw new Error(`${name} inválido.`);
    return value as Mode;
  }
  // Only send the platform secret to this deployment, never to a custom bank host.
  const internalOrigin = env.VERCEL_URL ? `https://${env.VERCEL_URL}` : undefined;
  const headers: Record<string, string> = {};
  if (url.origin === internalOrigin && env.VERCEL_AUTOMATION_BYPASS_SECRET)
    headers['x-vercel-protection-bypass'] = env.VERCEL_AUTOMATION_BYPASS_SECRET;
  return {
    bankBaseUrl: url.href.replace(/\/$/, ''),
    timeoutMs,
    headers,
    mockModes: { a: mode('BANK_A_MODE'), b: mode('BANK_B_MODE') },
  };
}

export function createDeploymentApp(env: Environment, log?: (event: Event) => void) {
  const config = deploymentConfig(env);
  const app = express();
  app.disable('x-powered-by');
  app.use('/api/mock-banks', createMockApp(config.mockModes));
  app.use(createApp(createBankAdapters(config.bankBaseUrl, config.timeoutMs, config.headers), log));
  return app;
}
