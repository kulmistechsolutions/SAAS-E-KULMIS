import type { Student } from "./types";
import { apiStudentAttendance } from "./api";
import { apiPortalAttendance } from "@/lib/parent-portal/api";

const attendanceCache = new Map<string, AttendanceSummary>();

export interface AttendanceRow {
  date: string;
  status: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";
  shiftName?: string | null;
}
export interface AttendanceSummary {
  present: number;
  absent: number;
  late: number;
  excused: number;
  totalMarked: number;
  percentage: number;
  rows: AttendanceRow[];
}

export async function loadAttendanceHistory(
  studentId: string,
  days = 60,
): Promise<AttendanceSummary> {
  const data = await apiStudentAttendance(studentId, days);
  attendanceCache.set(`${studentId}:${days}`, data);
  return data;
}

/**
 * Parent-portal attendance loader. Parents cannot hit the staff
 * `/students/:id/attendance` route (that 403s with "Insufficient role"), so
 * this uses the parent-scoped `/parent-portal/children/:id/attendance`
 * endpoint and folds its raw rows into the same summary + cache the dashboard
 * and print already read from.
 */
export async function loadPortalAttendanceHistory(
  studentId: string,
  days = 60,
): Promise<AttendanceSummary> {
  const rows = await apiPortalAttendance(studentId);
  let present = 0;
  let absent = 0;
  let late = 0;
  let excused = 0;
  const mapped: AttendanceRow[] = [];
  for (const r of rows) {
    if (r.status === "PRESENT") present++;
    else if (r.status === "ABSENT") absent++;
    else if (r.status === "LATE") late++;
    else if (r.status === "EXCUSED") excused++;
    if (
      r.status === "PRESENT" ||
      r.status === "ABSENT" ||
      r.status === "LATE" ||
      r.status === "EXCUSED"
    ) {
      mapped.push({ date: r.date, status: r.status, shiftName: r.shift?.name ?? null });
    }
  }
  const totalMarked = present + absent + late;
  const summary: AttendanceSummary = {
    present,
    absent,
    late,
    excused,
    totalMarked,
    percentage: Math.round((present / (totalMarked || 1)) * 1000) / 10,
    rows: mapped,
  };
  attendanceCache.set(`${studentId}:${days}`, summary);
  // The endpoint always returns the last 60 rows regardless of `days`, so also
  // cache under :60 — that's the key the printable report reads.
  attendanceCache.set(`${studentId}:60`, summary);
  return summary;
}

/** Returns cached API data or empty summary until loaded. */
export function attendanceHistory(
  student: Student,
  days = 40,
): AttendanceSummary {
  return (
    attendanceCache.get(`${student.id}:${days}`) ?? {
      present: 0,
      absent: 0,
      late: 0,
      excused: 0,
      totalMarked: 0,
      percentage: 0,
      rows: [],
    }
  );
}

/**
 * Removed: feeHistory, examHistory and quizHistory.
 *
 * Each generated its rows from a seeded random number generator keyed on the
 * student's code — eight months of fees, three exam results, four quiz
 * scores — and a parent's profile rendered them as if they were the school's
 * own records. A school opened a parent and read fee months its setup had
 * never covered, marked Paid or Partial at random, above receipt numbers
 * nobody had issued.
 *
 * The pages that showed them now read /fees/ledger and the published exam
 * results, and say plainly when there is nothing to show. Nothing on a
 * parent, student or family screen may be invented: a number a school cannot
 * trace to a charge it raised or a payment it took does not belong on it.
 */

export interface PromotionRow {
  academicYear: string;
  fromClass: string;
  toClass: string;
  date: string;
}

/**
 * Removed alongside the others: it walked the class list backwards from
 * whatever class the student is in today and invented a promotion for each
 * step, complete with dates. The real records live in the promotions store
 * (`studentPromotionHistory`), which is what the profile now reads.
 */
