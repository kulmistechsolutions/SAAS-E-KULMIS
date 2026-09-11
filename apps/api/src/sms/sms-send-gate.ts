/**
 * Whether a school may send right now, and if not, why.
 *
 * Four gates, checked in the order a desk would want to hear about them: the
 * platform owner's suspension first (nothing the school does lifts it), then
 * the school's own switch, then the ceilings the owner set.
 *
 * Kept apart from the sending path so the rule can be read and tested on its
 * own — this is the boundary the whole SMS design rests on, and "a school uses
 * SMS but does not configure it" is worth stating in one place.
 */
export interface SmsSendState {
  /** Platform-only. A school has no route that writes this. */
  suspended: boolean;
  suspendedReason: string | null;
  /** The school's own switch. */
  enabled: boolean;
  /** 0 means no limit. */
  dailyLimit: number;
  monthlyLimit: number;
  sentToday: number;
  sentThisMonth: number;
  /** How many this send would add. */
  wanted: number;
}

/** The reason sending is refused, or null when it may go ahead. */
export function smsSendBlock(s: SmsSendState): string | null {
  if (s.suspended) {
    return s.suspendedReason?.trim()
      ? `SMS is suspended for this school: ${s.suspendedReason.trim()}. Contact your administrator.`
      : "SMS is suspended for this school. Contact your administrator.";
  }
  if (!s.enabled) return "SMS is disabled for this school.";

  // A limit of 0 is not a ceiling of zero — it is the absence of one, which is
  // what every school has until the platform owner sets a number.
  if (s.dailyLimit > 0 && s.sentToday + s.wanted > s.dailyLimit) {
    return `SMS sending limit reached. Please contact your administrator. (Daily limit ${s.dailyLimit}, ${s.sentToday} already sent today.)`;
  }
  if (s.monthlyLimit > 0 && s.sentThisMonth + s.wanted > s.monthlyLimit) {
    return `SMS sending limit reached. Please contact your administrator. (Monthly limit ${s.monthlyLimit}, ${s.sentThisMonth} already sent this month.)`;
  }
  return null;
}

/**
 * The account number a school sees for its SMS service.
 *
 * Derived from the school's own id rather than stored, so it is stable for the
 * life of the school, unique across the platform, and cannot drift out of step
 * with anything. It identifies the account when a school calls the platform
 * owner about it — it is not a secret and grants nothing.
 */
export function smsAccountNo(schoolId: string): string {
  const tail = schoolId.replace(/[^a-zA-Z0-9]/g, "").slice(-8).toUpperCase();
  return `SMS-ACC-${tail.padStart(8, "0")}`;
}
