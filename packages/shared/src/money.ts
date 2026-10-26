import { z } from "zod";

/**
 * Money may carry cents — a monthly fee of $5.50, a salary of $3.5. Amounts
 * are plain numbers, so every sum or difference goes through roundMoney:
 * 0.1 + 0.2 is 0.30000000000000004 in JavaScript, and a charge that is
 * "short" by a billionth of a cent must still count as paid.
 */
export function roundMoney(n: number): number {
  // Half away from zero, so a refund of -2.675 mirrors a charge of 2.675.
  return (Math.sign(n) * Math.round((Math.abs(n) + Number.EPSILON) * 100)) / 100 || 0;
}

/** True when n has no more than two decimals (5, 5.5, 5.25 — not 5.255). */
export function hasAtMostCents(n: number): boolean {
  return Math.abs(n * 100 - Math.round(n * 100)) < 1e-6;
}

const CENTS = "Use at most 2 decimals, e.g. 5.50";

/** Zero or more, with up to two decimals. */
export const moneySchema = () => z.number().nonnegative().refine(hasAtMostCents, CENTS);

/** More than zero, with up to two decimals. */
export const positiveMoneySchema = (message?: string) =>
  z.number().positive(message).refine(hasAtMostCents, CENTS);
