"use client";

import { useSyncExternalStore } from "react";
import {
  ACTIVE_ACADEMIC_YEAR,
  CLASSES,
  SECTIONS,
  SUBJECTS,
  generatePassword,
  teacherCode,
} from "./constants";
import { buildSeed } from "./seed";
import type {
  AssignmentInput,
  EmploymentStatus,
  Gender,
  Shift,
  Teacher,
  TeacherAssignment,
  TeacherInput,
  TeachersState,
} from "./types";

const KEY = "ekulmis_teachers_v1";

const EMPTY: TeachersState = { teachers: [], assignments: [], teacherSeq: 0 };

let state: TeachersState | null = null;
const listeners = new Set<() => void>();

function load(): TeachersState {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as TeachersState;
  } catch {
    /* ignore */
  }
  const seed = buildSeed();
  try {
    localStorage.setItem(KEY, JSON.stringify(seed));
  } catch {
    /* ignore */
  }
  return seed;
}

function ensure(): TeachersState {
  if (!state) state = load();
  return state;
}

function setState(next: TeachersState) {
  state = next;
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
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
  const year = ACTIVE_ACADEMIC_YEAR;
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
// Mutations
// ---------------------------------------------------------------------------

export interface RegisterResult {
  ok: boolean;
  error?: string;
  teacher?: Teacher;
  password?: string;
}

function phoneTaken(st: TeachersState, phone: string, excludeId?: string) {
  const p = phone.trim();
  return st.teachers.some(
    (t) => t.phone.trim() === p && t.id !== excludeId,
  );
}

export function registerTeacher(input: TeacherInput): RegisterResult {
  const st = ensure();
  if (phoneTaken(st, input.phone)) {
    return { ok: false, error: "A teacher with this phone number already exists." };
  }

  const teacherSeq = st.teacherSeq + 1;
  const code = teacherCode(teacherSeq);
  const password = generatePassword();
  const teacher: Teacher = {
    id: `t_${Date.now()}_${teacherSeq}`,
    code,
    fullName: input.fullName.trim(),
    gender: input.gender,
    phone: input.phone.trim(),
    email: input.email?.trim() || null,
    address: input.address?.trim() || null,
    qualification: input.qualification?.trim() || null,
    salary: input.salary,
    shift: input.shift,
    status: input.status ?? "ACTIVE",
    registrationDate: new Date().toISOString(),
    username: code,
    password,
  };

  setState({
    ...st,
    teachers: [teacher, ...st.teachers],
    teacherSeq,
  });
  return { ok: true, teacher, password };
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
  >
>;

export function updateTeacher(id: string, patch: TeacherPatch): RegisterResult {
  const st = ensure();
  const existing = st.teachers.find((t) => t.id === id);
  if (!existing) return { ok: false, error: "Teacher not found." };

  if (patch.phone && phoneTaken(st, patch.phone, id)) {
    return { ok: false, error: "A teacher with this phone number already exists." };
  }

  const updated: Teacher = {
    ...existing,
    fullName: patch.fullName?.trim() ?? existing.fullName,
    gender: patch.gender ?? existing.gender,
    phone: patch.phone?.trim() ?? existing.phone,
    email: patch.email !== undefined ? patch.email?.trim() || null : existing.email,
    address:
      patch.address !== undefined ? patch.address?.trim() || null : existing.address,
    qualification:
      patch.qualification !== undefined
        ? patch.qualification?.trim() || null
        : existing.qualification,
    salary: patch.salary ?? existing.salary,
    shift: patch.shift ?? existing.shift,
    status: patch.status ?? existing.status,
  };

  setState({
    ...st,
    teachers: st.teachers.map((t) => (t.id === id ? updated : t)),
  });
  return { ok: true, teacher: updated };
}

export function deleteTeacher(id: string): { ok: boolean } {
  const st = ensure();
  if (!st.teachers.some((t) => t.id === id)) return { ok: false };
  setState({
    teachers: st.teachers.filter((t) => t.id !== id),
    assignments: st.assignments.filter((a) => a.teacherId !== id),
    teacherSeq: st.teacherSeq,
  });
  return { ok: true };
}

export function resetTeacherPassword(id: string): { ok: boolean; password?: string } {
  const st = ensure();
  const password = generatePassword();
  const teachers = st.teachers.map((t) =>
    t.id === id ? { ...t, password } : t,
  );
  if (!teachers.some((t) => t.id === id)) return { ok: false };
  setState({ ...st, teachers });
  return { ok: true, password };
}

// ---------------------------------------------------------------------------
// Assignments
// ---------------------------------------------------------------------------

export interface AssignmentResult {
  ok: boolean;
  error?: string;
  assignment?: TeacherAssignment;
}

function isDuplicateAssignment(
  st: TeachersState,
  input: AssignmentInput,
  excludeId?: string,
): boolean {
  return st.assignments.some(
    (a) =>
      a.id !== excludeId &&
      a.teacherId === input.teacherId &&
      a.academicYear === input.academicYear &&
      a.className === input.className &&
      (a.section ?? "") === (input.section ?? "") &&
      a.subject === input.subject,
  );
}

export function createAssignment(input: AssignmentInput): AssignmentResult {
  const st = ensure();
  if (!st.teachers.some((t) => t.id === input.teacherId)) {
    return { ok: false, error: "Teacher not found." };
  }
  if (!CLASSES.includes(input.className as (typeof CLASSES)[number])) {
    return { ok: false, error: "Invalid class." };
  }
  if (input.section && !SECTIONS.includes(input.section as (typeof SECTIONS)[number])) {
    return { ok: false, error: "Invalid section." };
  }
  if (!SUBJECTS.includes(input.subject as (typeof SUBJECTS)[number])) {
    return { ok: false, error: "Invalid subject." };
  }
  if (isDuplicateAssignment(st, input)) {
    return { ok: false, error: "This assignment already exists." };
  }

  const assignment: TeacherAssignment = {
    id: `a_${Date.now()}`,
    teacherId: input.teacherId,
    academicYear: input.academicYear,
    className: input.className,
    section: input.section,
    subject: input.subject,
    status: "ACTIVE",
  };
  setState({ ...st, assignments: [assignment, ...st.assignments] });
  return { ok: true, assignment };
}

export function updateAssignment(
  id: string,
  patch: Partial<Pick<TeacherAssignment, "section" | "subject" | "status" | "className" | "academicYear">>,
): AssignmentResult {
  const st = ensure();
  const existing = st.assignments.find((a) => a.id === id);
  if (!existing) return { ok: false, error: "Assignment not found." };

  const next: TeacherAssignment = {
    ...existing,
    className: patch.className ?? existing.className,
    section: patch.section !== undefined ? patch.section : existing.section,
    subject: patch.subject ?? existing.subject,
    academicYear: patch.academicYear ?? existing.academicYear,
    status: patch.status ?? existing.status,
  };

  const probe: AssignmentInput = {
    teacherId: existing.teacherId,
    academicYear: next.academicYear,
    className: next.className,
    section: next.section,
    subject: next.subject,
  };
  if (isDuplicateAssignment(st, probe, id)) {
    return { ok: false, error: "An identical assignment already exists." };
  }

  setState({
    ...st,
    assignments: st.assignments.map((a) => (a.id === id ? next : a)),
  });
  return { ok: true, assignment: next };
}

export function deleteAssignment(id: string): { ok: boolean } {
  const st = ensure();
  setState({
    ...st,
    assignments: st.assignments.filter((a) => a.id !== id),
  });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Bulk import
// ---------------------------------------------------------------------------

export interface ImportRow {
  fullName?: string;
  gender?: string;
  phone?: string;
  salary?: string;
  shift?: string;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  failed: number;
  errors: { row: number; message: string }[];
}

export function bulkImport(rows: ImportRow[]): ImportResult {
  const st = ensure();
  const result: ImportResult = { imported: 0, skipped: 0, failed: 0, errors: [] };
  const teachers = [...st.teachers];
  let teacherSeq = st.teacherSeq;

  rows.forEach((row, i) => {
    const line = i + 2;
    const fullName = row.fullName?.trim();
    const genderRaw = row.gender?.trim().toUpperCase();
    const phone = row.phone?.trim();
    const shiftRaw = row.shift?.trim().toUpperCase();
    const salary = Number(row.salary?.trim());

    if (!fullName || !phone) {
      result.failed++;
      result.errors.push({ row: line, message: "Missing name or phone." });
      return;
    }
    if (genderRaw !== "MALE" && genderRaw !== "FEMALE") {
      result.failed++;
      result.errors.push({ row: line, message: `Invalid gender "${row.gender}".` });
      return;
    }
    if (shiftRaw !== "MORNING" && shiftRaw !== "AFTERNOON") {
      result.failed++;
      result.errors.push({ row: line, message: `Invalid shift "${row.shift}".` });
      return;
    }
    if (Number.isNaN(salary) || salary < 0) {
      result.failed++;
      result.errors.push({ row: line, message: "Invalid salary." });
      return;
    }
    if (teachers.some((t) => t.phone.trim() === phone)) {
      result.skipped++;
      result.errors.push({ row: line, message: `Duplicate phone "${phone}".` });
      return;
    }

    teacherSeq += 1;
    const code = teacherCode(teacherSeq);
    const password = generatePassword();
    teachers.unshift({
      id: `t_${Date.now()}_${teacherSeq}_${i}`,
      code,
      fullName,
      gender: genderRaw as Gender,
      phone,
      email: null,
      address: null,
      qualification: null,
      salary,
      shift: shiftRaw as Shift,
      status: "ACTIVE",
      registrationDate: new Date().toISOString(),
      username: code,
      password,
    });
    result.imported++;
  });

  if (result.imported > 0) {
    setState({ ...st, teachers, teacherSeq });
  }
  return result;
}

export function resetTeachers() {
  setState(buildSeed());
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
};
