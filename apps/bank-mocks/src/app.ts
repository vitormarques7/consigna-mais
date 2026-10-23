import express from 'express';
import { simulationInputSchema, type SimulationInput, type Offer } from '@consigna/contracts';
export const modes = ['normal', 'error', 'timeout', 'malformed'] as const;
export type Mode = (typeof modes)[number];
export function calculateOffer(
  amountCents: number,
  installments: 12 | 24 | 36,
  monthlyRatePercent: number,
): Offer {
  const rate = monthlyRatePercent / 100;
  const installmentCents = Math.round(
    rate === 0
      ? amountCents / installments
      : (amountCents * rate) / (1 - (1 + rate) ** -installments),
  );
  return {
    installmentCents,
    installments,
    monthlyRatePercent,
    totalCents: installmentCents * installments,
  };
}
export function evaluate(input: SimulationInput, bank: 'a' | 'b') {
  const offer = calculateOffer(input.amountCents, input.installments, bank === 'a' ? 1.8 : 2.2);
  // Product demo rules, not statutory payroll margins or real bank credit policies.
  return {
    approved: offer.installmentCents <= input.salaryCents * (bank === 'a' ? 0.25 : 0.3),
    offer,
  };
}
export function createMockApp(config: { a?: Mode; b?: Mode; delayMs?: number } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '16kb' }));
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });
  for (const bank of ['a', 'b'] as const) {
    app.post(`/bank-${bank}/simulate`, (req, res) => {
      const input = simulationInputSchema.safeParse(req.body);
      if (!input.success) {
        res.status(400).json({ error: 'invalid_input' });
        return;
      }
      const mode = config[bank] ?? 'normal';
      if (mode === 'error') {
        res.status(503).json({ error: 'maintenance' });
        return;
      }
      if (mode === 'malformed') {
        res.json({ unexpected: 'contract changed' });
        return;
      }
      const timer = setTimeout(
        () => {
          const { approved, offer } = evaluate(input.data, bank);
          if (bank === 'a')
            res.json(
              approved
                ? { approved: true, terms: offer }
                : { approved: false, reason: 'INSTALLMENT_EXCEEDS_MARGIN' },
            );
          else
            res.json(
              approved
                ? {
                    decision: 'ACCEPTED',
                    proposal: {
                      payment: offer.installmentCents / 100,
                      months: offer.installments,
                      rate: offer.monthlyRatePercent,
                      total: offer.totalCents / 100,
                    },
                  }
                : { decision: 'DECLINED', code: 'INCOME_LIMIT' },
            );
        },
        mode === 'timeout' ? 10000 : (config.delayMs ?? 350),
      );
      res.on('close', () => clearTimeout(timer));
    });
  }
  return app;
}
