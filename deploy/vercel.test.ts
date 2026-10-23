import { afterEach, describe, expect, it, vi } from 'vitest';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import request from 'supertest';
import { exampleInput, simulationResponseSchema } from '@consigna/contracts';
import { createDeploymentApp, deploymentConfig } from './vercel.js';

const servers: Server[] = [];
afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.closeAllConnections();
          server.close(() => resolve());
        }),
    ),
  );
});

async function deployment(overrides: Record<string, string> = {}, entrypoint = false) {
  const server = createServer();
  servers.push(server);
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const bankBaseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/mock-banks`;
  if (entrypoint) {
    vi.stubEnv('BANK_BASE_URL', bankBaseUrl);
    const { default: app } = await import('../api/index.js');
    server.on('request', app);
    return app;
  }
  const app = createDeploymentApp({ BANK_BASE_URL: bankBaseUrl, ...overrides });
  server.on('request', app);
  return app;
}

describe('Vercel deployment', () => {
  it('exports a working function with health, mocks and real HTTP simulation', async () => {
    const app = await deployment({}, true);
    await request(app).get('/api/health').expect(200, { status: 'ok' });
    await request(app).get('/api/mock-banks/health').expect(200, { status: 'ok' });
    const response = await request(app).post('/api/simulations').send(exampleInput).expect(200);
    expect(
      simulationResponseSchema.parse(response.body).results.map((result) => result.status),
    ).toEqual(['approved', 'approved']);
  });
  it('preserves partial results when a hosted mock fails', async () => {
    const app = await deployment({ BANK_B_MODE: 'error' });
    const response = await request(app).post('/api/simulations').send(exampleInput).expect(200);
    expect(response.body.results.map((result: { status: string }) => result.status)).toEqual([
      'approved',
      'unavailable',
    ]);
  });
  it('targets the deployment URL and supports protected previews', () => {
    const config = deploymentConfig({
      VERCEL_URL: 'preview.example.vercel.app',
      VERCEL_AUTOMATION_BYPASS_SECRET: 'test-only-secret',
    });
    expect(config.bankBaseUrl).toBe('https://preview.example.vercel.app/api/mock-banks');
    expect(config.headers).toEqual({ 'x-vercel-protection-bypass': 'test-only-secret' });
  });
  it('never sends the preview secret to a custom bank origin', () => {
    const config = deploymentConfig({
      VERCEL_URL: 'preview.example.vercel.app',
      BANK_BASE_URL: 'https://other.example.com',
      VERCEL_AUTOMATION_BYPASS_SECRET: 'test-only-secret',
    });
    expect(config.headers).toEqual({});
  });
  it.each([
    {},
    { BANK_BASE_URL: 'file:///tmp' },
    { BANK_BASE_URL: 'https://user:password@example.com' },
    { VERCEL_URL: 'demo.vercel.app', BANK_TIMEOUT_MS: '0' },
    { VERCEL_URL: 'demo.vercel.app', BANK_A_MODE: 'unknown' },
  ])('fails early for invalid configuration %j', (env) => {
    expect(() => deploymentConfig(env)).toThrow();
  });
});
