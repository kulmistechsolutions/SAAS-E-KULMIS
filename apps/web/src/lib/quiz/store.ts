"use client";

import { useSyncExternalStore } from "react";
import { ApiError } from "@/lib/api";
import {
  activeAcademicYear,
  classByName,
  getAcademicsState,
} from "@/lib/academics/store";
import { getState as getStudentsState } from "@/lib/students/store";
import { getTeacher, getTeachersState, teacherAssignments } from "@/lib/teachers/store";
import {
  apiCreateQuiz,
  apiListQuizzes,
  apiPublishQuiz,
  apiQuizAttempts,
  apiQuizByCode,
  apiSubmitQuizAttempt,
  type ApiQuiz,
  type ApiQuizQuestion,
} from "./api";
import { gradeFromPercentage, quizStatusLabel } from "./format";
import type {
  CreateQuizInput,
  QuestionBankItem,
  Quiz,
  QuizAnswer,
  QuizAttempt,
  QuizDashboardSummary,
  QuizQuestion,
  QuizRow,
  QuizState,
  QuizStatus,
  StudentQuizRow,
} from "./types";

const EMPTY: QuizState = {
  quizzes: [],
  questionBank: [],
  attempts: [],
  audit: [],
  notifications: [],
  quizSeq: 0,
  academicYear: "",
};

let state: QuizState | null = null;
let loaded = false;
const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function emit() {
  listeners.forEach((l) => l());
}

function ensure(): QuizState {
  if (state) return state;
  if (typeof window === "undefined") return EMPTY;
  state = { ...EMPTY, academicYear: activeAcademicYear() };
  if (!loaded) {
    loaded = true;
    void refreshQuizzes();
  }
  return state;
}

function setState(next: QuizState) {
  state = next;
  emit();
}

function apiErr(e: unknown, fallback: string): string {
  return e instanceof ApiError ? e.message : fallback;
}

function yearIdByName(name: string): string | undefined {
  return getAcademicsState().academicYears.find((y) => y.name === name)?.id;
}

function mapApiStatus(status: ApiQuiz["status"]): QuizStatus {
  if (status === "PUBLISHED") return "ACTIVE";
  if (status === "CLOSED") return "CLOSED";
  if (status === "ARCHIVED") return "ARCHIVED";
  return "DRAFT";
}

function mapQuestions(questions: ApiQuizQuestion[] = []): QuizQuestion[] {
  return questions.map((q, i) => {
    const opts = Array.isArray(q.options) ? (q.options as string[]) : [];
    return {
      id: q.id,
      type: "MCQ_SINGLE",
      text: q.question,
      marks: q.marks,
      options: opts.map((text, j) => ({ id: `${q.id}_opt_${j}`, text })),
      correctOptionIds: q.correctAnswer ? [`${q.id}_opt_${opts.indexOf(q.correctAnswer)}`] : [],
      correctText: q.correctAnswer,
      order: q.orderIndex ?? i + 1,
    };
  });
}

function mapQuiz(row: ApiQuiz, yearName?: string): Quiz {
  const questions = mapQuestions(row.questions);
  const totalMarks = questions.reduce((s, q) => s + q.marks, 0);
  const year =
    yearName ??
    getAcademicsState().academicYears.find((y) => y.id === row.academicYearId)?.name ??
    activeAcademicYear();

  return {
    id: row.id,
    code: row.code,
    title: row.title,
    academicYear: year,
    className: row.class?.name ?? "",
    section: row.section?.name ?? "",
    subject: row.subject?.name ?? "—",
    description: row.description,
    teacherId: row.teacherId,
    teacherName: row.teacher?.fullName ?? "Teacher",
    startDate: row.startAt?.slice(0, 10) ?? row.createdAt.slice(0, 10),
    endDate: row.endAt?.slice(0, 10) ?? row.publishedAt?.slice(0, 10) ?? row.updatedAt.slice(0, 10),
    durationMinutes: row.timeLimitMin ?? 30,
    totalMarks,
    passingMarks: row.passingMarks ?? Math.ceil(totalMarks * 0.5),
    maxAttempts: row.maxAttempts,
    shuffleQuestions: row.shuffleQuestions ?? false,
    shuffleAnswers: row.shuffleAnswers ?? false,
    showResultImmediately: row.showResultsImmediately ?? true,
    allowResume: false,
    status: mapApiStatus(row.status),
    questions,
    linkPath: `/quiz/take/${row.code}`,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    publishedAt: row.publishedAt,
  };
}

