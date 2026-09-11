/**
 * Whether the credits the platform has sold are actually backed by SMS at the
 * provider.
 *
 * Two numbers that ought to move together and do not have to:
 *
 *  - what schools still hold, the sum of every active package's remaining
 *    credits, which is a promise the platform has made;
 *  - what the provider says is left in the platform's own account, which is
 *    what that promise can actually be paid out of.
 *
 * Selling 50,000 credits against a provider account holding 8,000 SMS is not an
 * error any single send will report — every message goes out normally until the
 * day the provider account empties and every school stops at once. That is the
 * failure this exists to see coming.
 *
 * Kept apart from the fetching so the arithmetic can be read and tested without
 * a provider.
 */

export interface SmsBalanceInput {
  /** What the provider reports, or null when it has never been read. */
  providerBalance: number | null;
  /** Remaining credits across every active package, across every school. */
  creditsOutstanding: number;
  /** When the provider figure was read. Null when never. */
  checkedAt: Date | null;
  /** For deciding whether that reading is still worth trusting. */
  now?: Date;
}

export interface SmsBalanceHealth {
  /** Provider balance minus what schools hold. Negative means oversold. */
  drift: number | null;
  /** The platform has promised more credits than the provider can cover. */
  oversold: boolean;
  /** The provider balance has never been read. */
  unknown: boolean;
  /** Read, but too long ago to act on. */
  stale: boolean;
}

/** A balance older than this is reported, not relied on. */
export const BALANCE_STALE_AFTER_HOURS = 24;

export function smsBalanceHealth(input: SmsBalanceInput): SmsBalanceHealth {
  const { providerBalance, creditsOutstanding, checkedAt } = input;
  const now = input.now ?? new Date();

  if (providerBalance === null || checkedAt === null) {
    // Nothing has been read, so there is nothing to compare. Reporting this as
    // "healthy" would be the most dangerous answer of the three.
    return { drift: null, oversold: false, unknown: true, stale: false };
  }

  const ageHours = (now.getTime() - checkedAt.getTime()) / 3_600_000;
  const stale = ageHours > BALANCE_STALE_AFTER_HOURS;
  const drift = providerBalance - creditsOutstanding;

  return { drift, oversold: drift < 0, unknown: false, stale };
}

/**
 * The provider's balance as a number.
 *
 * It arrives as free text — "8000", "8,000", "8000 SMS", sometimes with a
 * currency-style decimal — because every provider formats it differently and
 * the value is passed through as received. Anything that is not a number at all
 * comes back null rather than 0: an unreadable balance is unknown, and reading
 * it as zero would raise an oversold alarm on every platform whose provider
 * words its reply differently.
 */
export function parseProviderBalance(raw: string | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  const cleaned = raw.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  if (!cleaned) return null;
  const n = Number(cleaned[0]);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}
