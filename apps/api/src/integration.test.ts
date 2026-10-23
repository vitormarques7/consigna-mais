import { afterEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { exampleInput, simulationResponseSchema } from '@consigna/contracts';
import { createApp, type Event } from './app.js';
import { createBankAdapters } from './banks.js';
import { createMockApp, type Mode } from '../../bank-mocks/src/app.js';
const servers: Server[] = [];
afterEach(async () => {
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
async function setup(config: { a?: Mode; b?: Mode; delayMs?: number } = {}, timeoutMs = 500) {
  const server = createMockApp({ delayMs: 0, ...config }).listen(0, '127.0.0.1');
  servers.push(server);
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const events: Event[] = [];
  const app = createApp(
    createBankAdapters(`http://127.0.0.1:${(server.address() as AddressInfo).port}`, timeoutMs),
    (event) => events.push(event),
  );
  return { app, events };
}
describe('simulation through actual HTTP bank endpoints', () => {
  it('normalizes both contracts and monetary units', async () => {
    const { app, events } = await setup();
    const response = await request(app).post('/api/simulations').send(exampleInput).expect(200);
    const result = simulationResponseSchema.parse(response.body);
    expect(result.results.map((bank) => bank.status)).toEqual(['approved', 'approved']);
    const first = result.results[0]!;
    expect(first.status === 'approved' && first.offer.installmentCents).toBe(77521);
    expect(events).toHaveLength(2);
    expect(JSON.stringify(events)).not.toContain(exampleInput.cpf);
    expect(Object.keys(events[0]!).sort()).toEqual(['bankId', 'durationMs', 'requestId', 'status']);
    expect(response.headers['cache-control']).toBe('no-store');
  });
  it('rejects invalid input before consulting any bank', async () => {
    const { app, events } = await setup();
    const response = await request(app)
      .post('/api/simulations')
      .send({ ...exampleInput, salaryCents: -1 })
      .expect(400);
    expect(response.body.errors.salaryCents).toBeDefined();
    expect(events).toHaveLength(0);
  });
  it('rejects malformed JSON with a safe response', async () => {
    const { app } = await setup();
    await request(app)
      .post('/api/simulations')
      .set('content-type', 'application/json')
      .send('{')
      .expect(400);
  });
  it('rejects loans below the minimum before consulting banks', async () => {
    const { app, events } = await setup();
    const response = await request(app)
      .post('/api/simulations')
      .send({ ...exampleInput, amountCents: 1 })
      .expect(400);
    expect(response.body.errors.amountCents).toEqual([
      'O valor mínimo desta demonstração é R$ 100,00.',
    ]);
    expect(events).toHaveLength(0);
  });
  it('rejects oversized requests without exposing internal errors', async () => {
    const { app } = await setup();
    const response = await request(app)
      .post('/api/simulations')
      .send({ ...exampleInput, name: 'a'.repeat(17000) })
      .expect(413);
    expect(response.body).toEqual({ message: 'Requisição muito grande.' });
  });
  it('returns business rejection rather than technical failure', async () => {
    const { app } = await setup();
    const response = await request(app)
      .post('/api/simulations')
      .send({ ...exampleInput, salaryCents: 100000 })
      .expect(200);
    expect(response.body.results.map((bank: { status: string }) => bank.status)).toEqual([
      'rejected',
      'rejected',
    ]);
  });
  it('supports different bank decisions for the same applicant', async () => {
    const { app } = await setup();
    const response = await request(app)
      .post('/api/simulations')
      .send({ ...exampleInput, salaryCents: 280000 })
      .expect(200);
    expect(response.body.results.map((bank: { status: string }) => bank.status)).toEqual([
      'rejected',
      'approved',
    ]);
  });
  it.each(['error', 'malformed', 'timeout'] as const)(
    'isolates bank B %s and preserves bank A',
    async (mode) => {
      const { app } = await setup({ b: mode }, 100);
      const response = await request(app).post('/api/simulations').send(exampleInput).expect(200);
      expect(response.body.results.map((bank: { status: string }) => bank.status)).toEqual([
        'approved',
        'unavailable',
      ]);
    },
  );
  it('reports both unavailable without declaring credit rejection', async () => {
    const { app } = await setup({ a: 'error', b: 'error' });
    const response = await request(app).post('/api/simulations').send(exampleInput).expect(200);
    expect(response.body.results.map((bank: { status: string }) => bank.status)).toEqual([
      'unavailable',
      'unavailable',
    ]);
  });
  it('starts both banks concurrently', async () => {
    let started = 0;
    let release!: () => void;
    const barrier = new Promise<void>((resolve) => {
      release = resolve;
    });
    const app = createApp(
      ['a', 'b'].map((id) => ({
        id,
        name: id,
        async simulate() {
          started++;
          if (started === 2) release();
          await barrier;
          return { bankId: id, bankName: id, status: 'rejected' as const, message: 'test' };
        },
      })),
    );
    await request(app).post('/api/simulations').send(exampleInput).expect(200);
    expect(started).toBe(2);
  });
});
