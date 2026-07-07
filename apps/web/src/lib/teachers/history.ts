import type { Teacher } from "./types";

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

export function teacherAttendanceHistory(teacher: Teacher, days = 35): AttendanceSummary {
  const rand = rng(seedFrom(teacher.code));
  const rows: AttendanceRow[] = [];
  let present = 0,
    absent = 0,
    late = 0;
  const base = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() - i);
    if (d.getDay() === 5) continue;
    const r = rand();
    const status = r > 0.1 ? "PRESENT" : r > 0.04 ? "LATE" : "ABSENT";
    if (status === "PRESENT") present++;
    else if (status === "LATE") late++;
    else absent++;
    rows.push({ date: d.toISOString(), status });
  }
  const total = present + absent + late || 1;
  return {
    present,
    absent,
    late,
    percentage: Math.round((present / total) * 1000) / 10,
    rows,
  };
}

export interface ExamRow {
  examName: string;
  className: string;
  section: string;
  subject: string;
  submitted: boolean;
  submittedAt: string | null;
}

export function examHistory(teacher: Teacher): ExamRow[] {
  const rand = rng(seedFrom(teacher.code) + 3);
  const exams = [
    "Mid Term Examination",
    "First Term Examination",
    "Final Examination",
  ];
  return exams.map((name, i) => {
    const submitted = rand() > 0.25;
    const d = new Date();
    d.setDate(d.getDate() - i * 12);
    return {
      examName: name,
      className: `Grade ${8 + i}`,
      section: ["A", "B", "C"][i % 3],
      subject: ["Mathematics", "Science", "English"][i],
      submitted,
      submittedAt: submitted ? d.toISOString() : null,
    };
  });
}

export interface QuizRow {
  name: string;
  status: "DRAFT" | "ACTIVE" | "COMPLETED";
  attempts: number;
  averageScore: number;
  createdAt: string;
}

export function quizHistory(teacher: Teacher): QuizRow[] {
  const rand = rng(seedFrom(teacher.code) + 9);
  const names = ["Algebra Quiz", "Science Quiz", "Grammar Quiz", "History Quiz"];
  const now = new Date();
  return names.map((name, i) => {
    const r = rand();
    const status = r > 0.6 ? "COMPLETED" : r > 0.3 ? "ACTIVE" : "DRAFT";
    const d = new Date(now);
    d.setDate(now.getDate() - i * 7);
    return {
      name,
      status,
      attempts: Math.floor(15 + rand() * 40),
      averageScore: Math.round(55 + rand() * 40),
      createdAt: d.toISOString(),
    };
  });
}

export interface SalaryRow {
  month: string;
  amount: number;
  paidAt: string | null;
  status: "PAID" | "PENDING";
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function salaryHistory(teacher: Teacher, count = 8): SalaryRow[] {
  const rand = rng(seedFrom(teacher.code) + 17);
  const now = new Date();
  const rows: SalaryRow[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const paid = rand() > 0.08;
    rows.push({
      month: `${MONTHS[d.getMonth()]} ${d.getFullYear()}`,
      amount: teacher.salary,
      paidAt: paid ? new Date(d.getFullYear(), d.getMonth(), 28).toISOString() : null,
      status: paid ? "PAID" : "PENDING",
    });
  }
  return rows;
}
