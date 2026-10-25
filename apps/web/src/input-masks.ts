import { brl, toCents } from './money';

export const cpfMask = { mask: '000.000.000-00', eager: true };
export const cnpjMask = {
  mask: 'CC.CCC.CCC/CCCC-00',
  definitions: { C: /[A-Z0-9]/ },
  prepare: (value: string) => value.toUpperCase(),
  eager: true,
};
export const moneyMask = {
  mask: Number,
  scale: 2,
  radix: ',',
  thousandsSeparator: '.',
  mapToRadix: [],
  padFractionalZeros: true,
  normalizeZeros: true,
  min: 0,
};

// Pasted whole reais and decimals must retain their meaning, not become cents.
export function formatPastedMoney(value: string): string | null {
  const cents = toCents(value);
  return Number.isFinite(cents) ? brl(cents).replace(/^R\$\s*/, '') : null;
}
