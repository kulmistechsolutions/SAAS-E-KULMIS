"use client";

import { useSyncExternalStore } from "react";
import { ApiError } from "@/lib/api";
import {
  activeAcademicYear,
  classByName,
  sectionNamesForClass,
  getAcademicsState,
  subjectsForClass,
} from "@/lib/academics/store";
import { getState as getStudentsState, refreshStudents } from "@/lib/students/store";
import type { Student } from "@/lib/students/types";
import { getTeachersState, teacherAssignments } from "@/lib/teachers/store";
import type { Teacher } from "@/lib/teachers/types";
import {
  apiBlockStudent,
  apiCreateExam,
  apiCreateExamGroup,
  apiExamDashboard,
  apiExamMarks,
  apiExamMonitoring,
  apiListBlocked,
  apiListExamGroups,
  apiListExams,
  apiPublicResults,
  apiStudentResults,
  apiUpdateExamStatus,
  apiUpsertMarks,
  type ApiExam,
  type ApiExamGroup,
  type ApiExamMark,
  type ApiStudentFinalResult,
} from "./api";
import { gradeFromAverage, passedFromAverage } from "./format";
import type {
  BlockedStudent,
  CreateExamInput,
  Exam,
  ExamAuditEntry,
  ExamDashboardSummary,
  ExamGroup,
  ExamMark,
  ExamStatus,
  ExaminationsState,
  ImportSummary,
  MonitoringRow,
  StudentExamResult,
  StudentFinalResult,
  SubmissionStatus,
} from "./types";

const EMPTY: ExaminationsState = {
  examGroups: [],
  exams: [],
  marks: [],
  blockedStudents: [],
  audit: [],
  examSeq: 0,
  groupSeq: 0,
};

let state: ExaminationsState | null = null;
let dashboardCache: ExamDashboardSummary | null = null;
let monitoringCache: MonitoringRow[] = [];
let loaded = false;
const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function emit() {
  listeners.forEach((l) => l());
}

function setState(next: ExaminationsState) {
  state = next;
  emit();
}

function ensure(): ExaminationsState {
  if (state) return state;
  if (typeof window === "undefined") return EMPTY;
  state = EMPTY;
  if (!loaded) {
    loaded = true;
    void refreshExaminations();
  }
  return state;
}

function apiErr(e: unknown, fallback: string): string {
  return e instanceof ApiError ? e.message : fallback;
}

function yearIdByName(name: string): string | undefined {
  return getAcademicsState().academicYears.find((y) => y.name === name)?.id;
}

function subjectIdByName(name: string): string | undefined {
  return getAcademicsState().subjects.find((s) => s.name === name)?.id;
}

function mapExamGroup(g: ApiExamGroup): ExamGroup {
  return {
    id: g.id,
    name: g.name,
    academicYear: g.academicYear?.name ?? "",
    description: g.description,
  };
}

function mapExam(e: ApiExam): Exam {
  return {
    id: e.id,
    name: e.name,
    academicYear: e.academicYear?.name ?? "",
    examType: e.examType,
    examGroupId: e.examGroupId,
    term: e.term,
    maxMarks: e.maxMarks,
    weightPercent: e.weightPercent,
    startDate: e.startDate.slice(0, 10),
    endDate: e.endDate.slice(0, 10),
    status: e.status,
    className: e.class?.name ?? "",
    section: e.section?.name ?? "",
    subjects: e.subjects.map((s) => s.subject.name),
    createdAt: e.createdAt,
    createdBy: e.createdByUserId ?? "—",
  };
}

function mapMark(m: ApiExamMark): ExamMark {
  return {
    id: m.id,
    examId: m.examId,
    studentId: m.studentId,
    subject: m.subject.name,
    marks: m.marks,
    enteredAt: m.enteredAt,
  };
}

