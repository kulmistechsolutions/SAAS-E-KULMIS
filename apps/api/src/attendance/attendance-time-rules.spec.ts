import {
  effectiveAttendanceTimes,
  saveAttendanceTimeRuleSchema,
  schoolAttendanceTimes,
} from "@ekulmis/shared";
import { markingDecision } from "./backfill-window";

const school = schoolAttendanceTimes({ startTime: "07:40", lateTime: "08:00", endTime: "12:55", lockTime: "10:00" });

describe("attendance time rules", () => {
  it("a class with no rule keeps the school's times", () => {
    expect(effectiveAttendanceTimes(school, null)).toEqual(school);
  });

  it("an hour earlier moves every time and follows the school's", () => {
    const rule = { mode: "SHIFTED" as const, offsetMinutes: -70, startTime: null, lateTime: null, endTime: null, lockTime: null };
    expect(effectiveAttendanceTimes(school, rule)).toEqual({
      startTime: "06:30",
      lateTime: "06:50",
      endTime: "11:45",
      lockTime: "08:50",
    });
  });

  it("stays inside the day", () => {
    const rule = { mode: "SHIFTED" as const, offsetMinutes: -360, startTime: null, lateTime: null, endTime: null, lockTime: null };
    expect(effectiveAttendanceTimes(schoolAttendanceTimes({ startTime: "03:00" }), rule).startTime).toBe("00:00");
  });

  it("a fixed rule uses its own times, the school's where it left one blank", () => {
    const rule = { mode: "FIXED" as const, offsetMinutes: 0, startTime: "06:30", lateTime: null, endTime: null, lockTime: "09:00" };
    expect(effectiveAttendanceTimes(school, rule)).toEqual({ startTime: "06:30", lateTime: "08:00", endTime: "12:55", lockTime: "09:00" });
  });

  it("an untouched settings page reads as the defaults", () => {
    expect(schoolAttendanceTimes(null)).toEqual({ startTime: "07:00", lateTime: "07:30", endTime: "14:00", lockTime: "16:00" });
    expect(schoolAttendanceTimes({ lockTime: "nonsense" }).lockTime).toBe("16:00");
  });

  it("validates what a school can save", () => {
    expect(saveAttendanceTimeRuleSchema.safeParse({ name: "Early", mode: "SHIFTED", offsetMinutes: -60 }).success).toBe(true);
    expect(saveAttendanceTimeRuleSchema.safeParse({ name: "Early", mode: "SHIFTED", offsetMinutes: 0 }).success).toBe(false);
    expect(saveAttendanceTimeRuleSchema.safeParse({ name: "Early", mode: "FIXED", startTime: "06:30", lockTime: "09:00" }).success).toBe(true);
    expect(saveAttendanceTimeRuleSchema.safeParse({ name: "Early", mode: "FIXED", startTime: "09:00", lockTime: "06:30" }).success).toBe(false);
    expect(saveAttendanceTimeRuleSchema.safeParse({ name: "Early", mode: "FIXED", lockTime: "09:00" }).success).toBe(false);
  });

  it("the early class locks at its own hour while the others stay open", () => {
    const base = { date: "2026-11-04", today: "2026-11-04", nowMinutes: 9 * 60, role: "ATTENDANCE_OFFICER", backfill: null, excusedEnabled: true, statuses: ["PRESENT"] };
    expect(markingDecision({ ...base, lockMinutes: 8 * 60 + 50 }).allowed).toBe(false); // early class, 08:50
    expect(markingDecision({ ...base, lockMinutes: 10 * 60 }).allowed).toBe(true); // regular class, 10:00
    expect(markingDecision({ ...base, role: "ADMINISTRATOR", lockMinutes: 8 * 60 + 50 }).allowed).toBe(true);
  });
});
