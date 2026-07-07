"use client";

import { useSyncExternalStore } from "react";
import { getState as getStudentsState } from "@/lib/students/store";
import { getTeachersState } from "@/lib/teachers/store";
import { buildSeed } from "./seed";
import type {
  AcademicsDashboardSummary,
  AcademicsState,
  AcademicYear,
  AcademicYearInput,
  ClassInput,
  ClassRow,
  ClassStatistics,
  ClassSubjectAssignment,
  SchoolClass,
  Section,
  SectionInput,
  SectionRow,
  SectionStatistics,
  Subject,
  SubjectInput,
  SubjectRow,
} from "./types";

const KEY = "ekulmis_academics_v1";

const EMPTY: AcademicsState = {
  academicYears: [],
  classes: [],
  sections: [],
  subjects: [],
  classSubjects: [],
  audit: [],
  classSeq: 0,
  sectionSeq: 0,
  subjectSeq: 0,
  yearSeq: 0,
};

let state: AcademicsState | null = null;
const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function emit() {
  listeners.forEach((l) => l());
}

function setState(next: AcademicsState) {
  state = next;
  if (typeof window !== "undefined") {
    localStorage.setItem(KEY, JSON.stringify(next));
  }
  emit();
}

function ensure(): AcademicsState {
  if (state) return state;
  if (typeof window === "undefined") return EMPTY;
  const raw = localStorage.getItem(KEY);
  if (raw) {
    try {
      state = JSON.parse(raw) as AcademicsState;
      return state;
    } catch {
      /* fall through */
    }
  }
  state = buildSeed();
  localStorage.setItem(KEY, JSON.stringify(state));
  return state;
}

export function getAcademicsState(): AcademicsState {
  return ensure();
}

export function useAcademicsState(): AcademicsState {
  return useSyncExternalStore(subscribe, getAcademicsState, () => EMPTY);
}

export function resetAcademics() {
  setState(buildSeed());
}