function mapStudentResults(data: ApiStudentFinalResult): StudentFinalResult {
  const termResults: StudentExamResult[] = data.termResults.map((tr) => ({
    examId: tr.examId,
    examName: tr.examName,
    term: tr.term,
    weightPercent: tr.weightPercent,
    subjects: tr.subjects.map((s) => ({
      subject: s.subject,
      maxMarks: s.maxMarks,
      marksObtained: s.marksObtained ?? 0,
      grade: s.grade,
    })),
    totalObtained: tr.totalObtained,
    totalMax: tr.totalMax,
    average: tr.average,
    grade: tr.grade,
    passed: tr.passed,
  }));

  const allSubjects = [...new Set(termResults.flatMap((t) => t.subjects.map((s) => s.subject)))];
  const subjectBreakdown = allSubjects.map((subject) => {
    const termMarks: Record<string, number | null> = {};
    let finalMarks = 0;
    let count = 0;
    for (const tr of termResults) {
      const row = tr.subjects.find((s) => s.subject === subject);
      termMarks[tr.term] = row?.marksObtained ?? null;
      if (row) {
        finalMarks += row.marksObtained;
        count += 1;
      }
    }
    const avg = count > 0 ? finalMarks / count : 0;
    const maxM = termResults[0]?.subjects.find((s) => s.subject === subject)?.maxMarks ?? 100;
    const avgPct = maxM > 0 ? (avg / maxM) * 100 : 0;
    return {
      subject,
      termMarks,
      finalMarks,
      total: finalMarks,
      average: avg,
      grade: gradeFromAverage(avgPct),
    };
  });

  return {
    studentId: data.studentId,
    studentCode: data.studentCode,
    studentName: data.studentName,
    className: data.className,
    section: data.section ?? "—",
    academicYear: getAcademicsState().academicYears.find((y) => y.id === data.academicYearId)?.name ?? "",
    termResults,
    finalAverage: data.finalAverage,
    finalGrade: data.finalGrade,
    passed: data.passed,
    subjectBreakdown,
  };
}

export async function refreshExaminations(): Promise<void> {
  try {
    const settled = await Promise.allSettled([
      apiListExamGroups(),
      apiListExams(),
      apiListBlocked(),
      apiExamDashboard(),
      apiExamMonitoring(),
    ]);
    const pick = <T>(i: number, fallback: T): T =>
      settled[i]?.status === "fulfilled" ? (settled[i] as PromiseFulfilledResult<T>).value : fallback;

    const groups = pick(0, [] as Awaited<ReturnType<typeof apiListExamGroups>>);
    const exams = pick(1, [] as Awaited<ReturnType<typeof apiListExams>>);
    const blocked = pick(2, [] as Awaited<ReturnType<typeof apiListBlocked>>);
    const dashboard = pick(3, null as Awaited<ReturnType<typeof apiExamDashboard>> | null);
    const monitoring = pick(4, [] as Awaited<ReturnType<typeof apiExamMonitoring>>);

    dashboardCache = dashboard;
    monitoringCache = monitoring.map((r) => ({
      examId: r.examId,
      examName: r.examName,
      className: r.className,
      section: r.section ?? "",
      subject: r.subject,
      teacherName: r.teacherName ?? "Unassigned",
      status: r.status as SubmissionStatus,
    }));

    const blockedStudents: BlockedStudent[] = blocked.map((b) => ({
      id: b.id,
      studentId: b.studentId,
      examId: b.examId,
      academicYear:
        getAcademicsState().academicYears.find((y) => y.id === b.academicYearId)?.name ?? "",
      reason: b.reason,
      blockedAt: b.blockedAt,
      blockedBy: b.blockedByUserId ?? "Admin",
    }));

    setState({
      ...(state ?? EMPTY),
      examGroups: groups.map(mapExamGroup),
      exams: exams.map(mapExam),
      blockedStudents,
      examSeq: exams.length,
      groupSeq: groups.length,
    });
  } catch {
    /* keep cache */
  }
}

export async function loadExamMarks(examId: string): Promise<void> {
  try {
    const rows = await apiExamMarks(examId);
    const mapped = rows.map(mapMark);
    const s = ensure();
    const other = s.marks.filter((m) => m.examId !== examId);
    setState({ ...s, marks: [...other, ...mapped] });
  } catch {
    /* ignore */
  }
}

export function getExaminationsState(): ExaminationsState {
  return ensure();
}

