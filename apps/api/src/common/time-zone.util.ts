/**
 * A school's time zone, made safe to hand to `Intl`.
 *
 * `Intl.DateTimeFormat` throws a RangeError on anything that is not a real IANA
 * zone, and the settings field accepted free text for a long time, so five
 * schools carry values like "hodon" (a district), "24", "SOMALIA -KGS" and
 * "7:30AM-12:10PM". Each of those turned attendance into a 500: a teacher at
 * BARWAAQO could not mark a register at all, and two schools' officer
 * monitoring page failed outright.
 *
 * The fix is not to guess what was meant. It is that one school's bad settings
 * value must never crash that school's attendance — the register is the thing
 * that has to keep working.
 */

/** The zone to fall back to, and the one 70 of the 78 schools already carry. */
export const DEFAULT_TIME_ZONE = "UTC";

/** Whether `Intl` will accept this as a time zone. */
export function isValidTimeZone(raw: string | null | undefined): boolean {
  if (!raw || !raw.trim()) return false;
  try {
    // The only honest test: ask the same implementation that will be used.
    new Intl.DateTimeFormat("en-US", { timeZone: raw }).format();
    return true;
  } catch {
    return false;
  }
}

/**
 * The zone to actually use. Falls back rather than throwing.
 *
 * Falling back to UTC rather than to Somali time on purpose: UTC is what the
 * column defaults to and what almost every school on the platform is set to,
 * so a school with a broken value gets the same treatment as a school that
 * never set one. Guessing a different zone for the broken ones would quietly
 * shift their lock and late times by hours, which is a wrong answer delivered
 * confidently — worse than the plain one.
 */
export function safeTimeZone(raw: string | null | undefined): string {
  return isValidTimeZone(raw) ? (raw as string) : DEFAULT_TIME_ZONE;
}
