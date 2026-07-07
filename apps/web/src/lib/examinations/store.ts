"use client";

import { useSyncExternalStore } from "react";
import { getState as getStudentsState } from "@/lib/students/store";
import type { Student } from "@/lib/students/types";
import { getTeachersState, teacherAssignments } from "@/lib/teachers/store";
import type { Teacher } from "@/lib/teachers/types";
import { gradeFromAverage, passedFromAverage } from "./format";
import { buildSeed } from "./seed";
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

const KEY = "ekulmis_examinations_v1";

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
  if (typeof window !== "undefined") {
    localStorage.setItem(KEY, JSON.stringify(next));
  }
  emit();
}

function ensure(): ExaminationsState {
  if (state) return state;
  if (typeof window === "undefined") return EMPTY;
  const raw = localStorage.getItem(KEY);
  if (raw) {
    try {
      state = JSON.parse(raw) as ExaminationsState;
      return state;
    } catch {
      /* fall through */
    }
  }
  state = buildSeed();
  localStorage.setItem(KEY, JSON.stringify(state));
  return state;
}

export function getExaminationsState(): ExaminationsState {
  return ensure();
}

export function useExaminationsState(): ExaminationsState {
  return useSyncExternalStore(subscribe, getExaminationsState, () => EMPTY);
}

export function resetExaminations() {
  setState(buildSeed());
}

function logAudit(
  action: string,
  user: string,
  role: string,
  detail?: string,
) {
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
  const tt = getTeachersState();
  const set = new Set<string>();
  for (const a of tt.assignments) {
    if (
      a.academicYear === academicYear &&
      a.className === className &&
      a.status === "ACTIVE" &&
      (a.section === null || a.section === section)
    ) {
      set.add(a.subject);
    }
  }
  return [...set].sort();
}

function teacherForSubject(
  academicYear: string,
  className: string,
  section: string,
  subject: string,
): Teacher | undefined {
  const tt = getTeachersState();
  const assignment = tt.assignments.find(
    (a) =>
      a.academicYear === academicYear &&
      a.className === className &&
      a.subject === subject &&
      a.status === "ACTIVE" &&
      (a.section === null || a.section === section),
  );
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
  const s = ensure();
  const monitoring = monitoringRows();
  return {
    totalExams: s.exams.length,
    activeExams: s.exams.filter((e) =>
      ["OPEN", "IN_PROGRESS"].includes(e.status),
    ).length,
    draftExams: s.exams.filter((e) => e.status === "DRAFT").length,
    lockedExams: s.exams.filter((e) => e.status === "LOCKED").length,
    publishedExams: s.exams.filter((e) => e.status === "PUBLISHED").length,
    pendingSubmissions: monitoring.filter((m) => m.status === "PENDING").length,
    completedSubmissions: monitoring.filter((m) => m.status === "SUBMITTED")
      .length,
    examGroups: s.examGroups.length,
    resultPublications: s.exams.filter((e) => e.status === "PUBLISHED").length,
  };
}