export function useExaminationsState(): ExaminationsState {
  return useSyncExternalStore(subscribe, getExaminationsState, () => EMPTY);
}

export function resetExaminations() {
  void refreshExaminations();
}

function logAudit(action: string, user: string, role: string, detail?: string) {
  const s = ensure();
  setState({
    ...s,
    audit: [
      {
        id: `ea_${Date.now()}`,
        action,
        user,
        role,
        at: new Date().toISOString(),
        detail,
      },
      ...s.audit,
    ].slice(0, 300),
  });
}

export function subjectsForClassSection(
  academicYear: string,
  className: string,
  section: string,
): string[] {
  const cls = classByName(className, academicYear);
  if (!cls) return [];
  const a = getAcademicsState();
  const subjectIds = new Set(
    a.classSubjects
      .filter(
        (cs) =>
          cs.classId === cls.id &&
          cs.academicYear === academicYear &&
          (cs.sectionId === null || a.sections.find((sec) => sec.id === cs.sectionId)?.name === section),
      )
      .map((cs) => cs.subjectId),
  );
  if (subjectIds.size === 0) {
    return subjectsForClass(cls.id).map((s) => s.name);
  }
  return a.subjects
    .filter((s) => subjectIds.has(s.id))
    .map((s) => s.name)
    .sort();
}

function subjectIdsForClassSection(
  academicYear: string,
  className: string,
  section: string,
): string[] {
  return subjectsForClassSection(academicYear, className, section)
    .map((name) => subjectIdByName(name))
    .filter((id): id is string => Boolean(id));
}

function teacherForSubject(
  academicYear: string,
  className: string,
  section: string,
  subject: string,
): Teacher | undefined {
  const tt = getTeachersState();
  // Prefer exact section match, then "all sections" (section === null)
  const candidates = tt.assignments.filter(
    (a) =>
      a.academicYear === academicYear &&
      a.className === className &&
      a.subject === subject &&
      a.status === "ACTIVE" &&
      (a.section === null || a.section === section),
  );
  const assignment =
    candidates.find((a) => a.section === section) ??
    candidates.find((a) => a.section === null);
  if (!assignment) return undefined;
  return tt.teachers.find((t) => t.id === assignment.teacherId);
}

function studentsInExam(exam: Exam): Student[] {
  return getStudentsState()
    .students.filter(
      (s) =>
        s.status === "ACTIVE" &&
        s.academicYear === exam.academicYear &&
        s.className === exam.className &&
        (s.section ?? "") === exam.section,
    )
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
}

function isExamEditable(exam: Exam): boolean {
  return !["LOCKED", "PUBLISHED", "ARCHIVED"].includes(exam.status);
}

export function dashboardSummary(): ExamDashboardSummary {
  if (dashboardCache) return dashboardCache;
  const s = ensure();
  const monitoring = monitoringRows();
  return {
    totalExams: s.exams.length,
    activeExams: s.exams.filter((e) => ["OPEN", "IN_PROGRESS"].includes(e.status)).length,
    draftExams: s.exams.filter((e) => e.status === "DRAFT").length,
    lockedExams: s.exams.filter((e) => e.status === "LOCKED").length,
    publishedExams: s.exams.filter((e) => e.status === "PUBLISHED").length,
    pendingSubmissions: monitoring.filter((m) => m.status === "PENDING").length,
    completedSubmissions: monitoring.filter((m) => m.status === "SUBMITTED").length,
    examGroups: s.examGroups.length,
    resultPublications: s.exams.filter((e) => e.status === "PUBLISHED").length,
  };
}

export function monitoringRows(): MonitoringRow[] {
  if (monitoringCache.length > 0) return monitoringCache;
  const s = ensure();
  const rows: MonitoringRow[] = [];
  for (const exam of s.exams) {
    if (exam.examType === "SCHOOL_IMPORT") continue;
    for (const subject of exam.subjects) {
      const teacher = teacherForSubject(exam.academicYear, exam.className, exam.section, subject);
      const students = studentsInExam(exam);
      const marked = students.filter((st) =>
        s.marks.some(
          (m) =>
            m.examId === exam.id &&
            m.studentId === st.id &&
            m.subject === subject &&
            m.marks !== null,
        ),
      ).length;
      const total = students.length;
      let status: SubmissionStatus = "PENDING";
      if (["LOCKED", "PUBLISHED", "ARCHIVED"].includes(exam.status)) status = "LOCKED";
      else if (total > 0 && marked >= total) status = "SUBMITTED";
      rows.push({
        examId: exam.id,
        examName: exam.name,
        className: exam.className,
        section: exam.section,
        subject,
        teacherName: teacher?.fullName ?? "Unassigned",
        status,
      });
    }
  }
  return rows;
}

