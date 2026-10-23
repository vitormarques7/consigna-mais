import { z } from 'zod';
import { offerSchema, type BankResult, type SimulationInput } from '@consigna/contracts';
export interface BankAdapter {
  id: string;
  name: string;
  simulate(input: SimulationInput): Promise<BankResult>;
}
const alphaSchema = z.discriminatedUnion('approved', [
  z.object({ approved: z.literal(true), terms: offerSchema }),
  z.object({ approved: z.literal(false), reason: z.literal('INSTALLMENT_EXCEEDS_MARGIN') }),
]);
const betaSchema = z.discriminatedUnion('decision', [
  z.object({
    decision: z.literal('ACCEPTED'),
    proposal: z.object({
      payment: z.number().positive(),
      months: z.number(),
      rate: z.number(),
      total: z.number().positive(),
    }),
  }),
  z.object({ decision: z.literal('DECLINED'), code: z.literal('INCOME_LIMIT') }),
]);
export function createBankAdapters(
  baseUrl: string,
  timeoutMs = 3000,
  headers: Record<string, string> = {},
): BankAdapter[] {
  return (['a', 'b'] as const).map((bank) => {
    const id = `bank-${bank}`;
    const name = bank === 'a' ? 'Banco Aurora' : 'Banco Horizonte';
    return {
      id,
      name,
      async simulate(input) {
        // fetch cancellation covers headers AND body parsing, including a stalled body.
        const response = await fetch(`${baseUrl}/${id}/simulate`, {
          method: 'POST',
          headers: { ...headers, 'content-type': 'application/json' },
          body: JSON.stringify(input),
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (!response.ok) throw new Error('Bank HTTP failure');
        const body: unknown = await response.json();
        const info = { bankId: id, bankName: name };
        if (bank === 'a') {
          const data = alphaSchema.parse(body);
          if (!data.approved)
            return {
              ...info,
              status: 'rejected',
              message: 'A parcela ultrapassa o limite de renda desta instituição.',
            };
          if (data.terms.installments !== input.installments) throw new Error('Mismatched term');
          return {
            ...info,
            status: 'approved',
            message: 'Uma possibilidade para o seu próximo passo.',
            offer: data.terms,
          };
        }
        const data = betaSchema.parse(body);
        if (data.decision === 'DECLINED')
          return {
            ...info,
            status: 'rejected',
            message: 'A parcela ultrapassa o limite de renda desta instituição.',
          };
        const offer = offerSchema.parse({
          installmentCents: Math.round(data.proposal.payment * 100),
          installments: data.proposal.months,
          monthlyRatePercent: data.proposal.rate,
          totalCents: Math.round(data.proposal.total * 100),
        });
        if (offer.installments !== input.installments) throw new Error('Mismatched term');
        return {
          ...info,
          status: 'approved',
          message: 'Uma possibilidade para o seu próximo passo.',
          offer,
        };
      },
    };
  });
}
