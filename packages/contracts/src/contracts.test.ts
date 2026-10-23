import { describe, expect, it } from 'vitest';
import { exampleInput, simulationInputSchema, validCpf, validCnpj } from './index.js';
describe('input validation', () => {
  it('normalizes formatted documents and whitespace', () => {
    const value = simulationInputSchema.parse({
      ...exampleInput,
      name: ' Marina Exemplo ',
      cpf: '529.982.247-25',
      employerCnpj: '11.222.333/0001-81',
    });
    expect(value).toEqual(exampleInput);
  });
  it.each(['00000000000', '12345678901', '52998224724'])('rejects invalid CPF %s', (value) =>
    expect(validCpf(value)).toBe(false),
  );
  it.each(['00000000000000', '11222333000180', '12ABC34501DE00'])(
    'rejects invalid CNPJ %s',
    (value) => expect(validCnpj(value)).toBe(false),
  );
  it('accepts numeric and alphanumeric CNPJ check digits', () => {
    expect(validCnpj('11222333000181')).toBe(true);
    expect(validCnpj('12ABC34501DE35')).toBe(true);
  });
  it.each([
    { salaryCents: 0 },
    { amountCents: -10 },
    { amountCents: 1.5 },
    { installments: 18 },
    { email: 'invalid' },
    { name: '' },
    { amountCents: Infinity },
    { amountCents: 9999 },
    { amountCents: NaN },
    { extra: true },
  ])('rejects invalid input %j', (change) => {
    expect(simulationInputSchema.safeParse({ ...exampleInput, ...change }).success).toBe(false);
  });
  it('accepts the minimum loan and explains invalid currency in Portuguese', () => {
    expect(simulationInputSchema.safeParse({ ...exampleInput, amountCents: 10000 }).success).toBe(
      true,
    );
    const result = simulationInputSchema.safeParse({ ...exampleInput, salaryCents: NaN });
    expect(!result.success && result.error.flatten().fieldErrors.salaryCents).toEqual([
      'Informe um valor monetário válido.',
    ]);
  });
});
