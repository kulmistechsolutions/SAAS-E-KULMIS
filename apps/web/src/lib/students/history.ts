import { CLASSES } from "./constants";
import type { Student } from "./types";
import { apiStudentAttendance } from "./api";

function seedFrom(code: string): number {
  let h = 0;
  for (let i = 0; i < code.length; i++) h = (h * 31 + code.charCodeAt(i)) % 100000;
  return h;
}

function rng(seed: number) {
  let s = seed || 1;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

const attendanceCache = new Map<string, AttendanceSummary>();

export interface AttendanceRow {
  date: string;
  status: "PRESENT" | "ABSENT" | "LATE";
}
export interface AttendanceSummary {
  present: number;
  absent: number;
  late: number;
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

/** Returns cached API data or empty summary until loaded. */
export function attendanceHistory(student: Student, days = 40): AttendanceSummary {
  return (
    attendanceCache.get(`${student.id}:${days}`) ?? {
      present: 0,
      absent: 0,
      late: 0,
      percentage: 0,
      rows: [],
    }
  );
}

export interface FeeRow {
  month: string;
  charged: number;
  paid: number;
  balance: number;
  status: "PAID" | "PARTIAL" | "UNPAID";
  date: string | null;
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function feeHistory(student: Student, count = 8): FeeRow[] {
  const rand = rng(seedFrom(student.code) + 7);
  const rows: FeeRow[] = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 5);
    const charged = student.monthlyFee;
    const r = rand();
    let paid = charged;
    if (r > 0.85) paid = 0;
    else if (r > 0.7) paid = Math.round(charged / 2);
    const balance = charged - paid;
    const status = balance === 0 ? "PAID" : paid === 0 ? "UNPAID" : "PARTIAL";
    rows.push({
      month: `${MONTHS[d.getMonth()]} ${d.getFullYear()}`,
      charged,
      paid,
      balance,
      status,
      date: paid > 0 ? d.toISOString() : null,
    });
  }
  return rows;
}

export interface ExamRow {
  name: string;
  term: string;
  totalMarks: number;
  average: number;
  grade: string;
  passed: boolean;
}

function grade(avg: number): string {
  if (avg >= 90) return "A+";
  if (avg >= 80) return "A";
  if (avg >= 70) return "B";
  if (avg >= 60) return "C";
  if (avg >= 50) return "D";
  return "F";
}

export function examHistory(student: Student): ExamRow[] {
  const rand = rng(seedFrom(student.code) + 13);
  const exams = [
    { name: "First Term Examination", term: "Term 1" },
    { name: "Mid Term Examination", term: "Term 2" },
    { name: "Final Examination", term: "Term 3" },
  ];
  return exams.map((e) => {
    const avg = Math.round(45 + rand() * 52);
    return {
      name: e.name,
      term: e.term,
      totalMarks: 100,
      average: avg,
      grade: grade(avg),
      passed: avg >= 50,
    };
  });
}

export interface QuizRow {
  name: string;
  score: number;
  total: number;
  percentage: number;
  status: "PASSED" | "FAILED";
  date: string;
}

export function quizHistory(student: Student): QuizRow[] {
  const rand = rng(seedFrom(student.code) + 19);
  const quizzes = ["Mathematics Quiz", "Science Quiz", "English Quiz", "History Quiz"];
  const now = new Date();
  return quizzes.map((name, i) => {
    const total = 20;
    const score = Math.round(8 + rand() * 12);
    const percentage = Math.round((score / total) * 100);
    const d = new Date(now);
    d.setDate(now.getDate() - i * 9);
    return {
      name,
      score,
      total,
      percentage,
      status: percentage >= 50 ? "PASSED" : "FAILED",
      date: d.toISOString(),
    };
  });
}

export interface PromotionRow {
  academicYear: string;
  fromClass: string;
  toClass: string;
  date: string;
}

export function promotionHistory(student: Student): PromotionRow[] {
  const idx = CLASSES.indexOf(student.className as (typeof CLASSES)[number]);
  if (idx <= 0) return [];
  const rows: PromotionRow[] = [];
  const startYear = 2024 - Math.min(idx, 3);
  for (let i = Math.max(0, idx - 3); i < idx; i++) {
    const y = startYear + (i - Math.max(0, idx - 3));
    rows.push({
      academicYear: `${y}-${y + 1}`,
      fromClass: CLASSES[i],
      toClass: CLASSES[i + 1],
      date: new Date(y + 1, 5, 15).toISOString(),
    });
  }
  return rows;
}
