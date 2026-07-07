import type { GradeResult, QuestionType, QuizStatus } from "./types";

export function quizCode(seq: number, year = new Date().getFullYear()): string {
  return `QZ-${year}-${String(seq).padStart(5, "0")}`;
}

export function shortDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
}

export function dateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function quizStatusLabel(s: QuizStatus): string {
  return s.charAt(0) + s.slice(1).toLowerCase();
}

export function questionTypeLabel(t: QuestionType): string {
  const map: Record<QuestionType, string> = {
    MCQ_SINGLE: "Multiple Choice (Single)",
    MCQ_MULTIPLE: "Multiple Choice (Multiple)",
    TRUE_FALSE: "True / False",
    FILL_BLANK: "Fill in the Blank",
    SHORT_ANSWER: "Short Answer",
    ESSAY: "Essay",
    MATCHING: "Matching",
    ORDERING: "Ordering",
    IMAGE: "Image-Based",
  };
  return map[t];
}

export function gradeFromPercentage(pct: number): string {
  if (pct >= 90) return "A";
  if (pct >= 80) return "B";
  if (pct >= 70) return "C";
  if (pct >= 60) return "D";
  if (pct >= 50) return "E";
  return "F";
}

export function resultLabel(r: GradeResult | null): string {
  if (!r) return "—";
  if (r === "PASS") return "Pass";
  if (r === "FAIL") return "Fail";
  return "Pending Review";
}

export const QUESTION_TYPES: QuestionType[] = [
  "MCQ_SINGLE",
  "MCQ_MULTIPLE",
  "TRUE_FALSE",
  "FILL_BLANK",
  "SHORT_ANSWER",
  "ESSAY",
  "MATCHING",
  "ORDERING",
  "IMAGE",
];

export const QUIZ_STATUSES: QuizStatus[] = [
  "DRAFT",
  "SCHEDULED",
  "ACTIVE",
  "CLOSED",
  "PUBLISHED",
  "ARCHIVED",
];

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
