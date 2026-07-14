"use client";

import { api, getAccessToken } from "@/lib/api";
import type { ExamStatus, ExamType } from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const TENANT = process.env.NEXT_PUBLIC_TENANT_SUBDOMAIN ?? "demo";

// ── Raw API shapes ──

export interface ApiExamGroup {
  id: string;
  name: string;
  academicYearId: string;
  description: string | null;
  academicYear?: { name: string };
}

export interface ApiExam {
  id: string;
  name: string;
  academicYearId: string;
  examGroupId: string | null;
  examType: ExamType;
  term: string;
  maxMarks: number;
  weightPercent: number;
  startDate: string;
  endDate: string;
  status: ExamStatus;
  classId: string;
  sectionId: string | null;
  createdAt: string;
  createdByUserId: string | null;
  class: { name: string };
  section: { name: string } | null;
  academicYear: { name: string };
  examGroup: { name: string } | null;
  subjects: { subjectId: string; subject: { name: string } }[];
}

export interface ApiExamMark {
  id: string;
  examId: string;
  studentId: string;
  subjectId: string;
  marks: number | null;
  enteredAt: string | null;
  student: { id: string; code: string; fullName: string };
  subject: { id: string; name: string };
}

export interface ApiBlockedStudent {
  id: string;
  studentId: string;
  examId: string | null;
  academicYearId: string;
  reason: string;
  blockedAt: string;
  blockedByUserId: string | null;
  student: { code: string; fullName: string };
  exam: { name: string } | null;
}

export interface ApiMonitoringRow {
  examId: string;
  examName: string;
  className: string;
  section: string | null;
  subject: string;
  teacherName: string | null;
  status: "PENDING" | "SUBMITTED" | "LOCKED";
}

