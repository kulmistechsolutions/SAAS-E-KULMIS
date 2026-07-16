"use client";

import { api } from "@/lib/api";

export interface QuizMatchPair {
  left: string;
  right: string;
}

export interface ApiQuizQuestion {
  id: string;
  question: string;
  questionType?: string;
  options: string[] | unknown;
  correctAnswer?: string;
  gradingMode?: "EXACT" | "AI_CONCEPT";
  pairs?: QuizMatchPair[] | null;
  blanks?: string[] | null;
  marks: number;
  orderIndex?: number;
  requiresManualGrade?: boolean;
  // Public student-view only (answers stripped): MATCH prompts + shuffled choices,
  // and the number of blanks to render for FILL_BLANK.
  matchLeft?: string[];
  matchChoices?: string[];
  blankCount?: number;
}

export interface QuizBuilderQuestion {
  question: string;
  questionType: "MCQ" | "DIRECT" | "MATCH" | "FILL_BLANK";
  options?: string[];
  correctAnswer?: string;
  gradingMode?: "EXACT" | "AI_CONCEPT";
  pairs?: QuizMatchPair[];
  blanks?: string[];
  marks: number;
}

export interface ApiQuiz {
  id: string;
  title: string;
  code: string;
  academicYearId: string;
  classId: string;
  sectionId: string | null;
  subjectId?: string | null;
  teacherId: string;
  description: string | null;
  status: "DRAFT" | "PUBLISHED" | "CLOSED" | "ARCHIVED";
  timeLimitMin: number | null;
  maxAttempts: number;
  passingMarks?: number | null;
  startAt?: string | null;
  endAt?: string | null;
  shuffleQuestions?: boolean;
  shuffleAnswers?: boolean;
  showResultsImmediately?: boolean;
  instructions?: string | null;
  preventMinimize?: boolean;
  disableCopyPaste?: boolean;
  resetOnMinimize?: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  class?: { name: string };
  section?: { name: string } | null;
  subject?: { name: string } | null;
  teacher?: { fullName: string };
  questions?: ApiQuizQuestion[];
  _count?: { questions: number; attempts: number };
}

export interface ApiQuizAttemptResult {
  id: string;
  quizId: string;
  studentId: string;
  status: string;
  score: number | null;
  percentage: number | null;
  result: string | null;
  submittedAt: string | null;
}

export interface QuizAccessResponse {
  studentId: string;
  studentCode: string;
  studentName: string;
  remainingAttempts: number;
  quiz: {
    id: string;
    title: string;
    code: string;
    className: string;
    section: string | null;
    subject: string | null;
    description: string | null;
    timeLimitMin: number | null;
    maxAttempts: number;
    showResultsImmediately: boolean;
  };
}

export interface QuizDashboardResponse {
  totalQuizzes: number;
  activeQuizzes: number;
  draftQuizzes: number;
  completedQuizzes: number;
  totalAttempts: number;
  averageScore: number;
  pendingReviews: number;
}

export interface QuizMonitoringResponse {
  summary: {
    totalQuizzes: number;
    draft: number;
    published: number;
    closed: number;
    archived: number;
    totalAttempts: number;
  };
  quizzes: {
    id: string;
    title: string;
    code: string;
    status: string;
    teacherName: string;
    className: string;
    section: string | null;
    subject: string | null;
    attemptCount: number;
    averageScore: number;
    startAt: string | null;
    endAt: string | null;
  }[];
}

export const apiListQuizzes = (opts?: { academicYearId?: string; classId?: string }) => {
  const params = new URLSearchParams();
  if (opts?.academicYearId) params.set("academicYearId", opts.academicYearId);
  if (opts?.classId) params.set("classId", opts.classId);
  const q = params.toString();
  return api<ApiQuiz[]>(`/quiz${q ? `?${q}` : ""}`);
};

export const apiQuizDashboard = () => api<QuizDashboardResponse>("/quiz/dashboard");

export const apiQuizMonitoring = () => api<QuizMonitoringResponse>("/quiz/monitoring");

