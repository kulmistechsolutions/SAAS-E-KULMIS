"use client";

import { useSyncExternalStore } from "react";
import { getState as getStudentsState } from "@/lib/students/store";
import { getTeachersState } from "@/lib/teachers/store";
import { ApiError } from "@/lib/api";
import {
  apiActivateYear,
  apiCreateClass,
  apiCreateClassSubject,
  apiCreateSection,
  apiCreateSubject,
  apiCreateYear,
  apiDeleteClass,
  apiDeleteClassSubject,
  apiDeleteSection,
  apiDeleteSubject,
  apiListClasses,
  apiListClassSubjects,
  apiListSections,
  apiListSubjects,
  apiListYears,
  apiUpdateClass,
  apiUpdateSection,
  apiUpdateSubject,
} from "./api";
import type {
  AcademicsDashboardSummary,
  AcademicsState,
  AcademicYear,
  AcademicYearInput,
  ClassInput,
  ClassRow,
  ClassStatistics,
  SchoolClass,
  Section,
  SectionInput,
  SectionRow,
  SectionStatistics,
  Subject,
  SubjectInput,
  SubjectRow,
} from "./types";

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
let loaded = false;
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
  emit();
}

/** Fetch the full academic structure from the API and map it to the UI shape. */
export async function refreshAcademics(): Promise<void> {
  try {
    const years = await apiListYears();

    const [classes, sections, subjects, classSubjects] = await Promise.all([
      apiListClasses(),
      apiListSections(),
      apiListSubjects(),
      apiListClassSubjects(),
    ]);

    const yearName = new Map(years.map((y) => [y.id, y.name]));
    const classYearName = new Map(
      classes.map((c) => [c.id, yearName.get(c.academicYearId) ?? ""]),
    );

    const mapped: AcademicsState = {
      academicYears: years.map((y) => ({
        id: y.id,
        name: y.name,
        startDate: y.startDate ? y.startDate.slice(0, 10) : "",
        endDate: y.endDate ? y.endDate.slice(0, 10) : "",
        status: y.isActive ? "ACTIVE" : "CLOSED",
      })),
      classes: classes.map((c) => ({
        id: c.id,
        name: c.name,
        academicYear: yearName.get(c.academicYearId) ?? "",
        orderIndex: c.orderIndex ?? 0,
        hasSections: c.hasSections,
        status: c.status,
        notes: c.notes,
        createdAt: c.createdAt,
      })),
      sections: sections.map((s) => ({
        id: s.id,
        name: s.name,
        classId: s.classId,
        academicYear: classYearName.get(s.classId) ?? "",
        status: s.status,
        createdAt: s.createdAt,
      })),
      subjects: subjects.map((s) => ({
        id: s.id,
        name: s.name,
        code: s.code,
        status: s.status,
        createdAt: s.createdAt,
      })),
      classSubjects: classSubjects.map((cs) => ({
        id: cs.id,
        academicYear: yearName.get(cs.academicYearId) ?? "",
        classId: cs.classId,
        sectionId: cs.sectionId,
        subjectId: cs.subjectId,
      })),
      audit: state?.audit ?? [],
      classSeq: 0,
      sectionSeq: 0,
      subjectSeq: 0,
      yearSeq: 0,
    };
    setState(mapped);
  } catch {
    /* keep existing cache; pages surface load errors via empty state */
  }
}

function ensure(): AcademicsState {
  if (state) return state;
  if (typeof window === "undefined") return EMPTY;
  state = EMPTY;
  if (!loaded) {
    loaded = true;
    void refreshAcademics();
  }
  return state;
}

export function getAcademicsState(): AcademicsState {
  return ensure();
}

export function useAcademicsState(): AcademicsState {
  return useSyncExternalStore(subscribe, getAcademicsState, () => EMPTY);
}

