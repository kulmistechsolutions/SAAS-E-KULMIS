"use client";

import { useSyncExternalStore } from "react";
import { getState as getStudentsState } from "@/lib/students/store";
import { getTeacher, getTeachersState, teacherAssignments } from "@/lib/teachers/store";
import { buildSeed } from "./seed";
import {
  gradeFromPercentage,
  quizCode,
  quizStatusLabel,
} from "./format";
import type {
  CreateQuizInput,
  QuestionBankItem,
  QuestionType,
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

const KEY = "ekulmis_quiz_v1";

const EMPTY: QuizState = {
  quizzes: [],
  questionBank: [],
  attempts: [],
  audit: [],
  notifications: [],
  quizSeq: 0,
  academicYear: "2024-2025",
};

let state: QuizState | null = null;
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
  const raw = localStorage.getItem(KEY);
  if (raw) {
    try {
      state = JSON.parse(raw) as QuizState;
      return state;
    } catch {
      /* fall through */
    }
  }
  state = buildSeed();
  localStorage.setItem(KEY, JSON.stringify(state));
  return state;
}

function setState(next: QuizState) {
  state = next;
  if (typeof window !== "undefined") localStorage.setItem(KEY, JSON.stringify(next));
  emit();
}

export function getQuizState(): QuizState {
  return ensure();
}

export function useQuizState(): QuizState {
  return useSyncExternalStore(subscribe, getQuizState, () => EMPTY);
}

export function resetQuiz() {
  setState(buildSeed());
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

function notify(audience: "STUDENT" | "TEACHER" | "ADMIN", message: string, quizId?: string) {
  const s = ensure();
  setState({
    ...ensure(),
    notifications: [
      { id: `qn_${Date.now()}`, audience, message, quizId, at: new Date().toISOString(), read: false },
      ...s.notifications,
    ].slice(0, 80),
  });
}

function recomputeTotalMarks(quiz: Quiz): Quiz {
  const totalMarks = quiz.questions.reduce((s, q) => s + q.marks, 0);
  return { ...quiz, totalMarks, updatedAt: new Date().toISOString() };
}

function effectiveStatus(quiz: Quiz): QuizStatus {
  const today = new Date().toISOString().slice(0, 10);
  if (quiz.status === "DRAFT" || quiz.status === "ARCHIVED") return quiz.status;
  if (quiz.status === "CLOSED" || quiz.status === "PUBLISHED") return quiz.status;
  if (quiz.endDate < today) return "CLOSED";
  if (quiz.startDate > today) return "SCHEDULED";
  if (quiz.status === "SCHEDULED" && quiz.startDate <= today) return "ACTIVE";
  return quiz.status;
}

export function getQuiz(id: string): Quiz | undefined {
  const q = ensure().quizzes.find((x) => x.id === id || x.code === id);
  return q ? { ...q, status: effectiveStatus(q) } : undefined;
}

export function teacherCanAssign(
  teacherId: string,
  className: string,
  section: string,
  subject: string,
  academicYear?: string,
): boolean {
  const year = academicYear ?? ensure().academicYear;
  return teacherAssignments(teacherId).some(
    (a) =>
      a.status === "ACTIVE" &&
      a.academicYear === year &&
      a.className === className &&
      (a.section === section || a.section === null) &&
      a.subject === subject,
  );
}

export function dashboardSummary(teacherId?: string): QuizDashboardSummary {
  let quizzes = ensure().quizzes.map((q) => ({ ...q, status: effectiveStatus(q) }));
  if (teacherId) quizzes = quizzes.filter((q) => q.teacherId === teacherId);

  const attempts = teacherId
    ? ensure().attempts.filter((a) => {
        const q = getQuiz(a.quizId);
        return q?.teacherId === teacherId;
      })
    : ensure().attempts;

  const graded = attempts.filter((a) => a.percentage !== null);
  const avg =
    graded.length > 0
      ? graded.reduce((s, a) => s + (a.percentage ?? 0), 0) / graded.length
      : 0;

  const today = new Date().toISOString().slice(0, 10);

  return {
    totalQuizzes: quizzes.length,
    activeQuizzes: quizzes.filter((q) => q.status === "ACTIVE").length,
    draftQuizzes: quizzes.filter((q) => q.status === "DRAFT").length,
    scheduledQuizzes: quizzes.filter((q) => q.status === "SCHEDULED").length,
    expiredQuizzes: quizzes.filter((q) => q.endDate < today && q.status !== "DRAFT").length,
    completedQuizzes: quizzes.filter((q) => ["CLOSED", "PUBLISHED", "ARCHIVED"].includes(q.status)).length,
    totalAttempts: attempts.length,
    averageScore: Math.round(avg * 10) / 10,
    pendingReviews: attempts.filter((a) => a.status === "SUBMITTED" && a.result === "PENDING").length,
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
  let quizzes = ensure().quizzes.map((x) => ({ ...x, status: effectiveStatus(x) }));

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
      attemptCount: ensure().attempts.filter((a) => a.quizId === x.id).length,
    }))
    .sort((a, b) => b.startDate.localeCompare(a.startDate));
}