export interface QuizLiveStudentRow {
  no: number;
  studentId: string;
  studentCode: string;
  studentName: string;
  className: string;
  section: string | null;
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "TIME_EXPIRED";
  attemptId: string | null;
  startTime: string | null;
  finishTime: string | null;
  score: number | null;
  percentage: number | null;
}

export interface QuizLiveMonitoringResponse {
  quiz: {
    id: string;
    title: string;
    code: string;
    status: string;
    timeLimitMin: number | null;
    className: string;
    section: string | null;
  };
  summary: {
    total: number;
    notStarted: number;
    inProgress: number;
    completed: number;
    timeExpired: number;
  };
  students: QuizLiveStudentRow[];
}

export const apiQuizLiveMonitoring = (quizId: string) =>
  api<QuizLiveMonitoringResponse>(`/quiz/${quizId}/live`);

export const apiCreateQuiz = (body: {
  title: string;
  academicYearId: string;
  classId: string;
  sectionId?: string | null;
  subjectId?: string | null;
  teacherId: string;
  description?: string | null;
  timeLimitMin?: number | null;
  maxAttempts?: number;
  passingMarks?: number | null;
  startAt?: string | null;
  endAt?: string | null;
  shuffleQuestions?: boolean;
  shuffleAnswers?: boolean;
  showResultsImmediately?: boolean;
  questions: {
    question: string;
    questionType?: string;
    options: string[];
    correctAnswer: string;
    marks: number;
  }[];
}) => api<ApiQuiz>("/quiz", { method: "POST", body });

export const apiPublishQuiz = (id: string) =>
  api<ApiQuiz>(`/quiz/${id}/publish`, { method: "PATCH" });

export const apiCloseQuiz = (id: string) =>
  api<ApiQuiz>(`/quiz/${id}/close`, { method: "PATCH" });

export const apiArchiveQuiz = (id: string) =>
  api<ApiQuiz>(`/quiz/${id}/archive`, { method: "PATCH" });

export const apiGetQuiz = (id: string) => api<ApiQuiz>(`/quiz/${id}`);

export const apiUpdateQuizBuilder = (
  id: string,
  body: {
    title?: string;
    description?: string | null;
    instructions?: string | null;
    timeLimitMin?: number | null;
    passingMarks?: number | null;
    maxAttempts?: number;
    shuffleQuestions?: boolean;
    shuffleAnswers?: boolean;
    showResultsImmediately?: boolean;
    preventMinimize?: boolean;
    disableCopyPaste?: boolean;
    resetOnMinimize?: boolean;
    questions?: QuizBuilderQuestion[];
  },
) => api<ApiQuiz>(`/quiz/${id}/builder`, { method: "PATCH", body });

export const apiQuizAttempts = (quizId: string) =>
  api<
    {
      id: string;
      score: number | null;
      percentage: number | null;
      result: string | null;
      status: string;
      submittedAt: string | null;
      student: {
        code: string;
        fullName: string;
        class?: { name: string };
        section?: { name: string | null };
      };
    }[]
  >(`/quiz/${quizId}/attempts`);

export const apiVerifyQuizAccess = (body: {
  quizCode: string;
  studentCode: string;
  password: string;
}) =>
  api<QuizAccessResponse>("/quiz/verify-access", {
    method: "POST",
    body,
    auth: false,
  });

export const apiQuizByCode = (code: string) =>
  api<ApiQuiz>(`/quiz/code/${encodeURIComponent(code)}`, { auth: false });

export const apiSubmitQuizAttempt = (body: {
  quizCode: string;
  studentId: string;
  answers: { questionId: string; answer: string }[];
}) => api<ApiQuizAttemptResult>("/quiz/attempt", { method: "POST", body, auth: false });

export const apiGradeQuizAnswer = (
  attemptId: string,
  answerId: string,
  marks: number,
) =>
  api(`/quiz/attempts/${attemptId}/answers/${answerId}/grade`, {
    method: "PATCH",
    body: { marks },
  });
