"use client";

import { useSyncExternalStore } from "react";
import { ApiError } from "@/lib/api";
import { activeAcademicYear, ensureAcademicsLoaded, getAcademicsState } from "@/lib/academics/store";
import {
  apiBulkCreateAssignments,
  apiCreateAssignment,
  apiDeleteAssignment,
  apiDeleteTeacher,
  apiListAssignments,
  apiListTeachers,
  apiRegisterTeacher,
  apiUpdateTeacher,
} from "./api";
import { api } from "@/lib/api";
import type { TeacherMe } from "./api";
import { DEFAULT_TEACHER_PASSWORD } from "./constants";
import type {
  AssignmentInput,
  AssignmentStatus,
  BulkAssignmentInput,
  EmploymentStatus,
  Gender,
  Shift,
  Teacher,
  TeacherAssignment,
  TeacherInput,
  TeachersState,
} from "./types";

const EMPTY: TeachersState = { teachers: [], assignments: [], teacherSeq: 0 };

const PASSWORD_CACHE_KEY = "ek_teacher_passwords";

function readPasswordCache(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(
      localStorage.getItem(PASSWORD_CACHE_KEY) ?? "{}",
    ) as Record<string, string>;
  } catch {
    return {};
  }
}

function writePasswordCache(id: string, password: string) {
  if (typeof window === "undefined") return;
  const cache = readPasswordCache();
  cache[id] = password;
  localStorage.setItem(PASSWORD_CACHE_KEY, JSON.stringify(cache));
}

function withStoredPasswords(teachers: Teacher[]): Teacher[] {
  const cache = readPasswordCache();
  return teachers.map((t) => ({
    ...t,
    password: cache[t.id] ?? DEFAULT_TEACHER_PASSWORD,
  }));
}

function patchTeacherPassword(id: string, password: string) {
  const st = ensure();
  setState({
    ...st,
    teachers: st.teachers.map((t) =>
      t.id === id ? { ...t, password } : t,
    ),
  });
  writePasswordCache(id, password);
}

let state: TeachersState | null = null;
let loaded = false;
const listeners = new Set<() => void>();

