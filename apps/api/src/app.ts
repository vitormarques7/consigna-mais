import express, { type ErrorRequestHandler } from 'express';
import { randomUUID } from 'node:crypto';
import { simulationInputSchema, type BankResult } from '@consigna/contracts';
import type { BankAdapter } from './banks.js';
export type Event = {
  requestId: string;
  bankId: string;
  status: BankResult['status'];
  durationMs: number;
};
export function createApp(banks: BankAdapter[], log: (event: Event) => void = () => {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '16kb' }));
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });
  app.post('/api/simulations', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const input = simulationInputSchema.safeParse(req.body);
    if (!input.success) {
      res
        .status(400)
        .json({
          message: 'Revise os campos informados.',
          errors: input.error.flatten().fieldErrors,
        });
      return;
    }
    const requestId = randomUUID();
    const results = await Promise.all(
      banks.map(async (bank) => {
        const start = performance.now();
        let result: BankResult;
        try {
          result = await bank.simulate(input.data);
        } catch {
          result = {
            bankId: bank.id,
            bankName: bank.name,
            status: 'unavailable',
            message: 'Não conseguimos consultar este banco agora. Tente novamente em instantes.',
          };
        }
        log({
          requestId,
          bankId: bank.id,
          status: result.status,
          durationMs: Math.round(performance.now() - start),
        });
        return result;
      }),
    );
    res.json({ requestId, results });
  });
  const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
    const status =
      typeof error === 'object' && error !== null && 'status' in error ? error.status : 500;
    res
      .status(status === 400 ? 400 : status === 413 ? 413 : 500)
      .json({
        message:
          status === 400
            ? 'JSON inválido.'
            : status === 413
              ? 'Requisição muito grande.'
              : 'Não foi possível concluir a simulação.',
      });
  };
  app.use(errorHandler);
  return app;
}
