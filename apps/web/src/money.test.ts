import { expect, it } from 'vitest';
import { toCents } from './money';
it.each([
  ['5.000,00', 500000],
  ['5000.00', 500000],
  ['5.000', 500000],
  ['5000', 500000],
  ['1,25', 125],
  ['R$ 10,50', 1050],
])('parses %s into cents', (value, expected) => expect(toCents(value)).toBe(expected));
it.each(['', '-1', '1,234', '1e5', '5.00,00', 'abc'])(
  'rejects ambiguous or malformed currency %s',
  (value) => expect(toCents(value)).toBeNaN(),
);
