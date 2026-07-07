export type QuizStatus =
  | "DRAFT"
  | "SCHEDULED"
  | "ACTIVE"
  | "CLOSED"
  | "PUBLISHED"
  | "ARCHIVED";

export type QuestionType =
  | "MCQ_SINGLE"
  | "MCQ_MULTIPLE"
  | "TRUE_FALSE"
  | "FILL_BLANK"
  | "SHORT_ANSWER"
  | "ESSAY"
  | "MATCHING"
  | "ORDERING"
  | "IMAGE";

export type Difficulty = "EASY" | "MEDIUM" | "HARD";

export type AttemptStatus = "IN_PROGRESS" | "SUBMITTED" | "GRADED" | "EXPIRED";

export type GradeResult = "PASS" | "FAIL" | "PENDING";

export interface QuestionOption {
  id: string;
  text: string;
  imageUrl?: string | null;
}

export interface MatchingPair {
  id: string;
  left: string;
  right: string;
}

export interface QuizQuestion {
  id: string;
  type: QuestionType;
  text: string;
  imageUrl?: string | null;
  marks: number;
  options?: QuestionOption[];
  correctOptionIds?: string[];
  correctText?: string;
  trueFalseAnswer?: boolean;
  matchingPairs?: MatchingPair[];
  correctOrder?: string[];
  explanation?: string | null;
  order: number;
  bankId?: string | null;
}

export interface QuestionBankItem {
  id: string;
  subject: string;
  difficulty: Difficulty;
  marks: number;
  type: QuestionType;
  text: string;
  correctAnswer: string;
  explanation?: string | null;
  createdAt: string;
}

export interface Quiz {
  id: string;
  code: string;
  title: string;
  academicYear: string;
  className: string;
  section: string;
  subject: string;
  description?: string | null;
  teacherId: string;
  teacherName: string;
  startDate: string;
  endDate: string;
  durationMinutes: number;
  totalMarks: number;
  passingMarks: number;
  maxAttempts: number;
  shuffleQuestions: boolean;
  shuffleAnswers: boolean;
  showResultImmediately: boolean;
  allowResume: boolean;
  status: QuizStatus;
  questions: QuizQuestion[];
  linkPath: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string | null;
}

export interface QuizAnswer {
  questionId: string;
  selectedOptionIds?: string[];
  textAnswer?: string;
  booleanAnswer?: boolean;
  matchingAnswers?: Record<string, string>;
  orderAnswer?: string[];
  marksAwarded?: number | null;
  manuallyGraded?: boolean;
}

export interface QuizAttempt {
  id: string;
  quizId: string;
  studentId: string;
  studentName: string;
  studentCode: string;
  attemptNumber: number;
  status: AttemptStatus;
  answers: QuizAnswer[];
  startedAt: string;
  submittedAt?: string | null;
  timeSpentSeconds: number;
  totalMarks: number;
  obtainedMarks: number | null;
  percentage: number | null;
  grade: string | null;
  result: GradeResult | null;
  autoSavedAt?: string | null;
}

export interface QuizAuditEntry {
  id: string;
  action: string;
  user: string;
  role: string;
  quizCode?: string;
  at: string;
  detail?: string;
}

export interface QuizNotification {
  id: string;
  audience: "STUDENT" | "TEACHER" | "ADMIN";
  message: string;
  quizId?: string;
  at: string;
  read: boolean;
}

export interface QuizState {
  quizzes: Quiz[];
  questionBank: QuestionBankItem[];
  attempts: QuizAttempt[];
  audit: QuizAuditEntry[];
  notifications: QuizNotification[];
  quizSeq: number;
  academicYear: string;
}

export interface QuizDashboardSummary {
  totalQuizzes: number;
  activeQuizzes: number;
  draftQuizzes: number;
  scheduledQuizzes: number;
  expiredQuizzes: number;
  completedQuizzes: number;
  totalAttempts: number;
  averageScore: number;
  pendingReviews: number;
}

export interface QuizRow {
  id: string;
  code: string;
  title: string;
  teacherName: string;
  className: string;
  section: string;
  subject: string;
  status: QuizStatus;
  startDate: string;
  endDate: string;
  totalMarks: number;
  questionCount: number;
  attemptCount: number;
}

export interface CreateQuizInput {
  title: string;
  academicYear: string;
  className: string;
  section: string;
  subject: string;
  description?: string | null;
  teacherId: string;
  startDate: string;
  endDate: string;
  durationMinutes: number;
  passingMarks: number;
  maxAttempts: number;
  shuffleQuestions?: boolean;
  shuffleAnswers?: boolean;
  showResultImmediately?: boolean;
  allowResume?: boolean;
  status?: QuizStatus;
}

export interface StudentQuizRow {
  quizId: string;
  quizCode: string;
  title: string;
  subject: string;
  status: QuizStatus;
  attemptDate: string | null;
  marksObtained: number | null;
  totalMarks: number;
  percentage: number | null;
  grade: string | null;
  result: GradeResult | null;
  canAttempt: boolean;
}