export function resetAcademics() {
  void refreshAcademics();
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

function apiErr(e: unknown, fallback: string): string {
  return e instanceof ApiError ? e.message : fallback;
}

function yearIdByName(name: string): string | undefined {
  return ensure().academicYears.find((y) => y.name === name)?.id;
}

export function activeAcademicYear(): string {
  const s = ensure();
  return s.academicYears.find((y) => y.status === "ACTIVE")?.name ?? "";
}

/** Wait for API-backed academic structure when the cache is still empty. */
export async function ensureAcademicsLoaded(): Promise<void> {
  const s = ensure();
  if (s.academicYears.length === 0 || s.classes.length === 0 || s.sections.length === 0) {
    await refreshAcademics();
  }
}

/** Notify dependent modules after the active academic year changes. */
export async function broadcastAcademicYearChange(): Promise<void> {
  const [
    { refreshFees },
    { refreshSalaries },
    { refreshExpenses },
    { refreshQuizzes },
    { refreshExaminations },
    { refreshPromotions },
    { refreshStudents },
    { refreshTeachers },
  ] = await Promise.all([
    import("@/lib/fees/store"),
    import("@/lib/salary/store"),
    import("@/lib/expenses/store"),
    import("@/lib/quiz/store"),
    import("@/lib/examinations/store"),
    import("@/lib/promotions/store"),
    import("@/lib/students/store"),
    import("@/lib/teachers/store"),
  ]);
  await Promise.all([
    refreshFees(),
    refreshSalaries(),
    refreshExpenses(),
    refreshQuizzes(),
    refreshExaminations(),
    refreshPromotions(),
    refreshStudents(),
    refreshTeachers(),
  ]);
}

export function academicYearNames(): string[] {
  return [...ensure().academicYears]
    .map((y) => y.name)
    .sort((a, b) => b.localeCompare(a));
}

export const DEFAULT_GRADE_COUNT = 12;

export function classesForYear(
  year?: string,
  opts?: { includeInactive?: boolean },
): SchoolClass[] {
  const y = year ?? activeAcademicYear();
  const seen = new Set<string>();
  return ensure()
    .classes.filter((c) => {
      if (y && c.academicYear !== y) return false;
      if (!opts?.includeInactive && c.status !== "ACTIVE") return false;
      const key = c.name.trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => {
      const orderDiff = (a.orderIndex || 0) - (b.orderIndex || 0);
      if (orderDiff !== 0) return orderDiff;
      return a.name.localeCompare(b.name, undefined, { numeric: true });
    });
}

export function classNamesForYear(
  year?: string,
  opts?: { includeInactive?: boolean },
): string[] {
  return classesForYear(year, opts).map((c) => c.name);
}

export function canCreateClassInYear(year?: string): boolean {
  const y = year ?? activeAcademicYear();
  const count = ensure().classes.filter(
    (c) => c.academicYear === y && c.status === "ACTIVE",
  ).length;
  return count < DEFAULT_GRADE_COUNT;
}

export function sectionNamesForClass(className: string, year?: string): string[] {
  const cls = classByName(className, year, { allowInactive: true });
  if (!cls || !cls.hasSections) return [];
  return sectionsForClass(cls.id)
    .filter((s) => s.status === "ACTIVE")
    .map((s) => s.name);
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

export function classByName(
  name: string,
  year?: string,
  opts?: { allowInactive?: boolean },
): SchoolClass | undefined {
  const s = ensure();
  const trimmed = name.trim();
  const y = year ?? activeAcademicYear();
  return s.classes.find(
    (c) =>
      c.name === trimmed &&
      c.academicYear === y &&
      (opts?.allowInactive || c.status === "ACTIVE"),
  );
}

export function sectionsForClass(classId: string): Section[] {
  return ensure()
    .sections.filter((s) => s.classId === classId && s.status === "ACTIVE")
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
  let classes = classesForYear(year, {
    includeInactive: opts?.status === "INACTIVE" || !opts?.status,
  });
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

export async function createAcademicYear(
  input: AcademicYearInput,
): Promise<{ ok: boolean; error?: string; year?: AcademicYear }> {
  const s = ensure();
  if (s.academicYears.some((y) => y.name === input.name)) {
    return { ok: false, error: "Academic year already exists." };
  }
  try {
    const created = await apiCreateYear({
      name: input.name,
      startDate: input.startDate || undefined,
      endDate: input.endDate || undefined,
      isActive: input.status === "ACTIVE",
    });
    await refreshAcademics();
    await broadcastAcademicYearChange();
    logAudit("Academic Year Created", input.name);
    const year: AcademicYear = {
      id: created.id,
      name: created.name,
      startDate: created.startDate ? created.startDate.slice(0, 10) : "",
      endDate: created.endDate ? created.endDate.slice(0, 10) : "",
      status: created.isActive ? "ACTIVE" : "CLOSED",
    };
    return { ok: true, year };
  } catch (e) {
    return { ok: false, error: apiErr(e, "Failed to create academic year.") };
  }
}

export async function setActiveAcademicYear(id: string): Promise<{ ok: boolean; error?: string }> {
  const s = ensure();
  const y = s.academicYears.find((x) => x.id === id);
  try {
    await apiActivateYear(id);
    await refreshAcademics();
    await broadcastAcademicYearChange();
    logAudit("Academic Year Updated", `${y?.name} set active`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: apiErr(e, "Failed to set active year.") };
  }
}

// ---------- Class mutations ----------

export async function createClass(
  input: ClassInput,
): Promise<{ ok: boolean; error?: string; cls?: SchoolClass }> {
  if (!canCreateClassInYear(input.academicYear)) {
    return {
      ok: false,
      error: `This year already has ${DEFAULT_GRADE_COUNT} classes. Rename an existing class instead.`,
    };
  }
  const academicYearId = yearIdByName(input.academicYear);
  if (!academicYearId) return { ok: false, error: "Academic year not found." };
  try {
    const created = await apiCreateClass({
      academicYearId,
      name: input.name.trim(),
      hasSections: input.hasSections,
      notes: input.notes ?? null,
      status: input.status ?? "ACTIVE",
    });
    await refreshAcademics();
    logAudit("Class Created", created.name);
    const cls = ensure().classes.find((c) => c.id === created.id);
    return { ok: true, cls };
  } catch (e) {
    return { ok: false, error: apiErr(e, "Failed to create class.") };
  }
}

export async function updateClass(
  id: string,
  input: ClassInput,
): Promise<{ ok: boolean; error?: string }> {
  const s = ensure();
  if (!s.classes.some((c) => c.id === id)) return { ok: false, error: "Class not found." };
  try {
    await apiUpdateClass(id, {
      name: input.name.trim(),
      hasSections: input.hasSections,
      notes: input.notes ?? null,
      status: input.status,
    });
    await refreshAcademics();
    logAudit("Class Updated", input.name);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: apiErr(e, "Failed to update class.") };
  }
}

export async function deleteClass(id: string): Promise<{ ok: boolean; error?: string }> {
  const s = ensure();
  const cls = s.classes.find((c) => c.id === id);
  if (!cls) return { ok: false, error: "Class not found." };
  const studentCount = studentsForClassName(cls.name, cls.academicYear).length;
  if (studentCount > 0) {
    return { ok: false, error: "Cannot delete a class that still contains students." };
  }
  try {
    await apiDeleteClass(id);
    await refreshAcademics();
    logAudit("Class Deleted", cls.name);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: apiErr(e, "Failed to delete class.") };
  }
}

// ---------- Section mutations ----------

export async function createSection(
  input: SectionInput,
): Promise<{ ok: boolean; error?: string; section?: Section }> {
  const s = ensure();
  const cls = s.classes.find((c) => c.id === input.classId);
  if (!cls) return { ok: false, error: "Class not found." };
  try {
    const created = await apiCreateSection({
      classId: input.classId,
      name: input.name.trim(),
      status: input.status ?? "ACTIVE",
    });
    await refreshAcademics();
    logAudit("Section Created", `${cls.name} — ${created.name}`);
    const section = ensure().sections.find((x) => x.id === created.id);
    return { ok: true, section };
  } catch (e) {
    return { ok: false, error: apiErr(e, "Failed to create section.") };
  }
}

export async function updateSection(
  id: string,
  input: SectionInput,
): Promise<{ ok: boolean; error?: string }> {
  const s = ensure();
  if (!s.sections.some((sec) => sec.id === id)) {
    return { ok: false, error: "Section not found." };
  }
  try {
    await apiUpdateSection(id, { name: input.name.trim(), status: input.status });
    await refreshAcademics();
    logAudit("Section Updated", input.name);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: apiErr(e, "Failed to update section.") };
  }
}

export async function deleteSection(id: string): Promise<{ ok: boolean; error?: string }> {
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
  try {
    await apiDeleteSection(id);
    await refreshAcademics();
    logAudit("Section Deleted", `${cls?.name} — ${sec.name}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: apiErr(e, "Failed to delete section.") };
  }
}

// ---------- Subject mutations ----------

export async function createSubject(
  input: SubjectInput,
): Promise<{ ok: boolean; error?: string; subject?: Subject }> {
  try {
    const created = await apiCreateSubject({
      name: input.name.trim(),
      code: input.code?.trim() || null,
      status: input.status ?? "ACTIVE",
    });
    await refreshAcademics();
    logAudit("Subject Created", created.name);
    const subject = ensure().subjects.find((x) => x.id === created.id);
    return { ok: true, subject };
  } catch (e) {
    return { ok: false, error: apiErr(e, "Failed to create subject.") };
  }
}

export async function updateSubject(
  id: string,
  input: SubjectInput,
): Promise<{ ok: boolean; error?: string }> {
  const s = ensure();
  if (!s.subjects.some((sub) => sub.id === id)) {
    return { ok: false, error: "Subject not found." };
  }
  try {
    await apiUpdateSubject(id, {
      name: input.name.trim(),
      code: input.code?.trim() || null,
      status: input.status,
    });
    await refreshAcademics();
    logAudit("Subject Updated", input.name);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: apiErr(e, "Failed to update subject.") };
  }
}

export async function deleteSubject(id: string): Promise<{ ok: boolean; error?: string }> {
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
  try {
    await apiDeleteSubject(id);
    await refreshAcademics();
    logAudit("Subject Deleted", subject.name);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: apiErr(e, "Failed to delete subject.") };
  }
}

// ---------- Class-Subject assignment ----------

export async function assignSubjectToClass(
  classId: string,
  subjectId: string,
  sectionId: string | null = null,
): Promise<{ ok: boolean; error?: string }> {
  const s = ensure();
  const cls = s.classes.find((c) => c.id === classId);
  if (!cls) return { ok: false, error: "Class not found." };
  const academicYearId = yearIdByName(cls.academicYear);
  if (!academicYearId) return { ok: false, error: "Academic year not found." };
  const dup = s.classSubjects.some(
    (cs) =>
      cs.classId === classId &&
      cs.subjectId === subjectId &&
      cs.sectionId === sectionId,
  );
  if (dup) return { ok: false, error: "Subject already assigned to this class/section." };
  try {
    await apiCreateClassSubject({ academicYearId, classId, sectionId, subjectId });
    await refreshAcademics();
    const subject = s.subjects.find((sub) => sub.id === subjectId);
    logAudit("Subject Assigned", `${cls.name} ← ${subject?.name}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: apiErr(e, "Failed to assign subject.") };
  }
}

export async function removeSubjectFromClass(
  classId: string,
  subjectId: string,
): Promise<{ ok: boolean; error?: string }> {
  const s = ensure();
  const targets = s.classSubjects.filter(
    (cs) => cs.classId === classId && cs.subjectId === subjectId,
  );
  try {
    for (const t of targets) {
      await apiDeleteClassSubject(t.id);
    }
    await refreshAcademics();
    const subject = s.subjects.find((sub) => sub.id === subjectId);
    const cls = s.classes.find((c) => c.id === classId);
    logAudit("Subject Removed", `${cls?.name} ✕ ${subject?.name}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: apiErr(e, "Failed to remove subject.") };
  }
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
