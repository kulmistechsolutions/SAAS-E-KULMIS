/**
 * Catch-up marking — filling in the registers a school kept on paper.
 *
 * A school that joins halfway through an academic year arrives with months of
 * attendance already taken, in an exercise book. Until now there was nowhere
 * to put it: the lock in Settings → Attendance exists to stop a register being
 * quietly rewritten after the day closes, and it does not distinguish between
 * that and a school entering August in September. Only an administrator could
 * mark a past day at all, one day at a time, with nothing on screen saying
 * which days were still missing.
 *
 * So the school opens a window over the months it is catching up on, does the
 * work, and closes it. Inside the window a past day may be marked by the people
 * who normally take the register; outside it, nothing changes. The window
 * carries who opened it and when, and it is the school's to close — which is
 * why the screen says, the whole time it is open, that it is open.
 *
 * Everything here is a pure function of its inputs so the rules can be tested
 * as rules rather than inferred from what the database did afterwards.
 */

export interface BackfillWindow {
  open: boolean;
  /** First day that may be marked, inclusive. "YYYY-MM-DD". */
  from: string;
  /** Last day that may be marked, inclusive. "YYYY-MM-DD". */
  to: string;
  openedByUserId?: string | null;
  openedByName?: string | null;
  openedAt?: string | null;
  closedAt?: string | null;
}

const ISO_DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export function isIsoDate(s: unknown): s is string {
  return typeof s === "string" && ISO_DATE.test(s);
}

/**
 * Read a window out of whatever is stored, or null.
 *
 * Settings are JSON, so anything can be in there — a half-written window, a
 * shape from an older release, a hand-edited row. A window that cannot be read
 * as a window is no window, never a window over all time.
 */
export function normaliseWindow(raw: unknown): BackfillWindow | null {
  if (!raw || typeof raw !== "object") return null;
  const w = raw as Partial<BackfillWindow>;
  if (!isIsoDate(w.from) || !isIsoDate(w.to)) return null;
  if (w.from > w.to) return null;
  return {
    open: w.open === true,
    from: w.from,
    to: w.to,
    openedByUserId: w.openedByUserId ?? null,
    openedByName: w.openedByName ?? null,
    openedAt: w.openedAt ?? null,
    closedAt: w.closedAt ?? null,
  };
}

/** Is this day one the school is currently catching up on? */
export function isWithinBackfill(
  w: BackfillWindow | null,
  date: string,
): boolean {
  if (!w || !w.open) return false;
  return date >= w.from && date <= w.to;
}

export interface MarkingContext {
  /** The day being marked, "YYYY-MM-DD". */
  date: string;
  /** Today where the school is, "YYYY-MM-DD". */
  today: string;
  /** Minutes since midnight where the school is. */
  nowMinutes: number;
  /** The school's lock time in minutes, or null when it enforces none. */
  lockMinutes: number | null;
  role: string | undefined;
  backfill: BackfillWindow | null;
  excusedEnabled: boolean;
  statuses: string[];
}

export type MarkingDecision =
  | { allowed: true }
  | { allowed: false; reason: string };

const UNRESTRICTED = new Set(["ADMINISTRATOR", "SUPER_ADMINISTRATOR"]);

/**
 * Whether this register may be saved, and if not, why in words a school can act
 * on. One place, in order, so the rules cannot be half-applied by a caller that
 * forgot one.
 */
export function markingDecision(ctx: MarkingContext): MarkingDecision {
  // A day that has not happened cannot have a register. This was allowed: the
  // lock only ever looked backwards, so a mis-typed year put a full day's
  // attendance on a date years away, where nobody would ever look for it.
  //
  // One day of slack, deliberately. Seventy-one of the seventy-nine schools
  // are recorded as UTC while sitting in Somalia, three hours ahead, so
  // between midnight and 3am their real date is the server's tomorrow. A hard
  // comparison would refuse an early-morning register on a timezone nobody at
  // the school knows is wrong. A mistyped year is still refused; a clock that
  // is three hours out is not.
  if (ctx.date > nextDay(ctx.today)) {
    return {
      allowed: false,
      reason: `${ctx.date} has not happened yet. Attendance can only be taken for today or a past day.`,
    };
  }

  if (!ctx.excusedEnabled && ctx.statuses.includes("EXCUSED")) {
    return {
      allowed: false,
      reason:
        "Excused attendance is switched off for this school (Settings → Attendance).",
    };
  }

  // The catch-up window comes before the role check on purpose: its whole
  // point is that the people who take the register can enter the months the
  // school kept on paper, without an administrator doing it for them.
  if (isWithinBackfill(ctx.backfill, ctx.date)) return { allowed: true };

  if (UNRESTRICTED.has(ctx.role ?? "")) return { allowed: true };
  if (ctx.lockMinutes === null) return { allowed: true };

  if (ctx.date < ctx.today) {
    return {
      allowed: false,
      reason: `Attendance for ${ctx.date} is closed. To enter earlier months, an administrator can open catch-up marking in Settings → Attendance.`,
    };
  }
  if (ctx.nowMinutes >= ctx.lockMinutes) {
    return {
      allowed: false,
      reason: `Today's attendance is locked (after ${minutesToClock(ctx.lockMinutes)}). Ask an administrator to change it.`,
    };
  }
  return { allowed: true };
}

/** The day after an ISO date, as an ISO date. */
export function nextDay(date: string): string {
  const d = new Date(`${date}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function minutesToClock(m: number): string {
  const h = Math.floor(m / 60);
  return `${String(h).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/**
 * Check a window a school is asking to open.
 *
 * Bounded deliberately: a window with no end is a lock that has been switched
 * off, and the point of this one is that it closes.
 */
export function validateWindow(
  from: string,
  to: string,
  today: string,
  yearBounds?: { start: string; end: string } | null,
): string | null {
  if (!isIsoDate(from) || !isIsoDate(to)) {
    return "Give both dates as YYYY-MM-DD.";
  }
  if (from > to) return "The first day cannot be after the last day.";
  if (to > today) {
    return "Catch-up marking is for days that have already happened; the last day cannot be in the future.";
  }
  if (yearBounds) {
    if (from < yearBounds.start || to > yearBounds.end) {
      return `Catch-up marking has to stay inside the active academic year (${yearBounds.start} to ${yearBounds.end}).`;
    }
  }
  return null;
}

/** Every day in a month, as "YYYY-MM-DD". */
export function daysInMonth(year: number, month: number): string[] {
  const out: string[] = [];
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  for (let d = 1; d <= last; d++) {
    out.push(
      `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
    );
  }
  return out;
}
