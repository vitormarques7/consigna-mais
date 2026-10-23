import { z } from 'zod';

// Document identifiers stay strings to preserve leading zeros and CNPJ letters.
export function validCpf(value: string): boolean {
  if (!/^\d{11}$/.test(value) || /^(\d)\1{10}$/.test(value)) return false;
  for (const length of [9, 10]) {
    const sum = [...value.slice(0, length)].reduce(
      (total, digit, i) => total + Number(digit) * (length + 1 - i),
      0,
    );
    const check = ((sum * 10) % 11) % 10;
    if (check !== Number(value[length])) return false;
  }
  return true;
}
export function validCnpj(value: string): boolean {
  if (!/^[A-Z0-9]{12}\d{2}$/.test(value) || /^(\d)\1{13}$/.test(value)) return false;
  for (const length of [12, 13]) {
    const sum = [...value.slice(0, length)]
      .reverse()
      .reduce((total, char, i) => total + (char.charCodeAt(0) - 48) * (2 + (i % 8)), 0);
    const remainder = sum % 11;
    if (Number(value[length]) !== (remainder < 2 ? 0 : 11 - remainder)) return false;
  }
  return true;
}
const documentText = z.string().transform((value) => value.replace(/[.\-/\s]/g, '').toUpperCase());
const money = z
  .number({ invalid_type_error: 'Informe um valor monetário válido.' })
  .int('Use valores com até duas casas decimais.')
  .positive('Informe um valor maior que zero.')
  .max(100_000_000, 'O limite desta demonstração é R$ 1 milhão.');
export const simulationInputSchema = z
  .object({
    name: z.string().trim().min(3, 'Informe seu nome completo.').max(120),
    email: z.string().trim().email('Informe um e-mail válido.').max(254),
    cpf: documentText.refine(validCpf, 'Informe um CPF válido.'),
    employerCnpj: documentText.refine(validCnpj, 'Informe um CNPJ válido.'),
    salaryCents: money,
    amountCents: money.min(10_000, 'O valor mínimo desta demonstração é R$ 100,00.'),
    installments: z.union([z.literal(12), z.literal(24), z.literal(36)], {
      errorMap: () => ({ message: 'Escolha 12, 24 ou 36 meses.' }),
    }),
  })
  .strict();
export type SimulationInput = z.infer<typeof simulationInputSchema>;
export const offerSchema = z
  .object({
    installmentCents: z.number().int().positive().safe(),
    installments: z.union([z.literal(12), z.literal(24), z.literal(36)]),
    monthlyRatePercent: z.number().min(0).max(100),
    totalCents: z.number().int().positive().safe(),
  })
  .refine(
    (offer) => offer.totalCents === offer.installmentCents * offer.installments,
    'Total inconsistente.',
  );
export type Offer = z.infer<typeof offerSchema>;
const bankInfo = { bankId: z.string(), bankName: z.string(), message: z.string() };
export const bankResultSchema = z.discriminatedUnion('status', [
  z.object({ ...bankInfo, status: z.literal('approved'), offer: offerSchema }),
  z.object({ ...bankInfo, status: z.literal('rejected') }),
  z.object({ ...bankInfo, status: z.literal('unavailable') }),
]);
export type BankResult = z.infer<typeof bankResultSchema>;
export const simulationResponseSchema = z.object({
  requestId: z.string().uuid(),
  results: z.array(bankResultSchema).length(2),
});
export type SimulationResponse = z.infer<typeof simulationResponseSchema>;
export const exampleInput: SimulationInput = {
  name: 'Marina Exemplo',
  email: 'marina@example.com',
  cpf: '52998224725',
  employerCnpj: '11222333000181',
  salaryCents: 500000,
  amountCents: 1500000,
  installments: 24,
};