export function createQuiz(
  input: CreateQuizInput,
): { ok: boolean; error?: string; quiz?: Quiz } {
  const s = ensure();
  if (!input.title.trim()) return { ok: false, error: "Quiz title is required." };
  if (!teacherCanAssign(input.teacherId, input.className, input.section, input.subject, input.academicYear)) {
    return { ok: false, error: "Teacher is not assigned to this class, section, and subject." };
  }
  const dup = s.quizzes.some(
    (q) =>
      q.title.toLowerCase() === input.title.trim().toLowerCase() &&
      q.className === input.className &&
      q.subject === input.subject &&
      q.academicYear === input.academicYear,
  );
  if (dup) return { ok: false, error: "A quiz with this title already exists for this class and subject." };

  const teacher = getTeacher(input.teacherId);
  const seq = s.quizSeq + 1;
  const code = quizCode(seq);
  const now = new Date().toISOString();
  const quiz: Quiz = {
    id: `quiz_${Date.now()}`,
    code,
    title: input.title.trim(),
    academicYear: input.academicYear,
    className: input.className,
    section: input.section,
    subject: input.subject,
    description: input.description ?? null,
    teacherId: input.teacherId,
    teacherName: teacher?.fullName ?? "Teacher",
    startDate: input.startDate,
    endDate: input.endDate,
    durationMinutes: input.durationMinutes,
    totalMarks: 0,
    passingMarks: input.passingMarks,
    maxAttempts: input.maxAttempts,
    shuffleQuestions: input.shuffleQuestions ?? false,
    shuffleAnswers: input.shuffleAnswers ?? false,
    showResultImmediately: input.showResultImmediately ?? true,
    allowResume: input.allowResume ?? true,
    status: input.status ?? "DRAFT",
    questions: [],
    linkPath: `/quiz/take/${code}`,
    createdAt: now,
    updatedAt: now,
  };

  setState({ ...ensure(), quizzes: [quiz, ...s.quizzes], quizSeq: seq });
  logAudit("Quiz Created", code, quiz.title, teacher?.fullName, "TEACHER");
  notify("ADMIN", `Quiz created: ${quiz.title}`, quiz.id);
  return { ok: true, quiz };
}

export function updateQuiz(
  id: string,
  patch: Partial<Quiz>,
): { ok: boolean; error?: string; quiz?: Quiz } {
  const s = ensure();
  const existing = s.quizzes.find((q) => q.id === id);
  if (!existing) return { ok: false, error: "Quiz not found." };
  const updated = recomputeTotalMarks({ ...existing, ...patch, id: existing.id, code: existing.code });
  setState({
    ...ensure(),
    quizzes: s.quizzes.map((q) => (q.id === id ? updated : q)),
  });
  logAudit("Quiz Updated", updated.code);
  return { ok: true, quiz: updated };
}