function setState(next: TeachersState) {
  state = next;
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function apiErr(e: unknown, fallback: string): string {
  return e instanceof ApiError ? e.message : fallback;
}

export async function refreshTeachers(): Promise<void> {
  try {
    const [teachers, assignments] = await Promise.all([
      apiListTeachers(),
      apiListAssignments(),
    ]);
    setState({ teachers: withStoredPasswords(teachers), assignments, teacherSeq: teachers.length });
  } catch {
    /* keep cache */
  }
}

function ensure(): TeachersState {
  if (state) return state;
  if (typeof window === "undefined") return EMPTY;
  state = EMPTY;
  if (!loaded) {
    loaded = true;
    void refreshTeachers();
  }
  return state;
}

function resolveClassId(
  className: string,
  academicYear: string,
): { classId?: string; error?: string } {
  const a = getAcademicsState();
  const cls =
    a.classes.find((c) => c.name === className && c.academicYear === academicYear) ??
    a.classes.find((c) => c.name === className);
  if (!cls) {
    return {
      error: `Class "${className}" was not found. Create it under Academics first.`,
    };
  }
  return { classId: cls.id };
}

function resolveSectionId(
  classId: string,
  sectionName: string | null | undefined,
): { sectionId: string | null; error?: string } {
  if (!sectionName) return { sectionId: null };
  const sec = getAcademicsState().sections.find(
    (s) => s.classId === classId && s.name === sectionName,
  );
  if (!sec) {
    return { sectionId: null, error: `Section "${sectionName}" was not found.` };
  }
  return { sectionId: sec.id };
}

function resolveYearId(
  yearName: string,
): { yearId?: string; error?: string } {
  const y = getAcademicsState().academicYears.find((yr) => yr.name === yearName);
  if (!y) return { error: `Academic year "${yearName}" was not found.` };
  return { yearId: y.id };
}

function resolveSubjectId(
  subjectName: string,
): { subjectId?: string; error?: string } {
  const s = getAcademicsState().subjects.find((sub) => sub.name === subjectName);
  if (!s) return { error: `Subject "${subjectName}" was not found.` };
  return { subjectId: s.id };
}

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

export function getTeachersState(): TeachersState {
  return ensure();
}

export function getTeacher(id: string): Teacher | null {
  return ensure().teachers.find((t) => t.id === id || t.code === id) ?? null;
}

export function teacherAssignments(teacherId: string): TeacherAssignment[] {
  return ensure().assignments.filter((a) => a.teacherId === teacherId);
}

/**
 * Seed this store from the logged-in teacher's own `/teachers/me` profile.
 * A TEACHER user can't load the admin teachers/assignments lists, so pages that
 * read `teacherAssignments()` (e.g. Create Quiz) would otherwise see an empty
 * store and wrongly report "no assignments". Names come straight from the
 * profile; ID resolution still happens against the academics store.
 */
export function hydrateTeacherSelf(me: TeacherMe): void {
  const teacher: Teacher = {
    id: me.id,
    code: me.code,
    fullName: me.fullName,
    gender: me.gender,
    phone: me.phone ?? "",
    email: me.email,
    address: me.address,
    qualification: me.qualification,
    salary: me.salary,
    shift: me.shift,
    status: me.status,
    canViewStudents: me.canViewStudents,
    registrationDate: me.registrationDate,
    username: me.code,
    password: "",
  };
  const assignments: TeacherAssignment[] = me.assignments.map((a) => ({
    id: a.id,
    teacherId: me.id,
    academicYear: a.academicYear.name,
    className: a.class.name,
    section: a.section?.name ?? null,
    subject: a.subject.name,
    status: "ACTIVE",
  }));
  setState({ teachers: [teacher], assignments, teacherSeq: 1 });
}

/** Distinct class names assigned to this teacher (optionally for a year). */
export function teacherAssignedClasses(
  teacherId: string,
  academicYear?: string,
): string[] {
  return [
    ...new Set(
      teacherAssignments(teacherId)
        .filter(
          (a) =>
            a.status === "ACTIVE" &&
            (!academicYear || a.academicYear === academicYear),
        )
        .map((a) => a.className),
    ),
  ].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

/** Distinct section labels for a teacher + class.
 * When assigned to all sections (null), expand to real section names so the
 * teacher must pick a concrete section (PRD: never mix sections).
 */
export function teacherAssignedSections(
  teacherId: string,
  className: string,
  academicYear?: string,
): string[] {
  const rows = teacherAssignments(teacherId).filter(
    (a) =>
      a.status === "ACTIVE" &&
      a.className === className &&
      (!academicYear || a.academicYear === academicYear),
  );
  const hasAll = rows.some((a) => a.section === null);
  if (hasAll) {
    const academics = getAcademicsState();
    const year = academicYear || activeAcademicYear();
    const cls = academics.classes.find(
      (c) => c.name === className && c.academicYear === year,
    );
    if (cls) {
      return academics.sections
        .filter((s) => s.classId === cls.id && s.status === "ACTIVE")
        .map((s) => s.name)
        .sort();
    }
  }
  return [
    ...new Set(rows.map((a) => a.section).filter((s): s is string => Boolean(s))),
  ].sort();
}

/** Distinct subjects for a teacher + class (+ optional section). */
export function teacherAssignedSubjects(
  teacherId: string,
  className: string,
  section?: string | null,
  academicYear?: string,
): string[] {
  return [
    ...new Set(
      teacherAssignments(teacherId)
        .filter((a) => {
          if (a.status !== "ACTIVE") return false;
          if (a.className !== className) return false;
          if (academicYear && a.academicYear !== academicYear) return false;
          if (section === undefined) return true;
          // "All" / null means the all-sections assignment row
          if (section === "All" || section === null) {
            return a.section === null;
          }
          // Specific section: include exact match OR all-sections coverage
          return a.section === null || a.section === section;
        })
        .map((a) => a.subject),
    ),
  ].sort();
}

/** Group a teacher's assignments by year → class → section for display. */
export function groupTeacherAssignments(teacherId: string): {
  academicYear: string;
  className: string;
  section: string | null;
  subjects: string[];
  ids: string[];
}[] {
  const map = new Map<
    string,
    {
      academicYear: string;
      className: string;
      section: string | null;
      subjects: string[];
      ids: string[];
    }
  >();
  for (const a of teacherAssignments(teacherId)) {
    const key = `${a.academicYear}|${a.className}|${a.section ?? ""}`;
    const row = map.get(key);
    if (row) {
      if (!row.subjects.includes(a.subject)) row.subjects.push(a.subject);
      row.ids.push(a.id);
    } else {
      map.set(key, {
        academicYear: a.academicYear,
        className: a.className,
        section: a.section,
        subjects: [a.subject],
        ids: [a.id],
      });
    }
  }
  return [...map.values()]
    .map((g) => ({
      ...g,
      subjects: g.subjects.sort(),
    }))
    .sort((a, b) => {
      const y = b.academicYear.localeCompare(a.academicYear);
      if (y) return y;
      const c = a.className.localeCompare(b.className, undefined, {
        numeric: true,
      });
      if (c) return c;
      return (a.section ?? "").localeCompare(b.section ?? "");
    });
}

export interface TeacherSummary {
  total: number;
  active: number;
  inactive: number;
  morning: number;
  afternoon: number;
  assignedThisYear: number;
  withoutAssignments: number;
}

export function summarize(st: TeachersState): TeacherSummary {
  const year = activeAcademicYear();
  const assignedIds = new Set(
    st.assignments
      .filter((a) => a.academicYear === year && a.status === "ACTIVE")
      .map((a) => a.teacherId),
  );
  const out: TeacherSummary = {
    total: st.teachers.length,
    active: 0,
    inactive: 0,
    morning: 0,
    afternoon: 0,
    assignedThisYear: assignedIds.size,
    withoutAssignments: 0,
  };
  for (const t of st.teachers) {
    if (t.status === "ACTIVE") out.active++;
    else out.inactive++;
    if (t.shift === "MORNING") out.morning++;
    else out.afternoon++;
    if (!assignedIds.has(t.id)) out.withoutAssignments++;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Mutations (API-backed)
// ---------------------------------------------------------------------------

export interface RegisterResult {
  ok: boolean;
  error?: string;
  teacher?: Teacher;
  password?: string;
}

export async function registerTeacher(
  input: TeacherInput,
  opts?: { skipRefresh?: boolean },
): Promise<RegisterResult> {
  try {
    const res = await apiRegisterTeacher({
      fullName: input.fullName.trim(),
      gender: input.gender,
      phone: input.phone.trim() || null,
      email: input.email?.trim() || null,
      address: input.address?.trim() || null,
      qualification: input.qualification?.trim() || null,
      salary: input.salary,
      shift: input.shift,
      password: input.password?.trim() || DEFAULT_TEACHER_PASSWORD,
    });
    const password = res.initialPassword;
    writePasswordCache(res.teacher.id, password);
    if (!opts?.skipRefresh) await refreshTeachers();
    else {
      const st = ensure();
      setState({
        ...st,
        teachers: withStoredPasswords([...st.teachers, { ...res.teacher, password }]),
      });
    }
    return { ok: true, teacher: { ...res.teacher, password }, password };
  } catch (e) {
    return { ok: false, error: apiErr(e, "Failed to register teacher.") };
  }
}

export type TeacherPatch = Partial<
  Pick<
    Teacher,
    | "fullName"
    | "gender"
    | "phone"
    | "email"
    | "address"
    | "qualification"
    | "salary"
    | "shift"
    | "status"
    | "canViewStudents"
  >
>;

export async function updateTeacher(
  id: string,
  patch: TeacherPatch,
): Promise<RegisterResult> {
  try {
    const teacher = await apiUpdateTeacher(id, {
      fullName: patch.fullName?.trim(),
      gender: patch.gender,
      phone: patch.phone?.trim() ?? patch.phone,
      email: patch.email !== undefined ? patch.email?.trim() || null : undefined,
      address:
        patch.address !== undefined ? patch.address?.trim() || null : undefined,
      qualification:
        patch.qualification !== undefined
          ? patch.qualification?.trim() || null
          : undefined,
      salary: patch.salary,
      shift: patch.shift,
      status: patch.status,
      canViewStudents: patch.canViewStudents,
    });
    await refreshTeachers();
    return { ok: true, teacher };
  } catch (e) {
    return { ok: false, error: apiErr(e, "Failed to update teacher.") };
  }
}

export async function deleteTeacher(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await apiDeleteTeacher(id);
    await refreshTeachers();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: apiErr(e, "Failed to delete teacher.") };
  }
}

export async function resetTeacherPassword(
  id: string,
  newPassword?: string,
): Promise<{ ok: boolean; error?: string; password?: string }> {
  const password = newPassword?.trim() || DEFAULT_TEACHER_PASSWORD;
  if (password.length < 5) {
    return { ok: false, error: "Password must be at least 5 characters." };
  }
  try {
    await api(`/teachers/${id}/reset-password`, {
      method: "POST",
      body: { newPassword: password },
    });
    patchTeacherPassword(id, password);
    return { ok: true, password };
  } catch (e) {
    return { ok: false, error: apiErr(e, "Failed to reset password.") };
  }
}

// ---------------------------------------------------------------------------
// Assignments
// ---------------------------------------------------------------------------

export interface AssignmentResult {
  ok: boolean;
  error?: string;
  assignment?: TeacherAssignment;
}

function resolveAssignmentInput(input: AssignmentInput): {
  body?: {
    teacherId: string;
    academicYearId: string;
    classId: string;
    sectionId: string | null;
    subjectId: string;
  };
  error?: string;
} {
  const year = resolveYearId(input.academicYear);
  if (!year.yearId) return { error: year.error };
  const cls = resolveClassId(input.className, input.academicYear);
  if (!cls.classId) return { error: cls.error };
  const sec = resolveSectionId(cls.classId, input.section);
  if (sec.error) return { error: sec.error };
  const sub = resolveSubjectId(input.subject);
  if (!sub.subjectId) return { error: sub.error };
  return {
    body: {
      teacherId: input.teacherId,
      academicYearId: year.yearId,
      classId: cls.classId,
      sectionId: sec.sectionId,
      subjectId: sub.subjectId,
    },
  };
}

export async function createAssignment(
  input: AssignmentInput,
): Promise<AssignmentResult> {
  await ensureAcademicsLoaded();
  const st = ensure();
  if (!st.teachers.some((t) => t.id === input.teacherId)) {
    return { ok: false, error: "Teacher not found." };
  }
  const resolved = resolveAssignmentInput(input);
  if (!resolved.body) return { ok: false, error: resolved.error };
  try {
    const assignment = await apiCreateAssignment(resolved.body);
    await refreshTeachers();
    return { ok: true, assignment };
  } catch (e) {
    return { ok: false, error: apiErr(e, "Could not create assignment.") };
  }
}

export interface BulkAssignmentResult {
  ok: boolean;
  error?: string;
  createdCount?: number;
  skippedCount?: number;
  assignments?: TeacherAssignment[];
}

/**
 * Create many independent assignment rows for one teacher in one API call.
 *
 * Each slot is Class + Section + Subjects[]. Expanding a slot with 3 subjects
 * creates 3 rows — so Grade 7 / A / Math+Physics+Chem is fully supported,
 * while Grade 7 / B can have a different subject set in another slot.
 *
 * Exact duplicates (same teacher/year/class/section/subject) are skipped.
 */
export async function createBulkAssignments(
  input: BulkAssignmentInput,
): Promise<BulkAssignmentResult> {
  await ensureAcademicsLoaded();
  const st = ensure();
  if (!st.teachers.some((t) => t.id === input.teacherId)) {
    return { ok: false, error: "Teacher not found." };
  }
  if (!input.slots.length) {
    return { ok: false, error: "Add at least one class/section assignment." };
  }

  const year = resolveYearId(input.academicYear);
  if (!year.yearId) return { ok: false, error: year.error };

  const items: {
    classId: string;
    sectionId: string | null;
    subjectId: string;
  }[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < input.slots.length; i++) {
    const slot = input.slots[i]!;
    if (!slot.className.trim()) {
      return { ok: false, error: `Row ${i + 1}: select a class.` };
    }
    if (!slot.subjects.length) {
      return {
        ok: false,
        error: `Row ${i + 1}: select at least one subject for ${slot.className}.`,
      };
    }

    const cls = resolveClassId(slot.className, input.academicYear);
    if (!cls.classId) return { ok: false, error: cls.error };

    let sectionId: string | null = null;
    if (slot.section) {
      const sec = resolveSectionId(cls.classId, slot.section);
      if (sec.error || !sec.sectionId) {
        return {
          ok: false,
          error: `Row ${i + 1}: section "${slot.section}" was not found on ${slot.className}.`,
        };
      }
      sectionId = sec.sectionId;
    }

    for (const subjectName of slot.subjects) {
      const sub = resolveSubjectId(subjectName);
      if (!sub.subjectId) return { ok: false, error: sub.error };
      const key = `${cls.classId}|${sectionId ?? ""}|${sub.subjectId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({
        classId: cls.classId,
        sectionId,
        subjectId: sub.subjectId,
      });
    }
  }

  if (!items.length) {
    return { ok: false, error: "No valid assignments to create." };
  }

  try {
    const res = await apiBulkCreateAssignments({
      teacherId: input.teacherId,
      academicYearId: year.yearId,
      items,
    });
    await refreshTeachers();
    return {
      ok: true,
      createdCount: res.createdCount,
      skippedCount: res.skippedCount,
      assignments: res.created,
    };
  } catch (e) {
    return { ok: false, error: apiErr(e, "Could not create assignments.") };
  }
}

export async function updateAssignment(
  id: string,
  patch: Partial<
    Pick<TeacherAssignment, "section" | "subject" | "status" | "className" | "academicYear">
  >,
): Promise<AssignmentResult> {
  await ensureAcademicsLoaded();
  const st = ensure();
  const existing = st.assignments.find((a) => a.id === id);
  if (!existing) return { ok: false, error: "Assignment not found." };

  const next: AssignmentInput = {
    teacherId: existing.teacherId,
    academicYear: patch.academicYear ?? existing.academicYear,
    className: patch.className ?? existing.className,
    section: patch.section !== undefined ? patch.section : existing.section,
    subject: patch.subject ?? existing.subject,
  };

  try {
    await apiDeleteAssignment(id);
    const resolved = resolveAssignmentInput(next);
    if (!resolved.body) return { ok: false, error: resolved.error };
    const assignment = await apiCreateAssignment(resolved.body);
    await refreshTeachers();
    return { ok: true, assignment };
  } catch (e) {
    await refreshTeachers();
    return { ok: false, error: apiErr(e, "Failed to update assignment.") };
  }
}

export async function deleteAssignment(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await apiDeleteAssignment(id);
    await refreshTeachers();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: apiErr(e, "Failed to delete assignment.") };
  }
}

// ---------------------------------------------------------------------------
// Bulk import (sequential API registration)
// ---------------------------------------------------------------------------

export interface ImportRow {
  fullName?: string;
  gender?: string;
  phone?: string;
  salary?: string;
  shift?: string;
  [key: string]: string | undefined;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  failed: number;
  errors: { row: number; message: string }[];
}

export interface TeacherImportPreviewRow {
  row: number;
  data: ImportRow;
  status: "valid" | "duplicate" | "invalid";
  message?: string;
}

function isDuplicateError(msg?: string): boolean {
  if (!msg) return false;
  const m = msg.toLowerCase();
  return m.includes("duplicate") || m.includes("already exists");
}

function isValidPhone(phone: string): boolean {
  return phone.replace(/\D/g, "").length >= 6;
}

function teacherPhoneExists(phone: string): boolean {
  const norm = phone.replace(/\D/g, "");
  return ensure().teachers.some(
    (t) => t.phone?.replace(/\D/g, "") === norm,
  );
}

function validateTeacherImportRow(
  row: ImportRow,
  line: number,
  seenPhones: Set<string>,
): TeacherImportPreviewRow {
  const fullName = row.fullName?.trim();
  const genderRaw = row.gender?.trim().toUpperCase();
  const phone = row.phone?.trim();
  const shiftRaw = row.shift?.trim().toUpperCase();
  const salary = Number(row.salary?.trim());

  if (!fullName || !phone) {
    return {
      row: line,
      data: row,
      status: "invalid",
      message: "Missing name or phone.",
    };
  }
  if (!isValidPhone(phone)) {
    return {
      row: line,
      data: row,
      status: "invalid",
      message: "Invalid phone (at least 6 digits).",
    };
  }
  const phoneKey = phone.replace(/\D/g, "");
  if (seenPhones.has(phoneKey)) {
    return {
      row: line,
      data: row,
      status: "duplicate",
      message: "Duplicate phone in file.",
    };
  }
  seenPhones.add(phoneKey);

  if (genderRaw !== "MALE" && genderRaw !== "FEMALE") {
    return {
      row: line,
      data: row,
      status: "invalid",
      message: `Invalid gender "${row.gender}".`,
    };
  }
  if (shiftRaw !== "MORNING" && shiftRaw !== "AFTERNOON") {
    return {
      row: line,
      data: row,
      status: "invalid",
      message: `Invalid shift "${row.shift}".`,
    };
  }
  if (Number.isNaN(salary) || salary < 0) {
    return {
      row: line,
      data: row,
      status: "invalid",
      message: "Invalid salary.",
    };
  }
  if (teacherPhoneExists(phone)) {
    return {
      row: line,
      data: row,
      status: "duplicate",
      message: "Teacher with this phone already exists.",
    };
  }
  return { row: line, data: row, status: "valid" };
}

export async function previewTeacherImport(
  rows: ImportRow[],
): Promise<TeacherImportPreviewRow[]> {
  await refreshTeachers();
  const seenPhones = new Set<string>();
  return rows.map((row, i) =>
    validateTeacherImportRow(row, i + 2, seenPhones),
  );
}

export async function bulkImport(rows: ImportRow[]): Promise<ImportResult> {
  await refreshTeachers();
  const result: ImportResult = { imported: 0, skipped: 0, failed: 0, errors: [] };
  const seenPhones = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const line = i + 2;
    const preview = validateTeacherImportRow(row, line, seenPhones);

    if (preview.status === "invalid") {
      result.failed++;
      result.errors.push({ row: line, message: preview.message ?? "Invalid row." });
      continue;
    }
    if (preview.status === "duplicate") {
      result.skipped++;
      result.errors.push({ row: line, message: preview.message ?? "Skipped." });
      continue;
    }

    const res = await registerTeacher(
      {
        fullName: row.fullName!.trim(),
        gender: row.gender!.trim().toUpperCase() as Gender,
        phone: row.phone!.trim(),
        salary: Number(row.salary!.trim()),
        shift: row.shift!.trim().toUpperCase() as Shift,
      },
      { skipRefresh: true },
    );
    if (res.ok) result.imported++;
    else if (isDuplicateError(res.error)) {
      result.skipped++;
      result.errors.push({ row: line, message: res.error ?? "Duplicate." });
    } else {
      result.failed++;
      result.errors.push({ row: line, message: res.error ?? "Import failed." });
    }
  }

  if (result.imported > 0) await refreshTeachers();
  return result;
}

export function resetTeachers() {
  void refreshTeachers();
}

export function useTeachersState(): TeachersState {
  return useSyncExternalStore(subscribe, getTeachersState, () => EMPTY);
}

export type {
  EmploymentStatus,
  Gender,
  Shift,
  Teacher,
  TeacherAssignment,
  TeacherInput,
  AssignmentStatus,
};