export async function refreshQuizzes(): Promise<void> {
  try {
    const rows = await apiListQuizzes();
    const quizzes = rows.map((r) => mapQuiz(r));
    setState({
      ...(state ?? ensure()),
      quizzes,
      quizSeq: quizzes.length,
      academicYear: activeAcademicYear(),
    });
  } catch {
    /* keep cache */
  }
}

export function getQuizState(): QuizState {
  return ensure();
}

export function useQuizState(): QuizState {
  return useSyncExternalStore(subscribe, getQuizState, () => EMPTY);
}

export function resetQuiz() {
  void refreshQuizzes();
}

function logAudit(action: string, quizCode?: string, detail?: string, user = "Admin", role = "ADMINISTRATOR") {
  const s = ensure();
  setState({
    ...s,
    audit: [
      { id: `qz_a_${Date.now()}`, action, user, role, quizCode, at: new Date().toISOString(), detail },
      ...s.audit,
    ].slice(0, 300),
  });
}

export function getQuiz(id: string): Quiz | undefined {
  const q = ensure().quizzes.find((x) => x.id === id || x.code === id);
  return q ? { ...q } : undefined;
}

export async function fetchQuizByCode(code: string): Promise<Quiz | null> {
  try {
    const row = await apiQuizByCode(code);
    return mapQuiz(row);
  } catch {
    return null;
  }
}

export function teacherCanAssign(
  teacherId: string,
  className: string,
  section: string,
  subject: string,
  academicYear?: string,
): boolean {
  const year = academicYear ?? ensure().academicYear;
  const sectionNorm = section === "All" ? null : section || null;
  return teacherAssignments(teacherId).some(
    (a) =>
      a.status === "ACTIVE" &&
      a.academicYear === year &&
      a.className === className &&
      a.subject === subject &&
      (a.section === null ||
        a.section === sectionNorm ||
        (sectionNorm === null && a.section === null) ||
        section === "All"),
  );
}

export function dashboardSummary(teacherId?: string): QuizDashboardSummary {
  let quizzes = ensure().quizzes;
  if (teacherId) quizzes = quizzes.filter((q) => q.teacherId === teacherId);

  const today = new Date().toISOString().slice(0, 10);

  return {
    totalQuizzes: quizzes.length,
    activeQuizzes: quizzes.filter((q) => q.status === "ACTIVE").length,
    draftQuizzes: quizzes.filter((q) => q.status === "DRAFT").length,
    scheduledQuizzes: quizzes.filter((q) => q.status === "SCHEDULED").length,
    expiredQuizzes: quizzes.filter((q) => q.endDate < today && q.status !== "DRAFT").length,
    completedQuizzes: quizzes.filter((q) => ["CLOSED", "PUBLISHED", "ARCHIVED"].includes(q.status)).length,
    totalAttempts: 0,
    averageScore: 0,
    pendingReviews: 0,
  };
}

export function listQuizzes(opts?: {
  teacherId?: string;
  status?: QuizStatus;
  className?: string;
  section?: string;
  subject?: string;
  search?: string;
  academicYear?: string;
}): QuizRow[] {
  const q = opts?.search?.trim().toLowerCase() ?? "";
  let quizzes = ensure().quizzes;

  if (opts?.teacherId) quizzes = quizzes.filter((x) => x.teacherId === opts.teacherId);
  if (opts?.status) quizzes = quizzes.filter((x) => x.status === opts.status);
  if (opts?.academicYear) quizzes = quizzes.filter((x) => x.academicYear === opts.academicYear);
  if (opts?.className) quizzes = quizzes.filter((x) => x.className === opts.className);
  if (opts?.section) quizzes = quizzes.filter((x) => x.section === opts.section);
  if (opts?.subject) quizzes = quizzes.filter((x) => x.subject === opts.subject);

  return quizzes
    .filter((x) => {
      if (!q) return true;
      const hay = `${x.code} ${x.title} ${x.subject} ${x.teacherName}`.toLowerCase();
      return hay.includes(q);
    })
    .map((x) => ({
      id: x.id,
      code: x.code,
      title: x.title,
      teacherName: x.teacherName,
      className: x.className,
      section: x.section,
      subject: x.subject,
      status: x.status,
      startDate: x.startDate,
      endDate: x.endDate,
      totalMarks: x.totalMarks,
      questionCount: x.questions.length,
      attemptCount: 0,
    }))
    .sort((a, b) => b.startDate.localeCompare(a.startDate));
}