export function addQuestion(
  quizId: string,
  question: Omit<QuizQuestion, "id" | "order">,
): { ok: boolean; error?: string } {
  const quiz = getQuiz(quizId);
  if (!quiz) return { ok: false, error: "Quiz not found." };
  if (question.marks <= 0) return { ok: false, error: "Question marks must be positive." };
  const newQ: QuizQuestion = {
    ...question,
    id: `qq_${Date.now()}`,
    order: quiz.questions.length + 1,
  };
  const next = recomputeTotalMarks({ ...quiz, questions: [...quiz.questions, newQ] });
  if (next.totalMarks > quiz.totalMarks + question.marks && quiz.totalMarks > 0) {
    /* allow growing total */
  }
  return updateQuiz(quizId, { questions: next.questions });
}

export function deleteQuestion(quizId: string, questionId: string) {
  const quiz = getQuiz(quizId);
  if (!quiz) return { ok: false, error: "Quiz not found." };
  const questions = quiz.questions
    .filter((q) => q.id !== questionId)
    .map((q, i) => ({ ...q, order: i + 1 }));
  return updateQuiz(quizId, { questions });
}

export function publishQuiz(id: string): { ok: boolean; error?: string } {
  const quiz = getQuiz(id);
  if (!quiz) return { ok: false, error: "Quiz not found." };
  if (quiz.questions.length === 0) return { ok: false, error: "Add at least one question before publishing." };
  const res = updateQuiz(id, {
    status: quiz.startDate > new Date().toISOString().slice(0, 10) ? "SCHEDULED" : "ACTIVE",
    publishedAt: new Date().toISOString(),
    totalMarks: quiz.questions.reduce((s, q) => s + q.marks, 0),
  });
  if (res.ok) {
    logAudit("Quiz Published", quiz.code);
    notify("STUDENT", `New quiz available: ${quiz.title}`, quiz.id);
    notify("ADMIN", `Quiz published: ${quiz.title}`, quiz.id);
  }
  return res;
}

export function closeQuiz(id: string) {
  const quiz = getQuiz(id);
  if (!quiz) return { ok: false, error: "Quiz not found." };
  const res = updateQuiz(id, { status: "CLOSED" });
  if (res.ok) {
    logAudit("Quiz Closed", quiz.code);
    notify("STUDENT", `Quiz closing: ${quiz.title}`, quiz.id);
  }
  return res;
}

export function deleteQuiz(id: string) {
  const s = ensure();
  const quiz = s.quizzes.find((q) => q.id === id);
  if (!quiz) return { ok: false, error: "Quiz not found." };
  setState({ ...ensure(), quizzes: s.quizzes.filter((q) => q.id !== id) });
  logAudit("Quiz Deleted", quiz.code);
  return { ok: true };
}

function gradeAnswer(question: QuizQuestion, answer?: QuizAnswer): number | null {
  if (!answer) return 0;
  switch (question.type) {
    case "MCQ_SINGLE":
    case "IMAGE":
      return answer.selectedOptionIds?.[0] === question.correctOptionIds?.[0]
        ? question.marks
        : 0;
    case "MCQ_MULTIPLE": {
      const correct = new Set(question.correctOptionIds ?? []);
      const selected = new Set(answer.selectedOptionIds ?? []);
      if (correct.size !== selected.size) return 0;
      for (const id of correct) if (!selected.has(id)) return 0;
      return question.marks;
    }
    case "TRUE_FALSE":
      return answer.booleanAnswer === question.trueFalseAnswer ? question.marks : 0;
    case "FILL_BLANK":
      return (answer.textAnswer ?? "").trim().toLowerCase() ===
        (question.correctText ?? "").trim().toLowerCase()
        ? question.marks
        : 0;
    case "SHORT_ANSWER":
    case "ESSAY":
      return null;
    default:
      return 0;
  }
}

