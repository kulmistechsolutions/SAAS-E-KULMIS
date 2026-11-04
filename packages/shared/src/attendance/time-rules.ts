import { z } from "zod";

/**
 * A class's own attendance times.
 *
 * Most classes keep the school's (Settings → Attendance). A class that comes
 * in before the regular lessons — an early session for the exam years — needs
 * its register to open and close at another hour, while everything else about
 * it is the same. A rule either moves the school's times by an offset
 * (SHIFTED, "an hour earlier", and keeps following them when the school
 * changes its own) or holds four times of its own (FIXED).
 *
 * Pure, and shared, so the register screen shows exactly the times the server
 * enforces.
 */

export type AttendanceTimeMode = "SHIFTED" | "FIXED";

export interface AttendanceTimes {
  startTime: string;
  lateTime: string;
  endTime: string;
  lockTime: string;
}

export interface AttendanceTimeRuleLike {
  mode: AttendanceTimeMode;
  offsetMinutes: number;
  startTime: string | null;
  lateTime: string | null;
  endTime: string | null;
  lockTime: string | null;
}

/** What Settings → Attendance shows a school that never saved that page. */
export const DEFAULT_ATTENDANCE_TIMES: AttendanceTimes = {
  startTime: "07:00",
  lateTime: "07:30",
  endTime: "14:00",
  lockTime: "16:00",
};

const CLOCK = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function clockToMinutes(hhmm: string): number | null {
  const m = CLOCK.exec(hhmm);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

export function minutesToClock(minutes: number): string {
  // Held inside the day: an hour earlier than 00:30 is still today's start,
  // not yesterday's.
  const m = Math.min(23 * 60 + 59, Math.max(0, Math.round(minutes)));
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

function shift(hhmm: string, by: number): string {
  const m = clockToMinutes(hhmm);
  return m === null ? hhmm : minutesToClock(m + by);
}

/** The school's own times, filling in whatever it never saved. */
export function schoolAttendanceTimes(
  stored: Partial<AttendanceTimes> | null | undefined,
): AttendanceTimes {
  const pick = (k: keyof AttendanceTimes) => {
    const v = stored?.[k];
    return typeof v === "string" && CLOCK.test(v) ? v : DEFAULT_ATTENDANCE_TIMES[k];
  };
  return {
    startTime: pick("startTime"),
    lateTime: pick("lateTime"),
    endTime: pick("endTime"),
    lockTime: pick("lockTime"),
  };
}

/** The times a class actually keeps: its rule's, or the school's. */
export function effectiveAttendanceTimes(
  school: AttendanceTimes,
  rule: AttendanceTimeRuleLike | null | undefined,
): AttendanceTimes {
  if (!rule) return school;
  if (rule.mode === "FIXED") {
    return {
      startTime: rule.startTime ?? school.startTime,
      lateTime: rule.lateTime ?? school.lateTime,
      endTime: rule.endTime ?? school.endTime,
      lockTime: rule.lockTime ?? school.lockTime,
    };
  }
  const by = rule.offsetMinutes;
  return {
    startTime: shift(school.startTime, by),
    lateTime: shift(school.lateTime, by),
    endTime: shift(school.endTime, by),
    lockTime: shift(school.lockTime, by),
  };
}

const clock = z.string().regex(CLOCK, "Time must be HH:mm");

export const saveAttendanceTimeRuleSchema = z
  .object({
    name: z.string().trim().min(1, "Give the rule a name").max(60),
    mode: z.enum(["SHIFTED", "FIXED"]),
    /** Up to 6 hours either way, in whole minutes. */
    offsetMinutes: z.number().int().min(-360).max(360).default(0),
    startTime: clock.nullable().optional(),
    lateTime: clock.nullable().optional(),
    endTime: clock.nullable().optional(),
    lockTime: clock.nullable().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.mode === "SHIFTED" && v.offsetMinutes === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["offsetMinutes"],
        message: "Choose how much earlier or later than the school's times",
      });
    }
    if (v.mode === "FIXED") {
      for (const k of ["startTime", "lockTime"] as const) {
        if (!v[k]) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: [k], message: "Required" });
        }
      }
      const start = v.startTime ? clockToMinutes(v.startTime) : null;
      const lock = v.lockTime ? clockToMinutes(v.lockTime) : null;
      if (start !== null && lock !== null && lock <= start) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["lockTime"],
          message: "The lock time must be after the start time",
        });
      }
    }
  });
export type SaveAttendanceTimeRuleInput = z.infer<typeof saveAttendanceTimeRuleSchema>;

export const assignAttendanceTimeRuleSchema = z.object({
  classIds: z.array(z.string().min(1)).max(500),
});
export type AssignAttendanceTimeRuleInput = z.infer<typeof assignAttendanceTimeRuleSchema>;
