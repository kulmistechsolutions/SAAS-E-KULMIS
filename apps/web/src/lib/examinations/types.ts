export type ExamStatus =
  | "DRAFT"
  | "OPEN"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "LOCKED"
  | "PUBLISHED"
  | "ARCHIVED";

export type ExamType = "TEACHER_ASSESSMENT" | "SCHOOL_IMPORT";

export type SubmissionStatus = "PENDING" | "SUBMITTED" | "LOCKED";

export interface ExamGroup {
  id: string;
  name: string;
  academicYear: string;
  description?: string | null;
}

export interface Exam {
  id: string;
  name: string;
  academicYear: string;
  examType: ExamType;
  examGroupId?: string | null;
  term: string;
  maxMarks: number;
  weightPercent: number;
  startDate: string;
  endDate: string;
  status: ExamStatus;
  className: string;
  section: string;
  subjects: string[];
  createdAt: string;
  createdBy: string;
}

export interface ExamMark {
  id: string;
  examId: string;
  studentId: string;
  subject: string;
  marks: number | null;
  enteredBy?: string | null;
  enteredAt?: string | null;
}

export interface BlockedStudent {
  id: string;
  studentId: string;
  examId?: string | null;
  academicYear: string;
  reason: string;
  blockedAt: string;
  blockedBy: string;
}

export interface ExamAuditEntry {
  id: string;
  action: string;
  user: string;
  role: string;
  at: string;
  detail?: string;
}

export interface ExaminationsState {
  examGroups: ExamGroup[];
  exams: Exam[];
  marks: ExamMark[];
  blockedStudents: BlockedStudent[];
  audit: ExamAuditEntry[];
  examSeq: number;
  groupSeq: number;
}

export interface ExamDashboardSummary {
  totalExams: number;
  activeExams: number;
  draftExams: number;
  lockedExams: number;
  publishedExams: number;
  pendingSubmissions: number;
  completedSubmissions: number;
  examGroups: number;
  resultPublications: number;
}

export interface MonitoringRow {
  examId: string;
  examName: string;
  className: string;
  section: string;
  subject: string;
  teacherName: string;
  status: SubmissionStatus;
}

export interface StudentResultRow {
  subject: string;
  maxMarks: number;
  marksObtained: number;
  grade: string;
}

export interface StudentExamResult {
  examId: string;
  examName: string;
  term: string;
  weightPercent: number;
  subjects: StudentResultRow[];
  totalObtained: number;
  totalMax: number;
  average: number;
  grade: string;
  passed: boolean;
}

export interface StudentFinalResult {
  studentId: string;
  studentCode: string;
  studentName: string;
  className: string;
  section: string;
  academicYear: string;
  termResults: StudentExamResult[];
  finalAverage: number;
  finalGrade: string;
  passed: boolean;
  subjectBreakdown: {
    subject: string;
    termMarks: Record<string, number | null>;
    finalMarks: number;
    total: number;
    average: number;
    grade: string;
  }[];
}

export interface CreateExamInput {
  name: string;
  academicYear: string;
  examType: ExamType;
  examGroupId?: string | null;
  term: string;
  maxMarks: number;
  weightPercent: number;
  startDate: string;
  endDate: string;
  classNames: string[];
  sections: string[];
  createdBy?: string;
}

export interface ImportSummary {
  imported: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: string[];
}