export function quizzesForStudent(studentId: string): StudentQuizRow[] {
  const student = getStudentsState().students.find((s) => s.id === studentId);
  if (!student) return [];
  const today = new Date().toISOString().slice(0, 10);

  return ensure()
    .quizzes.map((q) => ({ ...q, status: effectiveStatus(q) }))
    .filter(
      (q) =>
        q.className === student.className &&
        q.section === student.section &&
        ["ACTIVE", "SCHEDULED", "CLOSED", "PUBLISHED"].includes(q.status),
    )
    .map((q) => {
      const studentAttempts = ensure().attempts.filter(
        (a) => a.quizId === q.id && a.studentId === studentId,
      );
      const last = studentAttempts.sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
      const canAttempt =
        q.status === "ACTIVE" &&
        q.startDate <= today &&
        q.endDate >= today &&
        studentAttempts.length < q.maxAttempts;

      return {
        quizId: q.id,
        quizCode: q.code,
        title: q.title,
        subject: q.subject,
        status: q.status,
        attemptDate: last?.submittedAt ?? last?.startedAt ?? null,
        marksObtained: last?.obtainedMarks ?? null,
        totalMarks: q.totalMarks,
        percentage: last?.percentage ?? null,
        grade: last?.grade ?? null,
        result: last?.result ?? null,
        canAttempt,
      };
    });
}

export function startAttempt(
  quizId: string,
  studentId: string,
): { ok: boolean; error?: string; attempt?: QuizAttempt } {
  const quiz = getQuiz(quizId);
  const student = getStudentsState().students.find((s) => s.id === studentId);
  if (!quiz || !student) return { ok: false, error: "Quiz or student not found." };
  if (student.className !== quiz.className || student.section !== quiz.section) {
    return { ok: false, error: "You are not assigned to this quiz." };
  }
  const today = new Date().toISOString().slice(0, 10);
  if (quiz.status !== "ACTIVE" || quiz.startDate > today || quiz.endDate < today) {
    return { ok: false, error: "Quiz is not currently available." };
  }

  const s = ensure();
  const existing = s.attempts.filter((a) => a.quizId === quizId && a.studentId === studentId);
  if (existing.length >= quiz.maxAttempts) {
    return { ok: false, error: "Maximum attempts reached." };
  }
  const inProgress = existing.find((a) => a.status === "IN_PROGRESS");
  if (inProgress && quiz.allowResume) return { ok: true, attempt: inProgress };

  const attempt: QuizAttempt = {
    id: `att_${Date.now()}`,
    quizId,
    studentId,
    studentName: student.fullName,
    studentCode: student.code,
    attemptNumber: existing.length + 1,
    status: "IN_PROGRESS",
    answers: [],
    startedAt: new Date().toISOString(),
    timeSpentSeconds: 0,
    totalMarks: quiz.totalMarks,
    obtainedMarks: null,
    percentage: null,
    grade: null,
    result: null,
  };
  setState({ ...ensure(), attempts: [attempt, ...s.attempts] });
  logAudit("Student Started Quiz", quiz.code, student.fullName, student.fullName, "STUDENT");
  return { ok: true, attempt };
}

export function saveAnswer(attemptId: string, answer: QuizAnswer) {
  const s = ensure();
  const attempt = s.attempts.find((a) => a.id === attemptId);
  if (!attempt || attempt.status !== "IN_PROGRESS") return { ok: false };
  const answers = [...attempt.answers.filter((a) => a.questionId !== answer.questionId), answer];
  setState({
    ...ensure(),
    attempts: s.attempts.map((a) =>
      a.id === attemptId
        ? { ...a, answers, autoSavedAt: new Date().toISOString() }
        : a,
    ),
  });
  return { ok: true };
}

