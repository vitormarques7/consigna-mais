import { expect, it } from 'vitest';
import { IMask } from 'react-imask';
import { simulationInputSchema, exampleInput } from '@consigna/contracts';
import { cpfMask, cnpjMask, moneyMask, formatPastedMoney } from './input-masks';
import { toCents } from './money';

it('formats documents progressively without losing leading zeros', () => {
  const cpf = IMask.createMask(cpfMask);
  for (const digit of '012345') cpf.append(digit, { input: true });
  expect(cpf.value).toBe('012.345.');
  cpf.resolve('52998224725');
  expect(cpf.value).toBe('529.982.247-25');
  const cnpj = IMask.createMask(cnpjMask);
  cnpj.resolve('11222333000181');
  expect(cnpj.value).toBe('11.222.333/0001-81');
  cnpj.resolve('11.222.333/0001-81');
  expect(cnpj.value).toBe('11.222.333/0001-81');
});

it('keeps alphanumeric CNPJ compatible with backend validation', () => {
  const cnpj = IMask.createMask(cnpjMask);
  cnpj.resolve('12abc34501de35');
  expect(cnpj.value).toBe('12.ABC.345/01DE-35');
  const parsed = simulationInputSchema.parse({ ...exampleInput, employerCnpj: cnpj.value });
  expect(parsed.employerCnpj).toBe('12ABC34501DE35');
});

it('groups reais while typing and completes cents on blur without changing the amount', () => {
  const money = IMask.createMask(moneyMask);
  for (const digit of '5000') money.append(digit, { input: true });
  expect(money.value).toBe('5.000');
  money.doCommit();
  expect(money.value).toBe('5.000,00');
  expect(toCents(money.value)).toBe(500000);
  money.resolve('15000,50');
  expect(money.value).toBe('15.000,50');
  expect(toCents(money.value)).toBe(1500050);
  money.resolve('');
  expect(money.value).toBe('');
  money.resolve('1000001');
  expect(toCents(money.value)).toBe(100000100);
  expect(
    simulationInputSchema.safeParse({ ...exampleInput, amountCents: toCents(money.value) }).success,
  ).toBe(false);
});

it.each(['5000', '5.000,00', '5000.00', 'R$ 5.000,00'])(
  'preserves reais when pasting %s',
  (value) => expect(formatPastedMoney(value)).toBe('5.000,00'),
);
it.each(['abc', '-1', '1,234', '1e5'])('does not reinterpret invalid pasted currency %s', (value) =>
  expect(formatPastedMoney(value)).toBeNull(),
);
