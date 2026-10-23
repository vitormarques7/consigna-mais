/** Accept Brazilian currency (5.000,00) or an ungrouped decimal (5000.00). */
export function toCents(value: string): number {
  const plain = value.trim().replace(/^R\$\s*/, '');
  const brazilian = /^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/;
  const decimal = /^\d+(?:\.\d{1,2})?$/;
  let normalized: string;
  if (brazilian.test(plain)) normalized = plain.replace(/\./g, '').replace(',', '.');
  else if (decimal.test(plain)) normalized = plain;
  else return NaN;
  return Math.round(Number(normalized) * 100);
}
export const brl = (cents: number) =>
  (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