export function submitAttempt(attemptId: string): { ok: boolean; error?: string; attempt?: QuizAttempt } {
  const s = ensure();
  const attempt = s.attempts.find((a) => a.id === attemptId);
  if (!attempt) return { ok: false, error: "Attempt not found." };
  const quiz = getQuiz(attempt.quizId);
  if (!quiz) return { ok: false, error: "Quiz not found." };
  if (new Date().toISOString().slice(0, 10) > quiz.endDate) {
    return { ok: false, error: "Quiz submission deadline has passed." };
  }

  let obtained = 0;
  let pending = false;
  for (const q of quiz.questions) {
    const ans = attempt.answers.find((a) => a.questionId === q.id);
    const marks = gradeAnswer(q, ans);
    if (marks === null) pending = true;
    else obtained += marks;
  }

  const percentage = quiz.totalMarks > 0 ? Math.round((obtained / quiz.totalMarks) * 100) : 0;
  const result = pending ? "PENDING" : obtained >= quiz.passingMarks ? "PASS" : "FAIL";
  const updated: QuizAttempt = {
    ...attempt,
    status: pending ? "SUBMITTED" : "GRADED",
    submittedAt: new Date().toISOString(),
    obtainedMarks: pending ? null : obtained,
    percentage: pending ? null : percentage,
    grade: pending ? null : gradeFromPercentage(percentage),
    result,
  };

  setState({
    ...ensure(),
    attempts: s.attempts.map((a) => (a.id === attemptId ? updated : a)),
  });
  logAudit("Student Submitted Quiz", quiz.code, attempt.studentName, attempt.studentName, "STUDENT");
  notify("TEACHER", `Quiz submitted: ${quiz.title} by ${attempt.studentName}`, quiz.id);
  if (pending) notify("TEACHER", `Manual grading required: ${quiz.title}`, quiz.id);
  return { ok: true, attempt: updated };
}

export function attemptsForQuiz(quizId: string) {
  return ensure()
    .attempts.filter((a) => a.quizId === quizId)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export function studentQuizHistory(studentId: string) {
  return ensure()
    .attempts.filter((a) => a.studentId === studentId && a.status !== "IN_PROGRESS")
    .map((a) => {
      const q = getQuiz(a.quizId);
      return {
        name: q?.title ?? "Quiz",
        score: a.obtainedMarks ?? 0,
        total: a.totalMarks,
        percentage: a.percentage ?? 0,
        status: a.result === "PASS" ? ("PASSED" as const) : a.result === "FAIL" ? ("FAILED" as const) : ("PENDING" as const),
        date: a.submittedAt ?? a.startedAt,
        subject: q?.subject ?? "—",
      };
    });
}

export function teacherQuizSummary(teacherId: string) {
  return listQuizzes({ teacherId }).map((q) => ({
    name: q.title,
    status: q.status,
    attempts: q.attemptCount,
    averageScore:
      ensure()
        .attempts.filter((a) => a.quizId === q.id && a.percentage !== null)
        .reduce((s, a, _, arr) => s + (a.percentage ?? 0) / arr.length, 0) || 0,
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
  setState({
    ...ensure(),
    questionBank: ensure().questionBank.filter((q) => q.id !== id),
  });
  return { ok: true };
}

export function exportQuizResultsCsv(quizId: string) {
  const quiz = getQuiz(quizId);
  if (!quiz) return;
  const rows = attemptsForQuiz(quizId);
  const header = "Student ID,Name,Attempt,Score,Total,Percentage,Grade,Result,Submitted\n";
  const body = rows
    .map((r) =>
      [
        r.studentCode,
        `"${r.studentName}"`,
        r.attemptNumber,
        r.obtainedMarks ?? "",
        r.totalMarks,
        r.percentage ?? "",
        r.grade ?? "",
        r.result ?? "",
        r.submittedAt?.slice(0, 10) ?? "",
      ].join(","),
    )
    .join("\n");
  const blob = new Blob([header + body], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${quiz.code}-results.csv`;
  a.click();
  URL.revokeObjectURL(url);
  logAudit("Quiz Report Exported", quiz.code);
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
