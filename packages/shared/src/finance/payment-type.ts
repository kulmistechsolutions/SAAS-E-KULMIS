/**
 * What a payment actually was.
 *
 * The type on a receipt used to be the button the clerk pressed, not what the
 * money did. Settling August in full through the "arrears" line recorded
 * PARTIAL, and so did clearing a family's entire balance — across the
 * platform 250 of 266 payments labelled "Partial Payment" had left nothing
 * unpaid at all. Schools read that column to find families who still owe, so
 * a Partial that isn't partial sends somebody chasing money already in the
 * drawer.
 *
 * The type is now worked out from the charges the payment settled, after it
 * has settled them. It is a description, not an instruction: nothing in the
 * money maths reads it.
 */

/** One charge a payment landed on, as it stands AFTER the payment. */
export interface SettledCharge {
  year: number;
  month: number;
  /** True when the charge is fully paid now. */
  settled: boolean;
}

export type RecordedPaymentType =
  | "THIS_MONTH"
  | "PARTIAL"
  | "ADVANCE"
  | "ARREARS";

/**
 * Classify a payment from what it settled.
 *
 * Order matters, and it is the order a school cares about:
 *
 * - Something it touched is still short — that is a PARTIAL payment, whatever
 *   else the money also did.
 * - Otherwise, money reaching a month later than the one being collected is
 *   an ADVANCE; that is the fact worth surfacing even if the payment cleared
 *   this month on the way.
 * - Otherwise, a payment that includes the live month leaves the family up to
 *   date: THIS_MONTH.
 * - Otherwise it settled only older months or one-off charges: ARREARS. This
 *   is the case that had nowhere to go and was being called Partial.
 */
export function classifyPayment(input: {
  lines: SettledCharge[];
  /** The month the school is collecting. */
  liveYear: number;
  liveMonth: number;
  /** Used only when the payment settled nothing identifiable. */
  fallback: RecordedPaymentType;
}): RecordedPaymentType {
  const { lines, fallback } = input;
  if (lines.length === 0) return fallback;

  if (lines.some((l) => !l.settled)) return "PARTIAL";

  const live = input.liveYear * 100 + input.liveMonth;
  const ym = (l: SettledCharge) => l.year * 100 + l.month;

  if (lines.some((l) => ym(l) > live)) return "ADVANCE";
  if (lines.some((l) => ym(l) === live)) return "THIS_MONTH";
  return "ARREARS";
}
