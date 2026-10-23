import { expect, it } from 'vitest';
import { calculateOffer, evaluate } from './app.js';
import { exampleInput } from '@consigna/contracts';
it('calculates the Price payment with cent rounding', () => {
  const offer = calculateOffer(100000, 12, 2);
  expect(offer.installmentCents).toBe(9456);
  expect(offer.totalCents).toBe(113472);
});
it('supports zero interest and keeps the total consistent', () => {
  const offer = calculateOffer(120000, 12, 0);
  expect(offer.installmentCents).toBe(10000);
  expect(offer.totalCents).toBe(120000);
});
it('accepts exactly the fictional salary margin and rejects above it', () => {
  const offer = calculateOffer(exampleInput.amountCents, 24, 1.8);
  const salaryCents = offer.installmentCents * 4;
  expect(evaluate({ ...exampleInput, salaryCents }, 'a').approved).toBe(true);
  expect(evaluate({ ...exampleInput, salaryCents: salaryCents - 1 }, 'a').approved).toBe(false);
});