export async function createQuiz(
  input: CreateQuizInput & { questions?: { question: string; options: string[]; correctAnswer: string; marks: number }[] },
): Promise<{ ok: boolean; error?: string; quiz?: Quiz }> {
  if (!input.title.trim()) return { ok: false, error: "Quiz title is required." };

  const yearId = yearIdByName(input.academicYear);
  const cls = classByName(input.className, input.academicYear);
  if (!yearId || !cls) return { ok: false, error: "Class or academic year not found." };

  const sec = getAcademicsState().sections.find(
    (s) => s.classId === cls.id && s.name === input.section,
  );
  const subj = getAcademicsState().subjects.find((s) => s.name === input.subject);

  const questions =
    input.questions ??
    ([
      {
        question: "Sample question — edit after creation",
        options: ["Option A", "Option B", "Option C", "Option D"],
        correctAnswer: "Option A",
        marks: 1,
      },
    ] as { question: string; options: string[]; correctAnswer: string; marks: number }[]);

  try {
    const row = await apiCreateQuiz({
      title: input.title.trim(),
      academicYearId: yearId,
      classId: cls.id,
      sectionId: sec?.id ?? null,
      subjectId: subj?.id ?? null,
      teacherId: input.teacherId,
      description: input.description ?? null,
      timeLimitMin: input.durationMinutes,
      maxAttempts: input.maxAttempts,
      passingMarks: input.passingMarks,
      startAt: input.startDate ? `${input.startDate}T00:00:00.000Z` : null,
      endAt: input.endDate ? `${input.endDate}T23:59:59.000Z` : null,
      shuffleQuestions: input.shuffleQuestions,
      shuffleAnswers: input.shuffleAnswers,
      showResultsImmediately: input.showResultImmediately,
      questions,
    });
    await refreshQuizzes();
    const teacher = getTeacher(input.teacherId);
    logAudit("Quiz Created", row.code, row.title, teacher?.fullName, "TEACHER");
    return { ok: true, quiz: mapQuiz(row) };
  } catch (e) {
    return { ok: false, error: apiErr(e, "Failed to create quiz.") };
  }
}

export function updateQuiz(
  id: string,
  patch: Partial<Quiz>,
): { ok: boolean; error?: string; quiz?: Quiz } {
  const s = ensure();
  const existing = s.quizzes.find((q) => q.id === id);
  if (!existing) return { ok: false, error: "Quiz not found." };
  const updated = { ...existing, ...patch, id: existing.id, code: existing.code };
  setState({ ...s, quizzes: s.quizzes.map((q) => (q.id === id ? updated : q)) });
  logAudit("Quiz Updated", updated.code);
  return { ok: true, quiz: updated };
}

export function addQuestion(
  quizId: string,
  question: Omit<QuizQuestion, "id" | "order">,
): { ok: boolean; error?: string } {
  const quiz = getQuiz(quizId);
  if (!quiz) return { ok: false, error: "Quiz not found." };
  const newQ: QuizQuestion = {
    ...question,
    id: `qq_${Date.now()}`,
    order: quiz.questions.length + 1,
  };
  return updateQuiz(quizId, { questions: [...quiz.questions, newQ] });
}

export function deleteQuestion(quizId: string, questionId: string) {
  const quiz = getQuiz(quizId);
  if (!quiz) return { ok: false, error: "Quiz not found." };
  const questions = quiz.questions
    .filter((q) => q.id !== questionId)
    .map((q, i) => ({ ...q, order: i + 1 }));
  return updateQuiz(quizId, { questions });
}

export async function publishQuiz(id: string): Promise<{ ok: boolean; error?: string }> {
  const quiz = getQuiz(id);
  if (!quiz) return { ok: false, error: "Quiz not found." };
  if (quiz.questions.length === 0) return { ok: false, error: "Add at least one question before publishing." };
  try {
    await apiPublishQuiz(id);
    await refreshQuizzes();
    logAudit("Quiz Published", quiz.code);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: apiErr(e, "Failed to publish quiz.") };
  }
}

