import type { ExamStatus, ExamType, SubmissionStatus } from "./types";

export function gradeFromAverage(avg: number): string {
  if (avg >= 90) return "A";
  if (avg >= 80) return "B";
  if (avg >= 70) return "C";
  if (avg >= 60) return "D";
  if (avg >= 50) return "E";
  return "F";
}

export function passedFromAverage(avg: number): boolean {
  return avg >= 50;
}

export function examStatusLabel(status: ExamStatus | string): string {
  return status
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

export function examTypeLabel(type: ExamType | string): string {
  if (type === "TEACHER_ASSESSMENT") return "Teacher Entry";
  if (type === "SCHOOL_IMPORT") return "School Import";
  return type;
}

/** Suggested exam names / categories from PRD. */
export const EXAM_CATEGORIES = [
  "Monthly Test",
  "Mid Term",
  "Final Examination",
  "Semester One",
  "Semester Two",
  "Academic Final",
  "Practice Exam",
  "Mock Exam",
] as const;

export function submissionStatusLabel(status: SubmissionStatus | string): string {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

export function shortDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

export const TERMS = [
  "Term 1",
  "Term 2",
  "Term 3",
  "Midterm",
  "Final",
  "Semester 1",
  "Semester 2",
] as const;