function logAudit(action: string, detail?: string, user = "Admin User", role = "ADMINISTRATOR") {
  const s = ensure();
  setState({
    ...s,
    audit: [
      {
        id: `aca_${Date.now()}`,
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

export function activeAcademicYear(): string {
  const s = ensure();
  return s.academicYears.find((y) => y.status === "ACTIVE")?.name ?? "";
}

// ---------- Lookups ----------

export function getClass(id: string): SchoolClass | undefined {
  return ensure().classes.find((c) => c.id === id);
}

export function getSection(id: string): Section | undefined {
  return ensure().sections.find((s) => s.id === id);
}

export function getSubject(id: string): Subject | undefined {
  return ensure().subjects.find((s) => s.id === id);
}

export function classByName(name: string, year?: string): SchoolClass | undefined {
  const s = ensure();
  const y = year ?? activeAcademicYear();
  return s.classes.find((c) => c.name === name && c.academicYear === y);
}

export function sectionsForClass(classId: string): Section[] {
  return ensure()
    .sections.filter((s) => s.classId === classId)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function subjectsForClass(classId: string): Subject[] {
  const s = ensure();
  const subjectIds = new Set(
    s.classSubjects.filter((cs) => cs.classId === classId).map((cs) => cs.subjectId),
  );
  return s.subjects
    .filter((sub) => subjectIds.has(sub.id))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// ---------- Integration helpers ----------

function studentsForClassName(className: string, year: string) {
  return getStudentsState().students.filter(
    (st) =>
      st.status === "ACTIVE" &&
      st.academicYear === year &&
      st.className === className,
  );
}

function teacherCountForClass(className: string, year: string): number {
  const tt = getTeachersState();
  const ids = new Set(
    tt.assignments
      .filter(
        (a) =>
          a.status === "ACTIVE" &&
          a.academicYear === year &&
          a.className === className,
      )
      .map((a) => a.teacherId),
  );
  return ids.size;
}

// ---------- Dashboard ----------

export function dashboardSummary(): AcademicsDashboardSummary {
  const s = ensure();
  const year = activeAcademicYear();
  const yearClasses = s.classes.filter((c) => c.academicYear === year);
  const yearSections = s.sections.filter((sec) => sec.academicYear === year);

  const students = getStudentsState().students.filter(
    (st) => st.status === "ACTIVE" && st.academicYear === year,
  );

  const tt = getTeachersState();
  const assignedTeacherIds = new Set(
    tt.assignments
      .filter((a) => a.status === "ACTIVE" && a.academicYear === year)
      .map((a) => a.teacherId),
  );

  const classesWithoutTeachers = yearClasses.filter(
    (c) => teacherCountForClass(c.name, year) === 0,
  ).length;

  const classesWithoutSubjects = yearClasses.filter(
    (c) => s.classSubjects.filter((cs) => cs.classId === c.id).length === 0,
  ).length;

  return {
    totalAcademicYears: s.academicYears.length,
    activeAcademicYear: year,
    totalClasses: yearClasses.length,
    totalSections: yearSections.length,
    totalSubjects: s.subjects.filter((sub) => sub.status === "ACTIVE").length,
    totalStudents: students.length,
    teachersAssigned: assignedTeacherIds.size,
    classesWithoutTeachers,
    classesWithoutSubjects,
  };
}

// ---------- Rows ----------

export function classRows(opts?: {
  academicYear?: string;
  search?: string;
  status?: string;
}): ClassRow[] {
  const s = ensure();
  const year = opts?.academicYear ?? activeAcademicYear();
  let classes = s.classes.filter((c) => c.academicYear === year);
  if (opts?.status) classes = classes.filter((c) => c.status === opts.status);
  if (opts?.search?.trim()) {
    const q = opts.search.trim().toLowerCase();
    classes = classes.filter((c) => c.name.toLowerCase().includes(q));
  }

  return classes.map((c) => ({
    id: c.id,
    name: c.name,
    academicYear: c.academicYear,
    hasSections: c.hasSections,
    status: c.status,
    sectionCount: s.sections.filter((sec) => sec.classId === c.id).length,
    studentCount: studentsForClassName(c.name, year).length,
    subjectCount: s.classSubjects.filter((cs) => cs.classId === c.id).length,
    teacherCount: teacherCountForClass(c.name, year),
  }));
}

export function sectionRows(opts?: {
  academicYear?: string;
  classId?: string;
  search?: string;
  status?: string;
}): SectionRow[] {
  const s = ensure();
  const year = opts?.academicYear ?? activeAcademicYear();
  let sections = s.sections.filter((sec) => sec.academicYear === year);
  if (opts?.classId) sections = sections.filter((sec) => sec.classId === opts.classId);
  if (opts?.status) sections = sections.filter((sec) => sec.status === opts.status);

  let rows = sections.map((sec) => {
    const cls = s.classes.find((c) => c.id === sec.classId);
    const students = cls
      ? studentsForClassName(cls.name, year).filter(
          (st) => (st.section ?? "") === sec.name,
        )
      : [];
    return {
      id: sec.id,
      name: sec.name,
      className: cls?.name ?? "—",
      classId: sec.classId,
      academicYear: sec.academicYear,
      status: sec.status,
      studentCount: students.length,
    };
  });

  if (opts?.search?.trim()) {
    const q = opts.search.trim().toLowerCase();
    rows = rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) || r.className.toLowerCase().includes(q),
    );
  }
  return rows;
}

export function subjectRows(opts?: { search?: string; status?: string }): SubjectRow[] {
  const s = ensure();
  const tt = getTeachersState();
  let subjects = [...s.subjects];
  if (opts?.status) subjects = subjects.filter((sub) => sub.status === opts.status);
  if (opts?.search?.trim()) {
    const q = opts.search.trim().toLowerCase();
    subjects = subjects.filter(
      (sub) =>
        sub.name.toLowerCase().includes(q) ||
        (sub.code ?? "").toLowerCase().includes(q),
    );
  }

  return subjects.map((sub) => ({
    id: sub.id,
    name: sub.name,
    code: sub.code,
    status: sub.status,
    classCount: new Set(
      s.classSubjects.filter((cs) => cs.subjectId === sub.id).map((cs) => cs.classId),
    ).size,
    usedByTeachers: tt.assignments.filter(
      (a) => a.status === "ACTIVE" && a.subject === sub.name,
    ).length,
  }));
}

// ---------- Statistics ----------

export function classStatistics(classId: string): ClassStatistics {
  const s = ensure();
  const cls = s.classes.find((c) => c.id === classId);
  if (!cls) {
    return {
      totalStudents: 0,
      maleStudents: 0,
      femaleStudents: 0,
      totalSections: 0,
      assignedSubjects: 0,
      assignedTeachers: 0,
      attendancePercentage: 0,
      feeCollected: 0,
      feeExpected: 0,
      examAverage: 0,
    };
  }
  const students = studentsForClassName(cls.name, cls.academicYear);
  const male = students.filter((st) => st.gender === "MALE").length;
  const female = students.filter((st) => st.gender === "FEMALE").length;
  const feeExpected = students.reduce((sum, st) => sum + st.monthlyFee, 0);

  return {
    totalStudents: students.length,
    maleStudents: male,
    femaleStudents: female,
    totalSections: s.sections.filter((sec) => sec.classId === classId).length,
    assignedSubjects: s.classSubjects.filter((cs) => cs.classId === classId).length,
    assignedTeachers: teacherCountForClass(cls.name, cls.academicYear),
    attendancePercentage: 92 + (students.length % 6),
    feeCollected: Math.round(feeExpected * 0.78),
    feeExpected,
    examAverage: 68 + (students.length % 20),
  };
}

export function sectionStatistics(sectionId: string): SectionStatistics {
  const s = ensure();
  const sec = s.sections.find((x) => x.id === sectionId);
  if (!sec) {
    return {
      totalStudents: 0,
      maleStudents: 0,
      femaleStudents: 0,
      assignedTeachers: 0,
      assignedSubjects: 0,
      attendanceRate: 0,
      examPerformance: 0,
    };
  }
  const cls = s.classes.find((c) => c.id === sec.classId);
  const students = cls
    ? studentsForClassName(cls.name, sec.academicYear).filter(
        (st) => (st.section ?? "") === sec.name,
      )
    : [];
  const tt = getTeachersState();
  const teachers = new Set(
    tt.assignments
      .filter(
        (a) =>
          a.status === "ACTIVE" &&
          a.academicYear === sec.academicYear &&
          cls &&
          a.className === cls.name &&
          (a.section === null || a.section === sec.name),
      )
      .map((a) => a.teacherId),
  );

  return {
    totalStudents: students.length,
    maleStudents: students.filter((st) => st.gender === "MALE").length,
    femaleStudents: students.filter((st) => st.gender === "FEMALE").length,
    assignedTeachers: teachers.size,
    assignedSubjects: cls
      ? s.classSubjects.filter((cs) => cs.classId === cls.id).length
      : 0,
    attendanceRate: 90 + (students.length % 8),
    examPerformance: 65 + (students.length % 25),
  };
}

// ---------- Academic Year mutations ----------

export function createAcademicYear(
  input: AcademicYearInput,
): { ok: boolean; error?: string; year?: AcademicYear } {
  const s = ensure();
  if (s.academicYears.some((y) => y.name === input.name)) {
    return { ok: false, error: "Academic year already exists." };
  }
  const makeActive = input.status === "ACTIVE";
  const year: AcademicYear = {
    id: `ay_${s.yearSeq + 1}`,
    name: input.name,
    startDate: input.startDate,
    endDate: input.endDate,
    status: makeActive ? "ACTIVE" : "CLOSED",
  };
  setState({
    ...s,
    academicYears: [
      ...s.academicYears.map((y) =>
        makeActive ? { ...y, status: "CLOSED" as const } : y,
      ),
      year,
    ],
    yearSeq: s.yearSeq + 1,
  });
  logAudit("Academic Year Created", input.name);
  return { ok: true, year };
}

export function setActiveAcademicYear(id: string): { ok: boolean } {
  const s = ensure();
  setState({
    ...s,
    academicYears: s.academicYears.map((y) => ({
      ...y,
      status: y.id === id ? "ACTIVE" : "CLOSED",
    })),
  });
  const y = s.academicYears.find((x) => x.id === id);
  logAudit("Academic Year Updated", `${y?.name} set active`);
  return { ok: true };
}

// ---------- Class mutations ----------

export function createClass(
  input: ClassInput,
): { ok: boolean; error?: string; cls?: SchoolClass } {
  const s = ensure();
  const dup = s.classes.some(
    (c) =>
      c.name.toLowerCase() === input.name.trim().toLowerCase() &&
      c.academicYear === input.academicYear,
  );
  if (dup) {
    return { ok: false, error: "Class name must be unique within the academic year." };
  }
  const cls: SchoolClass = {
    id: `cls_${s.classSeq + 1}`,
    name: input.name.trim(),
    academicYear: input.academicYear,
    hasSections: input.hasSections,
    status: input.status ?? "ACTIVE",
    notes: input.notes ?? null,
    createdAt: new Date().toISOString(),
  };
  setState({ ...s, classes: [...s.classes, cls], classSeq: s.classSeq + 1 });
  logAudit("Class Created", cls.name);
  return { ok: true, cls };
}

export function updateClass(
  id: string,
  input: ClassInput,
): { ok: boolean; error?: string } {
  const s = ensure();
  const existing = s.classes.find((c) => c.id === id);
  if (!existing) return { ok: false, error: "Class not found." };
  const dup = s.classes.some(
    (c) =>
      c.id !== id &&
      c.name.toLowerCase() === input.name.trim().toLowerCase() &&
      c.academicYear === input.academicYear,
  );
  if (dup) return { ok: false, error: "Class name must be unique within the academic year." };

  setState({
    ...s,
    classes: s.classes.map((c) =>
      c.id === id
        ? {
            ...c,
            name: input.name.trim(),
            academicYear: input.academicYear,
            hasSections: input.hasSections,
            status: input.status ?? c.status,
            notes: input.notes ?? null,
          }
        : c,
    ),
  });
  logAudit("Class Updated", input.name);
  return { ok: true };
}

export function deleteClass(id: string): { ok: boolean; error?: string } {
  const s = ensure();
  const cls = s.classes.find((c) => c.id === id);
  if (!cls) return { ok: false, error: "Class not found." };
  const studentCount = studentsForClassName(cls.name, cls.academicYear).length;
  if (studentCount > 0) {
    return { ok: false, error: "Cannot delete a class that still contains students." };
  }
  setState({
    ...s,
    classes: s.classes.filter((c) => c.id !== id),
    sections: s.sections.filter((sec) => sec.classId !== id),
    classSubjects: s.classSubjects.filter((cs) => cs.classId !== id),
  });
  logAudit("Class Deleted", cls.name);
  return { ok: true };
}

// ---------- Section mutations ----------

export function createSection(
  input: SectionInput,
): { ok: boolean; error?: string; section?: Section } {
  const s = ensure();
  const cls = s.classes.find((c) => c.id === input.classId);
  if (!cls) return { ok: false, error: "Class not found." };
  const dup = s.sections.some(
    (sec) =>
      sec.classId === input.classId &&
      sec.name.toLowerCase() === input.name.trim().toLowerCase(),
  );
  if (dup) return { ok: false, error: "Section name must be unique within the class." };

  const section: Section = {
    id: `sec_${s.sectionSeq + 1}`,
    name: input.name.trim(),
    classId: input.classId,
    academicYear: cls.academicYear,
    status: input.status ?? "ACTIVE",
    createdAt: new Date().toISOString(),
  };
  setState({
    ...s,
    sections: [...s.sections, section],
    sectionSeq: s.sectionSeq + 1,
    classes: s.classes.map((c) =>
      c.id === input.classId ? { ...c, hasSections: true } : c,
    ),
  });
  logAudit("Section Created", `${cls.name} — ${section.name}`);
  return { ok: true, section };
}

export function updateSection(
  id: string,
  input: SectionInput,
): { ok: boolean; error?: string } {
  const s = ensure();
  const existing = s.sections.find((sec) => sec.id === id);
  if (!existing) return { ok: false, error: "Section not found." };
  const dup = s.sections.some(
    (sec) =>
      sec.id !== id &&
      sec.classId === existing.classId &&
      sec.name.toLowerCase() === input.name.trim().toLowerCase(),
  );
  if (dup) return { ok: false, error: "Section name must be unique within the class." };
  setState({
    ...s,
    sections: s.sections.map((sec) =>
      sec.id === id
        ? { ...sec, name: input.name.trim(), status: input.status ?? sec.status }
        : sec,
    ),
  });
  logAudit("Section Updated", input.name);
  return { ok: true };
}

export function deleteSection(id: string): { ok: boolean; error?: string } {
  const s = ensure();
  const sec = s.sections.find((x) => x.id === id);
  if (!sec) return { ok: false, error: "Section not found." };
  const cls = s.classes.find((c) => c.id === sec.classId);
  const studentCount = cls
    ? studentsForClassName(cls.name, sec.academicYear).filter(
        (st) => (st.section ?? "") === sec.name,
      ).length
    : 0;
  if (studentCount > 0) {
    return { ok: false, error: "Cannot delete a section that still contains students." };
  }
  setState({ ...s, sections: s.sections.filter((x) => x.id !== id) });
  logAudit("Section Deleted", `${cls?.name} — ${sec.name}`);
  return { ok: true };
}

// ---------- Subject mutations ----------

export function createSubject(
  input: SubjectInput,
): { ok: boolean; error?: string; subject?: Subject } {
  const s = ensure();
  const dup = s.subjects.some(
    (sub) => sub.name.toLowerCase() === input.name.trim().toLowerCase(),
  );
  if (dup) return { ok: false, error: "Subject name must be unique." };
  const subject: Subject = {
    id: `sub_${s.subjectSeq + 1}`,
    name: input.name.trim(),
    code: input.code?.trim() || null,
    status: input.status ?? "ACTIVE",
    createdAt: new Date().toISOString(),
  };
  setState({ ...s, subjects: [...s.subjects, subject], subjectSeq: s.subjectSeq + 1 });
  logAudit("Subject Created", subject.name);
  return { ok: true, subject };
}

export function updateSubject(
  id: string,
  input: SubjectInput,
): { ok: boolean; error?: string } {
  const s = ensure();
  const dup = s.subjects.some(
    (sub) =>
      sub.id !== id && sub.name.toLowerCase() === input.name.trim().toLowerCase(),
  );
  if (dup) return { ok: false, error: "Subject name must be unique." };
  setState({
    ...s,
    subjects: s.subjects.map((sub) =>
      sub.id === id
        ? {
            ...sub,
            name: input.name.trim(),
            code: input.code?.trim() || null,
            status: input.status ?? sub.status,
          }
        : sub,
    ),
  });
  logAudit("Subject Updated", input.name);
  return { ok: true };
}

export function deleteSubject(id: string): { ok: boolean; error?: string } {
  const s = ensure();
  const subject = s.subjects.find((sub) => sub.id === id);
  if (!subject) return { ok: false, error: "Subject not found." };
  const tt = getTeachersState();
  const usedByTeacher = tt.assignments.some(
    (a) => a.status === "ACTIVE" && a.subject === subject.name,
  );
  if (usedByTeacher) {
    return { ok: false, error: "Cannot delete a subject used in teacher assignments." };
  }
  setState({
    ...s,
    subjects: s.subjects.filter((sub) => sub.id !== id),
    classSubjects: s.classSubjects.filter((cs) => cs.subjectId !== id),
  });
  logAudit("Subject Deleted", subject.name);
  return { ok: true };
}

// ---------- Class-Subject assignment ----------

export function assignSubjectToClass(
  classId: string,
  subjectId: string,
  sectionId: string | null = null,
): { ok: boolean; error?: string } {
  const s = ensure();
  const cls = s.classes.find((c) => c.id === classId);
  if (!cls) return { ok: false, error: "Class not found." };
  const dup = s.classSubjects.some(
    (cs) =>
      cs.classId === classId &&
      cs.subjectId === subjectId &&
      cs.sectionId === sectionId,
  );
  if (dup) return { ok: false, error: "Subject already assigned to this class/section." };

  const assignment: ClassSubjectAssignment = {
    id: `cs_${Date.now()}`,
    academicYear: cls.academicYear,
    classId,
    sectionId,
    subjectId,
  };
  setState({ ...s, classSubjects: [...s.classSubjects, assignment] });
  const subject = s.subjects.find((sub) => sub.id === subjectId);
  logAudit("Subject Assigned", `${cls.name} ← ${subject?.name}`);
  return { ok: true };
}

export function removeSubjectFromClass(
  classId: string,
  subjectId: string,
): { ok: boolean } {
  const s = ensure();
  setState({
    ...s,
    classSubjects: s.classSubjects.filter(
      (cs) => !(cs.classId === classId && cs.subjectId === subjectId),
    ),
  });
  const subject = s.subjects.find((sub) => sub.id === subjectId);
  const cls = s.classes.find((c) => c.id === classId);
  logAudit("Subject Removed", `${cls?.name} ✕ ${subject?.name}`);
  return { ok: true };
}

// ---------- CSV export ----------

export function exportClassesCsv() {
  const rows = classRows();
  const header = "Class,Academic Year,Has Sections,Status,Sections,Students,Subjects,Teachers\n";
  const body = rows
    .map((r) =>
      [
        r.name,
        r.academicYear,
        r.hasSections ? "Yes" : "No",
        r.status,
        r.sectionCount,
        r.studentCount,
        r.subjectCount,
        r.teacherCount,
      ].join(","),
    )
    .join("\n");
  downloadCsv(header + body, "classes.csv");
}

export function exportSectionsCsv() {
  const rows = sectionRows();
  const header = "Section,Class,Academic Year,Status,Students\n";
  const body = rows
    .map((r) => [r.name, r.className, r.academicYear, r.status, r.studentCount].join(","))
    .join("\n");
  downloadCsv(header + body, "sections.csv");
}

export function exportSubjectsCsv() {
  const rows = subjectRows();
  const header = "Subject,Code,Status,Classes,Teachers\n";
  const body = rows
    .map((r) => [r.name, r.code ?? "", r.status, r.classCount, r.usedByTeachers].join(","))
    .join("\n");
  downloadCsv(header + body, "subjects.csv");
}

function downloadCsv(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