export function monitoringRows(): MonitoringRow[] {
  const s = ensure();
  const rows: MonitoringRow[] = [];

  for (const exam of s.exams) {
    if (exam.examType === "SCHOOL_IMPORT") continue;
    for (const subject of exam.subjects) {
      const teacher = teacherForSubject(
        exam.academicYear,
        exam.className,
        exam.section,
        subject,
      );
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
      if (["LOCKED", "PUBLISHED", "ARCHIVED"].includes(exam.status))
        status = "LOCKED";
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

export function createExamGroup(
  name: string,
  academicYear: string,
  description?: string,
  user = "Admin User",
): ExamGroup {
  const s = ensure();
  const group: ExamGroup = {
    id: `eg_${s.groupSeq + 1}`,
    name,
    academicYear,
    description,
  };
  setState({
    ...s,
    examGroups: [...s.examGroups, group],
    groupSeq: s.groupSeq + 1,
  });
  logAudit("Exam Group Created", user, "ADMINISTRATOR", name);
  return group;
}

export function createExams(
  input: CreateExamInput,
): { ok: boolean; error?: string; exams?: Exam[] } {
  const s = ensure();
  const created: Exam[] = [];
  let seq = s.examSeq;

  const classNames =
    input.classNames.length > 0 ? input.classNames : ["All Classes"];
  const sections = input.sections.length > 0 ? input.sections : ["A", "B", "C"];

  for (const className of classNames) {
    for (const section of sections) {
      const subjects = subjectsForClassSection(
        input.academicYear,
        className,
        section,
      );
      if (subjects.length === 0) continue;
      seq += 1;
      created.push({
        id: `ex_${seq}`,
        name: input.name,
        academicYear: input.academicYear,
        examType: input.examType,
        examGroupId: input.examGroupId ?? null,
        term: input.term,
        maxMarks: input.maxMarks,
        weightPercent: input.weightPercent,
        startDate: input.startDate,
        endDate: input.endDate,
        status: "DRAFT",
        className,
        section,
        subjects,
        createdAt: new Date().toISOString(),
        createdBy: input.createdBy ?? "Admin User",
      });
    }
  }

  if (created.length === 0) {
    return {
      ok: false,
      error: "No subjects found for the selected class/section combinations.",
    };
  }

  setState({
    ...s,
    exams: [...s.exams, ...created],
    examSeq: seq,
  });
  logAudit(
    "Exam Created",
    input.createdBy ?? "Admin User",
    "ADMINISTRATOR",
    `${input.name} (${created.length} instances)`,
  );
  return { ok: true, exams: created };
}

export function updateExamStatus(
  examId: string,
  status: ExamStatus,
  user = "Admin User",
): { ok: boolean; error?: string } {
  const s = ensure();
  const exam = s.exams.find((e) => e.id === examId);
  if (!exam) return { ok: false, error: "Exam not found." };

  setState({
    ...s,
    exams: s.exams.map((e) => (e.id === examId ? { ...e, status } : e)),
  });
  logAudit(
    status === "LOCKED"
      ? "Exam Locked"
      : status === "PUBLISHED"
        ? "Result Published"
        : "Exam Updated",
    user,
    "ADMINISTRATOR",
    `${exam.name} → ${status}`,
  );
  return { ok: true };
}

export function saveMarks(
  examId: string,
  subject: string,
  entries: { studentId: string; marks: number | null }[],
  enteredBy = "Admin User",
  role = "ADMINISTRATOR",
): { ok: boolean; error?: string } {
  const s = ensure();
  const exam = s.exams.find((e) => e.id === examId);
  if (!exam) return { ok: false, error: "Exam not found." };
  if (!isExamEditable(exam))
    return { ok: false, error: "Exam is locked or published." };
  if (!exam.subjects.includes(subject))
    return { ok: false, error: "Subject not part of this exam." };

  for (const e of entries) {
    if (e.marks !== null && e.marks > exam.maxMarks) {
      return {
        ok: false,
        error: "Entered marks exceed the maximum allowed score.",
      };
    }
    if (e.marks !== null && e.marks < 0) {
      return { ok: false, error: "Marks cannot be negative." };
    }
  }

  const marks = [...s.marks];
  const now = new Date().toISOString();

  for (const entry of entries) {
    const idx = marks.findIndex(
      (m) =>
        m.examId === examId &&
        m.studentId === entry.studentId &&
        m.subject === subject,
    );
    if (idx >= 0) {
      marks[idx] = {
        ...marks[idx],
        marks: entry.marks,
        enteredBy,
        enteredAt: now,
      };
    } else if (entry.marks !== null) {
      marks.push({
        id: `em_${Date.now()}_${entry.studentId}`,
        examId,
        studentId: entry.studentId,
        subject,
        marks: entry.marks,
        enteredBy,
        enteredAt: now,
      });
    }
  }

  let newStatus = exam.status;
  if (exam.status === "DRAFT") newStatus = "OPEN";
  if (exam.status === "OPEN") newStatus = "IN_PROGRESS";

  setState({
    ...s,
    marks,
    exams: s.exams.map((e) =>
      e.id === examId ? { ...e, status: newStatus } : e,
    ),
  });
  logAudit("Marks Entered", enteredBy, role, `${exam.name} — ${subject}`);
  return { ok: true };
}

export function importMarksCsv(
  examId: string,
  subject: string,
  rows: { studentId: string; studentName: string; marks: number | null }[],
  enteredBy = "Admin User",
  role = "ADMINISTRATOR",
): ImportSummary {
  const s = ensure();
  const exam = s.exams.find((e) => e.id === examId);
  const summary: ImportSummary = {
    imported: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };
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
      summary.errors.push(
        `${row.studentId}: marks exceed maximum (${exam.maxMarks})`,
      );
      continue;
    }

    const exists = s.marks.some(
      (m) =>
        m.examId === examId &&
        m.studentId === student.id &&
        m.subject === subject,
    );
    if (exists) summary.updated += 1;
    else summary.imported += 1;
    entries.push({ studentId: student.id, marks: row.marks });
  }

  if (entries.length > 0) {
    saveMarks(examId, subject, entries, enteredBy, role);
    logAudit("Excel Imported", enteredBy, role, `${exam.name} — ${subject}`);
  }
  return summary;
}

export function studentExamResult(
  studentId: string,
  examId: string,
): StudentExamResult | null {
  const s = ensure();
  const exam = s.exams.find((e) => e.id === examId);
  if (!exam) return null;

  const subjectRows = exam.subjects.map((subject) => {
    const mark =
      s.marks.find(
        (m) =>
          m.examId === examId && m.studentId === studentId && m.subject === subject,
      )?.marks ?? 0;
    const pct = exam.maxMarks > 0 ? (mark / exam.maxMarks) * 100 : 0;
    return {
      subject,
      maxMarks: exam.maxMarks,
      marksObtained: mark,
      grade: gradeFromAverage(pct),
    };
  });

  const totalObtained = subjectRows.reduce((sum, r) => sum + r.marksObtained, 0);
  const totalMax = exam.maxMarks * subjectRows.length;
  const average =
    subjectRows.length > 0 ? totalObtained / subjectRows.length : 0;
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
  if (examGroupId) {
    exams = exams.filter((e) => e.examGroupId === examGroupId);
  }

  const termResults = exams
    .map((e) => studentExamResult(studentId, e.id))
    .filter((r): r is StudentExamResult => r !== null);

  if (termResults.length === 0) return null;

  const weightSum = termResults.reduce((sum, t) => sum + t.weightPercent, 0);
  const weightedAvg =
    weightSum > 0
      ? termResults.reduce(
          (sum, t) => sum + (t.average / termResults[0].subjects[0]?.maxMarks || 1) * 100 * t.weightPercent,
          0,
        ) / weightSum
      : 0;

  const finalAvgPct =
    weightSum > 0
      ? termResults.reduce((sum, t) => {
          const pct =
            t.subjects[0]?.maxMarks > 0
              ? (t.average / t.subjects[0].maxMarks) * 100
              : 0;
          return sum + pct * t.weightPercent;
        }, 0) / weightSum
      : 0;

  const allSubjects = [
    ...new Set(termResults.flatMap((t) => t.subjects.map((s) => s.subject))),
  ];

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

export function isStudentBlocked(
  studentId: string,
  examId?: string,
): boolean {
  const s = ensure();
  return s.blockedStudents.some(
    (b) =>
      b.studentId === studentId &&
      (!b.examId || !examId || b.examId === examId),
  );
}

export function blockStudent(
  studentId: string,
  reason: string,
  examId?: string,
  user = "Admin User",
): { ok: boolean } {
  const s = ensure();
  const student = getStudentsState().students.find((st) => st.id === studentId);
  if (!student) return { ok: false };

  const block: BlockedStudent = {
    id: `bs_${Date.now()}`,
    studentId,
    examId: examId ?? null,
    academicYear: student.academicYear,
    reason,
    blockedAt: new Date().toISOString(),
    blockedBy: user,
  };
  setState({ ...s, blockedStudents: [...s.blockedStudents, block] });
  logAudit("Student Blocked", user, "ADMINISTRATOR", reason);
  return { ok: true };
}

export function unblockStudent(blockId: string, user = "Admin User"): { ok: boolean } {
  const s = ensure();
  setState({
    ...s,
    blockedStudents: s.blockedStudents.filter((b) => b.id !== blockId),
  });
  logAudit("Student Unblocked", user, "ADMINISTRATOR");
  return { ok: true };
}

export function teacherExams(teacherId: string): Exam[] {
  const s = ensure();
  const assignments = teacherAssignments(teacherId).filter(
    (a) => a.status === "ACTIVE",
  );
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

export function teacherSubjectsForExam(
  teacherId: string,
  examId: string,
): string[] {
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
  return exam.subjects.filter((sub) =>
    assignments.some((a) => a.subject === sub),
  );
}

export function getExam(examId: string): Exam | undefined {
  return ensure().exams.find((e) => e.id === examId);
}

export function getExamGroup(id: string): ExamGroup | undefined {
  return ensure().examGroups.find((g) => g.id === id);
}

export function marksForExamSubject(
  examId: string,
  subject: string,
): ExamMark[] {
  return ensure().marks.filter(
    (m) => m.examId === examId && m.subject === subject,
  );
}

export function studentPublishedResults(
  studentId: string,
): StudentExamResult[] {
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

export function recentExams(limit = 6): Exam[] {
  return [...ensure().exams]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

export function deleteExam(
  examId: string,
  user = "Admin User",
): { ok: boolean; error?: string } {
  const s = ensure();
  const exam = s.exams.find((e) => e.id === examId);
  if (!exam) return { ok: false, error: "Exam not found." };
  if (!["DRAFT"].includes(exam.status))
    return { ok: false, error: "Only draft exams can be deleted." };
  setState({
    ...s,
    exams: s.exams.filter((e) => e.id !== examId),
    marks: s.marks.filter((m) => m.examId !== examId),
  });
  logAudit("Exam Deleted", user, "ADMINISTRATOR", exam.name);
  return { ok: true };
}

export function getAuditLog(): ExamAuditEntry[] {
  return ensure().audit;
}