export async function createExamGroup(
  name: string,
  academicYear: string,
  description?: string,
  user = "Admin User",
): Promise<{ ok: boolean; error?: string; group?: ExamGroup }> {
  const yearId = yearIdByName(academicYear);
  if (!yearId) return { ok: false, error: "Academic year not found." };
  try {
    const row = await apiCreateExamGroup({ name, academicYearId: yearId, description });
    await refreshExaminations();
    logAudit("Exam Group Created", user, "ADMINISTRATOR", name);
    return { ok: true, group: mapExamGroup(row) };
  } catch (e) {
    return { ok: false, error: apiErr(e, "Failed to create exam group.") };
  }
}

export async function createExams(
  input: CreateExamInput,
): Promise<{ ok: boolean; error?: string; exams?: Exam[] }> {
  const yearId = yearIdByName(input.academicYear);
  if (!yearId) return { ok: false, error: "Academic year not found." };

  const classNames = input.classNames.length > 0 ? input.classNames : [];
  const created: Exam[] = [];

  const targets: { className: string; section: string | null }[] = [];
  for (const cn of classNames) {
    const secs =
      input.sections.length > 0
        ? input.sections
        : sectionNamesForClass(cn, input.academicYear);
    if (secs.length === 0) {
      targets.push({ className: cn, section: null });
    } else {
      for (const sec of secs) {
        targets.push({ className: cn, section: sec });
      }
    }
  }

  if (targets.length === 0) {
    return { ok: false, error: "Select at least one class." };
  }

  try {
    for (const { className, section } of targets) {
      const cls = classByName(className, input.academicYear);
      if (!cls) continue;
      const sec =
        section === null
          ? null
          : getAcademicsState().sections.find(
              (s) => s.classId === cls.id && s.name === section,
            );
      const subjectIds = subjectIdsForClassSection(
        input.academicYear,
        className,
        section ?? "",
      );
      if (subjectIds.length === 0) continue;

      const row = await apiCreateExam({
        name: input.name,
        academicYearId: yearId,
        examGroupId: input.examGroupId ?? null,
        examType: input.examType,
        term: input.term,
        maxMarks: input.maxMarks,
        weightPercent: input.weightPercent,
        startDate: input.startDate,
        endDate: input.endDate,
        classId: cls.id,
        sectionId: sec?.id ?? null,
        subjectIds,
      });
      created.push(mapExam(row));
    }

    if (created.length === 0) {
      return {
        ok: false,
        error: "No subjects found for the selected class/section combinations.",
      };
    }

    await refreshExaminations();
    logAudit(
      "Exam Created",
      input.createdBy ?? "Admin User",
      "ADMINISTRATOR",
      `${input.name} (${created.length} instances)`,
    );
    return { ok: true, exams: created };
  } catch (e) {
    return { ok: false, error: apiErr(e, "Failed to create exam.") };
  }
}

export async function updateExamStatus(
  examId: string,
  status: ExamStatus,
  user = "Admin User",
): Promise<{ ok: boolean; error?: string }> {
  const s = ensure();
  const exam = s.exams.find((e) => e.id === examId);
  if (!exam) return { ok: false, error: "Exam not found." };
  try {
    await apiUpdateExamStatus(examId, status);
    await refreshExaminations();
    logAudit(
      status === "LOCKED" ? "Exam Locked" : status === "PUBLISHED" ? "Result Published" : "Exam Updated",
      user,
      "ADMINISTRATOR",
      `${exam.name} → ${status}`,
    );
    return { ok: true };
  } catch (e) {
    return { ok: false, error: apiErr(e, "Failed to update exam status.") };
  }
}

