import {
  DEFAULT_PASSING_PERCENTAGE,
  gradeFromBands,
} from "@ekulmis/shared";
import { getSettings } from "@/lib/settings/store";
import type { ExamStatus, ExamType, SubmissionStatus } from "./types";

/**
 * Grade for a percentage under THIS school's own Grade Configuration
 * (Settings → Examinations), not a scale baked into the code. Reading the
 * settings store on every call is what makes an edited ladder show up on
 * results immediately, with no reload and no stale copy — and it keeps the
 * browser's answer identical to the API's, which grades from the same bands.
 */
export function gradeFromAverage(avg: number): string {
  return gradeFromBands(avg, getSettings().grades);
}

export function passedFromAverage(avg: number): boolean {
  return (
    avg >=
    (getSettings().examinations.passingPercentage ?? DEFAULT_PASSING_PERCENTAGE)
  );
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