export interface ApiExamDashboard {
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

export interface ApiStudentResultSubject {
  subject: string;
  maxMarks: number;
  marksObtained: number | null;
  grade: string;
}

export interface ApiStudentExamResult {
  examId: string;
  examName: string;
  term: string;
  weightPercent: number;
  subjects: ApiStudentResultSubject[];
  totalObtained: number;
  totalMax: number;
  average: number;
  grade: string;
  passed: boolean;
}

export interface ApiStudentFinalResult {
  studentId: string;
  studentCode: string;
  studentName: string;
  className: string;
  section: string | null;
  academicYearId: string;
  termResults: ApiStudentExamResult[];
  finalAverage: number;
  finalGrade: string;
  passed: boolean;
}

// ── Reads ──

export const apiExamDashboard = () => api<ApiExamDashboard>("/examinations/dashboard");

export const apiListExamGroups = (academicYearId?: string) =>
  api<ApiExamGroup[]>(
    `/examinations/groups${academicYearId ? `?academicYearId=${encodeURIComponent(academicYearId)}` : ""}`,
  );

export const apiListExams = (opts?: { academicYearId?: string; classId?: string }) => {
  const params = new URLSearchParams();
  if (opts?.academicYearId) params.set("academicYearId", opts.academicYearId);
  if (opts?.classId) params.set("classId", opts.classId);
  const q = params.toString();
  return api<ApiExam[]>(`/examinations${q ? `?${q}` : ""}`);
};

export const apiExamMonitoring = (examId?: string) =>
  api<ApiMonitoringRow[]>(
    `/examinations/monitoring${examId ? `?examId=${encodeURIComponent(examId)}` : ""}`,
  );

export const apiListBlocked = () => api<ApiBlockedStudent[]>("/examinations/blocked");

export const apiExamMarks = (examId: string) =>
  api<ApiExamMark[]>(`/examinations/${examId}/marks`);

export interface ApiExamRosterStudent {
  id: string;
  code: string;
  fullName: string;
}

export const apiExamRoster = (examId: string) =>
  api<ApiExamRosterStudent[]>(`/examinations/${examId}/roster`);

export const apiStudentResults = (studentId: string, academicYearId?: string) =>
  api<ApiStudentFinalResult>(
    `/examinations/results/${studentId}${academicYearId ? `?academicYearId=${encodeURIComponent(academicYearId)}` : ""}`,
  );

// ── Writes ──

export const apiCreateExamGroup = (body: {
  name: string;
  academicYearId: string;
  description?: string | null;
}) => api<ApiExamGroup>("/examinations/groups", { method: "POST", body });

export const apiCreateExam = (body: {
  name: string;
  academicYearId: string;
  examGroupId?: string | null;
  examType: ExamType;
  term: string;
  maxMarks: number;
  weightPercent: number;
  startDate: string;
  endDate: string;
  classId: string;
  sectionId?: string | null;
  subjectIds: string[];
}) => api<ApiExam>("/examinations", { method: "POST", body });

export interface ExamCreationTarget {
  classId: string;
  sectionId: string | null;
}

export interface ExamCreationBulkBody {
  name: string;
  academicYearId: string;
  examGroupId?: string | null;
  examType: ExamType;
  term: string;
  maxMarks: number;
  weightPercent: number;
  startDate: string;
  endDate: string;
  targets: ExamCreationTarget[];
}

export interface ExamCreationPreview {
  academicYear: string;
  name: string;
  examType: ExamType;
  term: string;
  examGroupId: string | null;
  maxMarks: number;
  weightPercent: number;
  startDate: string;
  endDate: string;
  instances: {
    classId: string;
    className: string;
    sectionId: string | null;
    sectionName: string | null;
    studentCount: number;
    subjects: {
      subjectId: string;
      subjectName: string;
      teacherName: string | null;
    }[];
    duplicate: boolean;
    skipped: boolean;
    skipReason?: string;
  }[];
  creatableCount: number;
  totalStudents: number;
  subjectCount: number;
  canCreate: boolean;
}

export const apiPreviewExamCreation = (body: ExamCreationBulkBody) =>
  api<ExamCreationPreview>("/examinations/preview", { method: "POST", body });

export const apiCreateExamsBulk = (body: ExamCreationBulkBody) =>
  api<{ created: ApiExam[]; count: number }>("/examinations/bulk", {
    method: "POST",
    body,
  });

export const apiDeleteExam = (examId: string) =>
  api<{ success: boolean }>(`/examinations/${examId}`, { method: "DELETE" });

export const apiUpdateExamStatus = (examId: string, status: ExamStatus) =>
  api<ApiExam>(`/examinations/${examId}/status`, { method: "PATCH", body: { status } });

export const apiUpsertMarks = (body: {
  examId: string;
  records: { studentId: string; subjectId: string; marks: number | null }[];
}) => api<{ saved: number }>("/examinations/marks", { method: "POST", body });

export const apiSubmitExamSubject = (examId: string, subjectId: string) =>
  api(`/examinations/${examId}/subjects/${subjectId}/submit`, {
    method: "POST",
  });

export const apiBlockStudent = (body: {
  studentId: string;
  examId?: string | null;
  academicYearId: string;
  reason: string;
}) => api<ApiBlockedStudent>("/examinations/blocked", { method: "POST", body });

export const apiPublicResults = (body: { code: string; academicYear?: string }) =>
  api<ApiStudentFinalResult>("/examinations/public-results", {
    method: "POST",
    body,
    auth: false,
  });

export interface MarksImportSummary {
  total: number;
  imported: number;
  updated: number;
  failed: number;
  errors: { row: number; studentId?: string; message: string }[];
}

/** Download the server-generated .xlsx marks template for an exam + subject. */
export async function apiDownloadMarksTemplate(
  examId: string,
  subjectId: string,
): Promise<{ blob: Blob; filename: string }> {
  const token = getAccessToken();
  const res = await fetch(
    `${API_URL}/api/examinations/${examId}/marks/template?subjectId=${encodeURIComponent(subjectId)}`,
    {
      headers: {
        "x-tenant-subdomain": TENANT,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    },
  );
  if (!res.ok) {
    throw new Error(
      res.status === 403
        ? "You are not assigned to this subject."
        : "Could not download the template.",
    );
  }
  const disposition = res.headers.get("content-disposition") ?? "";
  const match = disposition.match(/filename="?([^"]+)"?/);
  return { blob: await res.blob(), filename: match?.[1] ?? "marks-template.xlsx" };
}

/** Upload a completed .xlsx marks template (base64) for server-side import. */
export const apiImportMarks = (
  examId: string,
  subjectId: string,
  fileBase64: string,
) =>
  api<MarksImportSummary>(`/examinations/${examId}/marks/import`, {
    method: "POST",
    body: { subjectId, file: fileBase64 },
  });

// ── Class-based monitoring & results (PRD) ──

export interface ApiMonitoringClassOverview {
  classId: string;
  className: string;
  sectionCount: number;
  studentCount: number;
  subjectCount: number;
  submitted: number;
  pending: number;
  status: "Complete" | "In Progress";
}

export interface ApiMonitoringClassDetail {
  summary: {
    totalSubjects: number;
    submittedSubjects: number;
    pendingSubjects: number;
    completionPercent: number;
  };
  sections: { id: string; name: string }[];
  subjects: {
    examId: string;
    examName: string;
    examSubjectId: string;
    subjectId: string;
    subject: string;
    teacherId: string | null;
    teacherName: string;
    className: string;
    section: string;
    sectionId: string | null;
    submissionStatus: "PENDING" | "SUBMITTED" | "LOCKED";
    submittedAt: string | null;
  }[];
}

export interface ApiResultsClassOverview {
  classId: string;
  className: string;
  sectionCount: number;
  studentCount: number;
  published: boolean;
  teacherLocked: boolean;
  studentPortalOpen: boolean;
  examCount: number;
  exams: { id: string; name: string; status: string; section: string | null }[];
}

export interface ApiClassResultsMatrix {
  exam: {
    id: string;
    name: string;
    status: string;
    maxMarks: number;
    className: string;
    sectionName: string | null;
    academicYear: string;
    teacherLocked: boolean;
    studentPortalOpen: boolean;
  };
  subjects: { subjectId: string; name: string }[];
  summary: {
    totalStudents: number;
    completed: number;
    incomplete: number;
    completionPercent: number;
  };
  rows: {
    studentId: string;
    studentCode: string;
    studentName: string;
    subjectMarks: Record<string, number | null>;
    totalObtained: number;
    totalMax: number;
    average: number;
    grade: string;
    passed: boolean;
    remark: string;
    missingSubjects: string[];
    complete: boolean;
  }[];
}

export const apiMonitoringClasses = (opts?: {
  academicYearId?: string;
  examId?: string;
}) => {
  const params = new URLSearchParams();
  if (opts?.academicYearId) params.set("academicYearId", opts.academicYearId);
  if (opts?.examId) params.set("examId", opts.examId);
  const q = params.toString();
  return api<ApiMonitoringClassOverview[]>(
    `/examinations/monitoring/classes${q ? `?${q}` : ""}`,
  );
};

export const apiMonitoringClassDetail = (
  classId: string,
  opts?: { academicYearId?: string; examId?: string; sectionId?: string },
) => {
  const params = new URLSearchParams();
  if (opts?.academicYearId) params.set("academicYearId", opts.academicYearId);
  if (opts?.examId) params.set("examId", opts.examId);
  if (opts?.sectionId) params.set("sectionId", opts.sectionId);
  const q = params.toString();
  return api<ApiMonitoringClassDetail>(
    `/examinations/monitoring/classes/${classId}${q ? `?${q}` : ""}`,
  );
};

export const apiSendExamReminder = (body: {
  examId: string;
  subjectId: string;
  sms?: boolean;
  email?: boolean;
}) =>
  api<{
    success: boolean;
    channels: { inApp: boolean; sms: boolean; email: boolean };
    teacherName: string | null;
  }>("/examinations/monitoring/remind", { method: "POST", body });

export const apiResultsClasses = (academicYearId?: string) =>
  api<ApiResultsClassOverview[]>(
    `/examinations/results/classes${academicYearId ? `?academicYearId=${encodeURIComponent(academicYearId)}` : ""}`,
  );

export const apiClassResultsMatrix = (opts: {
  classId: string;
  examId: string;
  sectionId?: string;
  search?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}) => {
  const params = new URLSearchParams();
  params.set("classId", opts.classId);
  params.set("examId", opts.examId);
  if (opts.sectionId) params.set("sectionId", opts.sectionId);
  if (opts.search) params.set("search", opts.search);
  if (opts.sortBy) params.set("sortBy", opts.sortBy);
  if (opts.sortDir) params.set("sortDir", opts.sortDir);
  return api<ApiClassResultsMatrix>(`/examinations/results/matrix?${params}`);
};

export const apiSetTeacherLock = (examId: string, locked: boolean) =>
  api(`/examinations/${examId}/teacher-lock`, {
    method: "PATCH",
    body: { locked },
  });

export const apiSetStudentPortal = (examId: string, published: boolean) =>
  api(`/examinations/${examId}/student-portal`, {
    method: "PATCH",
    body: { published },
  });

/** Download branded PDF class results export. */
export async function apiDownloadClassResultsPdf(opts: {
  classId: string;
  examId: string;
  sectionId?: string;
  search?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}): Promise<{ blob: Blob; filename: string }> {
  const params = new URLSearchParams();
  params.set("classId", opts.classId);
  params.set("examId", opts.examId);
  if (opts.sectionId) params.set("sectionId", opts.sectionId);
  if (opts.search) params.set("search", opts.search);
  if (opts.sortBy) params.set("sortBy", opts.sortBy);
  if (opts.sortDir) params.set("sortDir", opts.sortDir);
  const token = getAccessToken();
  const res = await fetch(
    `${API_URL}/api/examinations/results/matrix/export/pdf?${params}`,
    {
      headers: {
        "x-tenant-subdomain": TENANT,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    },
  );
  if (!res.ok) throw new Error("Could not download PDF.");
  const disposition = res.headers.get("content-disposition") ?? "";
  const match = disposition.match(/filename="?([^"]+)"?/);
  return { blob: await res.blob(), filename: match?.[1] ?? "class-results.pdf" };
}

/** Download branded Excel class results export. */
export async function apiDownloadClassResultsExcel(opts: {
  classId: string;
  examId: string;
  sectionId?: string;
  search?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}): Promise<{ blob: Blob; filename: string }> {
  const params = new URLSearchParams();
  params.set("classId", opts.classId);
  params.set("examId", opts.examId);
  if (opts.sectionId) params.set("sectionId", opts.sectionId);
  if (opts.search) params.set("search", opts.search);
  if (opts.sortBy) params.set("sortBy", opts.sortBy);
  if (opts.sortDir) params.set("sortDir", opts.sortDir);
  const token = getAccessToken();
  const res = await fetch(
    `${API_URL}/api/examinations/results/matrix/export/xlsx?${params}`,
    {
      headers: {
        "x-tenant-subdomain": TENANT,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    },
  );
  if (!res.ok) throw new Error("Could not download Excel file.");
  const disposition = res.headers.get("content-disposition") ?? "";
  const match = disposition.match(/filename="?([^"]+)"?/);
  return { blob: await res.blob(), filename: match?.[1] ?? "class-results.xlsx" };
}
