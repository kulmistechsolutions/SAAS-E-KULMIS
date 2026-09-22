"use client";

import { api } from "@/lib/api";
import type { ApiQuizQuestion, QuizBuilderQuestion, QuizTfAccepted } from "./api";

export type QuestionDifficulty = "EASY" | "MEDIUM" | "HARD";
export type BankLanguage = "AUTO" | "so" | "en" | "ar";

/** A question in the school's bank, with the names its filters show. */
export interface BankItem {
  id: string;
  teacherId: string | null;
  subjectId: string | null;
  classId: string | null;
  academicYearId: string | null;
  topic: string | null;
  difficulty: QuestionDifficulty;
  language: BankLanguage;
  shared: boolean;
  question: string;
  questionHtml: string | null;
  questionType: QuizBuilderQuestion["questionType"];
  options: string[] | unknown;
  optionsHtml: string[] | null;
  correctAnswer: string;
  gradingMode: "EXACT" | "AI_CONCEPT";
  pairs: { left: string; right: string }[] | null;
  blanks: string[] | null;
  acceptedAnswers: QuizTfAccepted | null;
  marks: number;
  direction: "AUTO" | "LTR" | "RTL" | null;
  contentFont: string | null;
  usageCount: number;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
  subjectName: string | null;
  className: string | null;
  academicYearName: string | null;
  teacherName: string | null;
  /** Whether the signed-in person may change or remove it. */
  canEdit: boolean;
}

export interface BankFilters {
  q?: string;
  questionType?: string;
  language?: BankLanguage | "";
  subjectId?: string;
  classId?: string;
  academicYearId?: string;
  topic?: string;
  difficulty?: QuestionDifficulty | "";
  teacherId?: string;
  mine?: boolean;
  skip?: number;
  take?: number;
}

export interface BankOptions {
  subjects: { id: string; name: string }[];
  classes: { id: string; name: string; academicYearId: string }[];
  academicYears: { id: string; name: string; isActive: boolean }[];
  teachers: { id: string; fullName: string }[];
  topics: string[];
  /** Set when the signed-in person is a teacher. */
  myTeacherId: string | null;
}

export interface BankMeta {
  subjectId?: string | null;
  classId?: string | null;
  academicYearId?: string | null;
  topic?: string | null;
  difficulty: QuestionDifficulty;
  language: BankLanguage;
  shared: boolean;
}

export const apiBankList = (f: BankFilters) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) {
    if (v === undefined || v === "" || v === false) continue;
    p.set(k, String(v));
  }
  const q = p.toString();
  return api<{ total: number; items: BankItem[] }>(`/quiz-bank${q ? `?${q}` : ""}`);
};

export const apiBankOptions = () => api<BankOptions>("/quiz-bank/options");

export const apiBankCreate = (question: QuizBuilderQuestion, meta: BankMeta) =>
  api<BankItem>("/quiz-bank", { method: "POST", body: { question, meta } });

export const apiBankUpdate = (
  id: string,
  body: { question?: QuizBuilderQuestion; meta?: Partial<BankMeta> },
) => api<BankItem>(`/quiz-bank/${id}`, { method: "PATCH", body });

export const apiBankArchive = (id: string) =>
  api<{ ok: true }>(`/quiz-bank/${id}`, { method: "DELETE" });

export const apiBankFromQuiz = (body: {
  quizId: string;
  questionIds: string[];
  topic?: string | null;
  difficulty: QuestionDifficulty;
  shared: boolean;
}) => api<{ added: number; skipped: number }>("/quiz-bank/from-quiz", { method: "POST", body });

/** Copies of bank questions, in the shape the quiz builder edits. */
export const apiBankUse = (ids: string[]) =>
  api<(ApiQuizQuestion & { bankItemId: string })[]>("/quiz-bank/use", {
    method: "POST",
    body: { ids },
  });