export type SaveMarksOptions = {
  /** Resolved subject UUID (required when academics store is unavailable, e.g. teacher portal). */
  subjectId?: string;
  /** Exam metadata when not yet synced into the local examinations cache. */
  exam?: Exam;
};

export async function saveMarks(
  examId: string,
  subject: string,
  entries: { studentId: string; marks: number | null }[],
  enteredBy = "Admin User",
  role = "ADMINISTRATOR",
  options?: SaveMarksOptions,
): Promise<{ ok: boolean; error?: string }> {
  const s = ensure();
  const exam = options?.exam ?? s.exams.find((e) => e.id === examId);
  if (!exam) return { ok: false, error: "Exam not found." };
  if (!isExamEditable(exam)) return { ok: false, error: "Exam is locked or published." };
  if (!exam.subjects.includes(subject)) return { ok: false, error: "Subject not part of this exam." };

  const subjectId = options?.subjectId ?? subjectIdByName(subject);
  if (!subjectId) return { ok: false, error: "Subject not found." };

  for (const e of entries) {
    if (e.marks !== null && e.marks > exam.maxMarks) {
      return { ok: false, error: "Entered marks exceed the maximum allowed score." };
    }
    if (e.marks !== null && e.marks < 0) {
      return { ok: false, error: "Marks cannot be negative." };
    }
  }

  try {
    await apiUpsertMarks({
      examId,
      records: entries.map((e) => ({
        studentId: e.studentId,
        subjectId,
        marks: e.marks,
      })),
    });
    await loadExamMarks(examId);
    await refreshExaminations();
    logAudit("Marks Entered", enteredBy, role, `${exam.name} — ${subject}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: apiErr(e, "Failed to save marks.") };
  }
}

export async function importMarksCsv(
  examId: string,
  subject: string,
  rows: { studentId: string; studentName: string; marks: number | null }[],
  enteredBy = "Admin User",
  role = "ADMINISTRATOR",
): Promise<ImportSummary> {
  const s = ensure();
  const exam = s.exams.find((e) => e.id === examId);
  const summary: ImportSummary = { imported: 0, updated: 0, skipped: 0, failed: 0, errors: [] };
  if (!exam) {
    summary.failed = rows.length;
    summary.errors.push("Exam not found.");
    return summary;
  }
  if (!isExamEditable(exam)) {
    summary.failed = rows.length;
    summary.errors.push("Exam is locked or published.");
    return summary;
  }

  const students = studentsInExam(exam);
  const seen = new Set<string>();
  const entries: { studentId: string; marks: number | null }[] = [];

  for (const row of rows) {
    if (seen.has(row.studentId)) {
      summary.failed += 1;
      summary.errors.push(`Duplicate row: ${row.studentId}`);
      continue;
    }
    seen.add(row.studentId);
    const student = students.find((st) => st.code === row.studentId);
    if (!student) {
      summary.failed += 1;
      summary.errors.push(`Unknown student ID: ${row.studentId}`);
      continue;
    }
    if (student.fullName !== row.studentName) {
      summary.failed += 1;
      summary.errors.push(`Name mismatch for ${row.studentId}`);
      continue;
    }
    if (row.marks === null || Number.isNaN(row.marks)) {
      summary.skipped += 1;
      continue;
    }
    if (row.marks > exam.maxMarks) {
      summary.failed += 1;
      summary.errors.push(`${row.studentId}: marks exceed maximum (${exam.maxMarks})`);
      continue;
    }
    const exists = s.marks.some(
      (m) => m.examId === examId && m.studentId === student.id && m.subject === subject,
    );
    if (exists) summary.updated += 1;
    else summary.imported += 1;
    entries.push({ studentId: student.id, marks: row.marks });
  }

  if (entries.length > 0) {
    await saveMarks(examId, subject, entries, enteredBy, role);
    logAudit("Excel Imported", enteredBy, role, `${exam.name} — ${subject}`);
  }
  return summary;
}

export function studentExamResult(studentId: string, examId: string): StudentExamResult | null {
  const s = ensure();
  const exam = s.exams.find((e) => e.id === examId);
  if (!exam) return null;

  const subjectRows = exam.subjects.map((subject) => {
    const mark =
      s.marks.find(
        (m) => m.examId === examId && m.studentId === studentId && m.subject === subject,
      )?.marks ?? 0;
    const pct = exam.maxMarks > 0 ? (mark / exam.maxMarks) * 100 : 0;
    return { subject, maxMarks: exam.maxMarks, marksObtained: mark, grade: gradeFromAverage(pct) };
  });

  const totalObtained = subjectRows.reduce((sum, r) => sum + r.marksObtained, 0);
  const totalMax = exam.maxMarks * subjectRows.length;
  const average = subjectRows.length > 0 ? totalObtained / subjectRows.length : 0;
  const avgPct = exam.maxMarks > 0 ? (average / exam.maxMarks) * 100 : 0;

  return {
    examId,
    examName: exam.name,
    term: exam.term,
    weightPercent: exam.weightPercent,
    subjects: subjectRows,
    totalObtained,
    totalMax,
    average,
    grade: gradeFromAverage(avgPct),
    passed: passedFromAverage(avgPct),
  };
}

export async function fetchStudentFinalResult(
  studentId: string,
  academicYear?: string,
): Promise<StudentFinalResult | null> {
  try {
    const yearId = academicYear ? yearIdByName(academicYear) : undefined;
    const data = await apiStudentResults(studentId, yearId);
    return mapStudentResults(data);
  } catch {
    return null;
  }
}

export function studentFinalResult(
  studentId: string,
  examGroupId?: string,
  academicYear?: string,
): StudentFinalResult | null {
  const s = ensure();
  const student = getStudentsState().students.find((st) => st.id === studentId);
  if (!student) return null;

  let exams = s.exams.filter(
    (e) =>
      e.academicYear === (academicYear ?? student.academicYear) &&
      e.className === student.className &&
      e.section === (student.section ?? "") &&
      ["LOCKED", "PUBLISHED", "COMPLETED"].includes(e.status),
  );
  if (examGroupId) exams = exams.filter((e) => e.examGroupId === examGroupId);

  const termResults = exams
    .map((e) => studentExamResult(studentId, e.id))
    .filter((r): r is StudentExamResult => r !== null);

  if (termResults.length === 0) return null;

  const weightSum = termResults.reduce((sum, t) => sum + t.weightPercent, 0);
  const finalAvgPct =
    weightSum > 0
      ? termResults.reduce((sum, t) => {
          const pct =
            t.subjects[0]?.maxMarks > 0 ? (t.average / t.subjects[0].maxMarks) * 100 : 0;
          return sum + pct * t.weightPercent;
        }, 0) / weightSum
      : 0;

  const allSubjects = [...new Set(termResults.flatMap((t) => t.subjects.map((s) => s.subject)))];
  const subjectBreakdown = allSubjects.map((subject) => {
    const termMarks: Record<string, number | null> = {};
    let finalMarks = 0;
    let count = 0;
    for (const tr of termResults) {
      const row = tr.subjects.find((s) => s.subject === subject);
      termMarks[tr.term] = row?.marksObtained ?? null;
      if (row) {
        finalMarks += row.marksObtained;
        count += 1;
      }
    }
    const avg = count > 0 ? finalMarks / count : 0;
    const maxM = termResults[0]?.subjects.find((s) => s.subject === subject)?.maxMarks ?? 100;
    const avgPct = maxM > 0 ? (avg / maxM) * 100 : 0;
    return {
      subject,
      termMarks,
      finalMarks,
      total: finalMarks,
      average: avg,
      grade: gradeFromAverage(avgPct),
    };
  });

  return {
    studentId,
    studentCode: student.code,
    studentName: student.fullName,
    className: student.className,
    section: student.section ?? "—",
    academicYear: student.academicYear,
    termResults,
    finalAverage: finalAvgPct,
    finalGrade: gradeFromAverage(finalAvgPct),
    passed: passedFromAverage(finalAvgPct),
    subjectBreakdown,
  };
}

export function isStudentBlocked(studentId: string, examId?: string): boolean {
  const s = ensure();
  return s.blockedStudents.some(
    (b) => b.studentId === studentId && (!b.examId || !examId || b.examId === examId),
  );
}

export async function blockStudent(
  studentId: string,
  reason: string,
  examId?: string,
  user = "Admin User",
): Promise<{ ok: boolean; error?: string }> {
  const student = getStudentsState().students.find((st) => st.id === studentId);
  if (!student) return { ok: false, error: "Student not found." };
  const yearId = yearIdByName(student.academicYear);
  if (!yearId) return { ok: false, error: "Academic year not found." };
  try {
    await apiBlockStudent({
      studentId,
      examId: examId ?? null,
      academicYearId: yearId,
      reason,
    });
    await refreshExaminations();
    logAudit("Student Blocked", user, "ADMINISTRATOR", reason);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: apiErr(e, "Failed to block student.") };
  }
}

export function unblockStudent(
  _blockId: string,
  _user = "Admin User",
): { ok: boolean; error?: string } {
  return { ok: false, error: "Unblock is not supported via API yet." };
}

export function teacherExams(teacherId: string): Exam[] {
  const s = ensure();
  const assignments = teacherAssignments(teacherId).filter((a) => a.status === "ACTIVE");
  return s.exams.filter((exam) => {
    if (exam.examType === "SCHOOL_IMPORT") return false;
    if (["DRAFT", "ARCHIVED"].includes(exam.status)) return false;
    return assignments.some(
      (a) =>
        a.academicYear === exam.academicYear &&
        a.className === exam.className &&
        (a.section === null || a.section === exam.section) &&
        exam.subjects.includes(a.subject),
    );
  });
}

export function teacherSubjectsForExam(teacherId: string, examId: string): string[] {
  const s = ensure();
  const exam = s.exams.find((e) => e.id === examId);
  if (!exam) return [];
  const assignments = teacherAssignments(teacherId).filter(
    (a) =>
      a.status === "ACTIVE" &&
      a.academicYear === exam.academicYear &&
      a.className === exam.className &&
      (a.section === null || a.section === exam.section),
  );
  return exam.subjects.filter((sub) => assignments.some((a) => a.subject === sub));
}

export function getExam(examId: string): Exam | undefined {
  return ensure().exams.find((e) => e.id === examId);
}

export function getExamGroup(id: string): ExamGroup | undefined {
  return ensure().examGroups.find((g) => g.id === id);
}

export function marksForExamSubject(examId: string, subject: string): ExamMark[] {
  return ensure().marks.filter((m) => m.examId === examId && m.subject === subject);
}

export function studentPublishedResults(studentId: string): StudentExamResult[] {
  const s = ensure();
  return s.exams
    .filter((e) => e.status === "PUBLISHED")
    .map((e) => studentExamResult(studentId, e.id))
    .filter((r): r is StudentExamResult => r !== null);
}

export function lookupStudentByCode(code: string): Student | undefined {
  return getStudentsState().students.find(
    (s) => s.code.toLowerCase() === code.trim().toLowerCase(),
  );
}

export async function lookupPublicResults(
  code: string,
  academicYear?: string,
): Promise<{ ok: boolean; error?: string; result?: StudentFinalResult; blocked?: boolean }> {
  try {
    const data = await apiPublicResults({ code: code.trim(), academicYear });
    const blocked = ensure().blockedStudents.some((b) => {
      const st = getStudentsState().students.find((s) => s.code.toLowerCase() === code.trim().toLowerCase());
      return st && b.studentId === st.id;
    });
    if (blocked) return { ok: true, blocked: true };
    return { ok: true, result: mapStudentResults(data) };
  } catch (e) {
    return { ok: false, error: apiErr(e, "Student ID not found.") };
  }
}

export function recentExams(limit = 6): Exam[] {
  return [...ensure().exams].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
}

export function deleteExam(
  _examId: string,
  _user = "Admin User",
): { ok: boolean; error?: string } {
  return { ok: false, error: "Delete is not supported via API yet." };
}

export function getAuditLog(): ExamAuditEntry[] {
  return ensure().audit;
}