export function closeQuiz(id: string) {
  return updateQuiz(id, { status: "CLOSED" });
}

export function deleteQuiz(id: string) {
  const s = ensure();
  const quiz = s.quizzes.find((q) => q.id === id);
  if (!quiz) return { ok: false, error: "Quiz not found." };
  setState({ ...s, quizzes: s.quizzes.filter((q) => q.id !== id) });
  logAudit("Quiz Deleted", quiz.code);
  return { ok: true };
}

export function quizzesForStudent(_studentId: string): StudentQuizRow[] {
  return [];
}

export function startAttempt(
  _quizId: string,
  _studentId: string,
): { ok: boolean; error?: string; attempt?: QuizAttempt } {
  return { ok: false, error: "Use submitQuizAttempt for API-backed quizzes." };
}

export function saveAnswer(_attemptId: string, _answer: QuizAnswer) {
  return { ok: true };
}

export async function submitQuizAttempt(
  quizCode: string,
  studentId: string,
  answers: { questionId: string; answer: string }[],
): Promise<{ ok: boolean; error?: string; score?: number | null; percentage?: number | null }> {
  try {
    const res = await apiSubmitQuizAttempt({ quizCode, studentId, answers });
    return { ok: true, score: res.score, percentage: res.percentage };
  } catch (e) {
    return { ok: false, error: apiErr(e, "Submit failed.") };
  }
}

export function submitAttempt(_attemptId: string): { ok: boolean; error?: string; attempt?: QuizAttempt } {
  return { ok: false, error: "Use submitQuizAttempt instead." };
}

const attemptsCache = new Map<string, QuizAttempt[]>();

export async function loadAttemptsForQuiz(quizId: string): Promise<QuizAttempt[]> {
  const rows = await apiQuizAttempts(quizId);
  const mapped: QuizAttempt[] = rows.map((r, i) => ({
    id: r.id,
    quizId,
    studentId: "",
    studentName: r.student.fullName,
    studentCode: r.student.code,
    attemptNumber: i + 1,
    status: "GRADED",
    obtainedMarks: r.score,
    totalMarks: 100,
    percentage: r.percentage,
    grade: r.percentage != null ? gradeFromPercentage(r.percentage) : null,
    result: r.result === "PASS" ? "PASS" : r.result === "FAIL" ? "FAIL" : null,
    startedAt: r.submittedAt ?? new Date().toISOString(),
    submittedAt: r.submittedAt,
    timeSpentSeconds: 0,
    answers: [],
  }));
  attemptsCache.set(quizId, mapped);
  return mapped;
}

export function attemptsForQuiz(quizId: string): QuizAttempt[] {
  return attemptsCache.get(quizId) ?? [];
}

export function studentQuizHistory(_studentId: string): {
  name: string;
  score: number;
  total: number;
  percentage: number;
  status: "PASSED" | "FAILED" | "PENDING";
  date: string;
  subject: string;
}[] {
  return [];
}

export function teacherQuizSummary(teacherId: string) {
  return listQuizzes({ teacherId }).map((q) => ({
    name: q.title,
    status: q.status,
    attempts: q.attemptCount,
    averageScore: 0,
    createdAt: q.startDate,
  }));
}

export function addBankItem(item: Omit<QuestionBankItem, "id" | "createdAt">) {
  const entry: QuestionBankItem = {
    ...item,
    id: `qb_${Date.now()}`,
    createdAt: new Date().toISOString(),
  };
  setState({ ...ensure(), questionBank: [entry, ...ensure().questionBank] });
  return { ok: true, item: entry };
}

export function deleteBankItem(id: string) {
  setState({ ...ensure(), questionBank: ensure().questionBank.filter((q) => q.id !== id) });
  return { ok: true };
}

export function exportQuizResultsCsv(_quizId: string) {
  /* no attempt data from list API */
}

export function quickAddMcq(
  quizId: string,
  text: string,
  marks: number,
  options: string[],
  correctIndex: number,
) {
  const opts = options.map((t, i) => ({ id: `opt_${Date.now()}_${i}`, text: t }));
  return addQuestion(quizId, {
    type: "MCQ_SINGLE",
    text,
    marks,
    options: opts,
    correctOptionIds: [opts[correctIndex]?.id ?? opts[0].id],
  });
}

export { quizStatusLabel };
