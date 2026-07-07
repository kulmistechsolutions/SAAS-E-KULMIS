"use client";

import { useSyncExternalStore } from "react";
import { CLASSES, PARENT_PREFIX, SECTIONS, STUDENT_PREFIX, code, generatePassword } from "./constants";
import { buildParent, migrateParent } from "./parent-utils";
import { buildSeed } from "./seed";
import type {
  Gender,
  Parent,
  ParentStatus,
  Student,
  StudentInput,
  StudentStatus,
  StudentWithParent,
  StudentsState,
} from "./types";

const KEY = "ekulmis_students_v2";
const LEGACY_KEY = "ekulmis_students_v1";

const EMPTY: StudentsState = {
  students: [],
  parents: [],
  studentSeq: 0,
  parentSeq: 0,
};

let state: StudentsState | null = null;
const listeners = new Set<() => void>();

function migrateState(raw: StudentsState): StudentsState {
  const taken: string[] = [];
  const parents = raw.parents.map((p, i) => {
    const migrated = migrateParent(p as Partial<Parent>, i + 1, taken);
    taken.push(migrated.username);
    return migrated;
  });
  return { ...raw, parents };
}

function load(): StudentsState {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return migrateState(JSON.parse(raw) as StudentsState);
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const migrated = migrateState(JSON.parse(legacy) as StudentsState);
      localStorage.setItem(KEY, JSON.stringify(migrated));
      return migrated;
    }
  } catch {
    /* ignore corrupt storage */
  }
  const seed = buildSeed();
  try {
    localStorage.setItem(KEY, JSON.stringify(seed));
  } catch {
    /* ignore */
  }
  return seed;
}

function ensure(): StudentsState {
  if (!state) state = load();
  return state;
}

function setState(next: StudentsState) {
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
  return () => {
    listeners.delete(cb);
  };
}

const norm = (v: string) => v.trim().toLowerCase().replace(/\s+/g, " ");

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

export function getState(): StudentsState {
  return ensure();
}

export function withParents(st: StudentsState): StudentWithParent[] {
  const map = new Map(st.parents.map((p) => [p.id, p]));
  return st.students.map((s) => ({
    ...s,
    parent: map.get(s.parentId) ?? {
      id: s.parentId,
      code: "—",
      name: "Unknown",
      phone: "—",
      altPhone: null,
      email: null,
      address: null,
      occupation: null,
      registrationDate: new Date().toISOString(),
      status: "ACTIVE",
      username: "unknown",
      password: "",
    },
  }));
}

export function getStudentWithParent(id: string): StudentWithParent | null {
  const st = ensure();
  const s = st.students.find((x) => x.id === id || x.code === id);
  if (!s) return null;
  const parent = st.parents.find((p) => p.id === s.parentId);
  return {
    ...s,
    parent: parent ?? {
      id: s.parentId,
      code: "—",
      name: "Unknown",
      phone: "—",
      altPhone: null,
      email: null,
      address: null,
      occupation: null,
      registrationDate: new Date().toISOString(),
      status: "ACTIVE",
      username: "unknown",
      password: "",
    },
  };
}

export function parentChildren(parentId: string): Student[] {
  return ensure().students.filter((s) => s.parentId === parentId);
}

export interface StudentSummary {
  total: number;
  active: number;
  inactive: number;
  graduated: number;
  male: number;
  female: number;
  newThisMonth: number;
}

export function summarize(students: Student[]): StudentSummary {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const out: StudentSummary = {
    total: students.length,
    active: 0,
    inactive: 0,
    graduated: 0,
    male: 0,
    female: 0,
    newThisMonth: 0,
  };
  for (const s of students) {
    if (s.status === "ACTIVE") out.active++;
    else if (s.status === "INACTIVE") out.inactive++;
    else if (s.status === "GRADUATED") out.graduated++;
    if (s.gender === "MALE") out.male++;
    else out.female++;
    if (new Date(s.registrationDate).getTime() >= monthStart) out.newThisMonth++;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Mutations (enforce PRD rules)
// ---------------------------------------------------------------------------

export interface RegisterResult {
  ok: boolean;
  error?: string;
  student?: Student;
  parentCreated?: boolean;
  parentCode?: string;
}

function findParentByPhone(st: StudentsState, phone: string) {
  const p = phone.trim();
  return st.parents.find((x) => x.phone.trim() === p);
}

function isDuplicate(
  st: StudentsState,
  parentId: string,
  fullName: string,
  className: string,
  section: string | null | undefined,
): boolean {
  return st.students.some(
    (s) =>
      s.parentId === parentId &&
      norm(s.fullName) === norm(fullName) &&
      s.className === className &&
      (s.section ?? "") === (section ?? ""),
  );
}

export function registerStudent(input: StudentInput): RegisterResult {
  const st = ensure();

  let parent = findParentByPhone(st, input.parentPhone);
  let parentCreated = false;
  let parentSeq = st.parentSeq;
  const newParents = [...st.parents];

  if (!parent) {
    parentSeq += 1;
    parent = buildParent(
      input.parentName,
      input.parentPhone,
      parentSeq,
      st.parents.map((p) => p.username),
      { id: `p_${Date.now()}_${parentSeq}` },
    );
    parentCreated = true;
    newParents.push(parent);
  }

  if (isDuplicate(st, parent.id, input.fullName, input.className, input.section)) {
    return {
      ok: false,
      error:
        "Duplicate student: the same name already exists under this parent in the same class/section.",
    };
  }

  const studentSeq = st.studentSeq + 1;
  const student: Student = {
    id: `s_${Date.now()}_${studentSeq}`,
    code: code(STUDENT_PREFIX, studentSeq),
    fullName: input.fullName.trim(),
    gender: input.gender,
    dob: input.dob ?? null,
    phone: input.phone?.trim() || null,
    parentId: parent.id,
    className: input.className,
    section: input.section || null,
    monthlyFee: input.monthlyFee,
    academicYear: input.academicYear,
    registrationDate: new Date().toISOString(),
    status: input.status ?? "ACTIVE",
    notes: input.notes?.trim() || null,
  };

  setState({
    students: [student, ...st.students],
    parents: newParents,
    studentSeq,
    parentSeq,
  });

  return { ok: true, student, parentCreated, parentCode: parent.code };
}

export type StudentPatch = Partial<
  Pick<
    Student,
    | "fullName"
    | "gender"
    | "dob"
    | "phone"
    | "className"
    | "section"
    | "monthlyFee"
    | "status"
    | "notes"
    | "academicYear"
  >
> & { parentName?: string; parentPhone?: string };

export function updateStudent(id: string, patch: StudentPatch): RegisterResult {
  const st = ensure();
  const existing = st.students.find((s) => s.id === id);
  if (!existing) return { ok: false, error: "Student not found." };

  // Editing must never regenerate the Student ID or the Parent account.
  const updated: Student = {
    ...existing,
    fullName: patch.fullName?.trim() ?? existing.fullName,
    gender: patch.gender ?? existing.gender,
    dob: patch.dob !== undefined ? patch.dob : existing.dob,
    phone: patch.phone !== undefined ? patch.phone?.trim() || null : existing.phone,
    className: patch.className ?? existing.className,
    section: patch.section !== undefined ? patch.section || null : existing.section,
    monthlyFee: patch.monthlyFee ?? existing.monthlyFee,
    status: patch.status ?? existing.status,
    notes: patch.notes !== undefined ? patch.notes?.trim() || null : existing.notes,
    academicYear: patch.academicYear ?? existing.academicYear,
  };

  // Update the existing parent record in place (no new account).
  const parents = st.parents.map((p) =>
    p.id === existing.parentId
      ? {
          ...p,
          name: patch.parentName?.trim() ?? p.name,
          phone: patch.parentPhone?.trim() ?? p.phone,
        }
      : p,
  );

  setState({
    ...st,
    students: st.students.map((s) => (s.id === id ? updated : s)),
    parents,
  });
  return { ok: true, student: updated };
}

export interface DeleteResult {
  ok: boolean;
  parentDeleted: boolean;
}

export function deleteStudent(id: string): DeleteResult {
  const st = ensure();
  const target = st.students.find((s) => s.id === id);
  if (!target) return { ok: false, parentDeleted: false };

  const remaining = st.students.filter((s) => s.id !== id);
  const parentHasOtherChildren = remaining.some(
    (s) => s.parentId === target.parentId,
  );
  const parents = parentHasOtherChildren
    ? st.parents
    : st.parents.filter((p) => p.id !== target.parentId);

  setState({ ...st, students: remaining, parents });
  return { ok: true, parentDeleted: !parentHasOtherChildren };
}

// ---------------------------------------------------------------------------
// Bulk import
// ---------------------------------------------------------------------------

export interface ImportRow {
  fullName?: string;
  gender?: string;
  parentName?: string;
  parentPhone?: string;
  className?: string;
  section?: string;
  monthlyFee?: string;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  failed: number;
  errors: { row: number; message: string }[];
}

export function bulkImport(rows: ImportRow[], academicYear: string): ImportResult {
  const st = ensure();
  const result: ImportResult = { imported: 0, skipped: 0, failed: 0, errors: [] };

  const students = [...st.students];
  const parents = [...st.parents];
  let studentSeq = st.studentSeq;
  let parentSeq = st.parentSeq;

  rows.forEach((row, i) => {
    const line = i + 2; // account for header row in CSV
    const fullName = row.fullName?.trim();
    const genderRaw = row.gender?.trim().toUpperCase();
    const parentName = row.parentName?.trim();
    const parentPhone = row.parentPhone?.trim();
    const className = row.className?.trim();
    const section = row.section?.trim() || null;
    const feeRaw = row.monthlyFee?.trim();

    if (!fullName || !parentName || !parentPhone || !className) {
      result.failed++;
      result.errors.push({ row: line, message: "Missing required field(s)." });
      return;
    }
    if (genderRaw !== "MALE" && genderRaw !== "FEMALE") {
      result.failed++;
      result.errors.push({ row: line, message: `Invalid gender "${row.gender}".` });
      return;
    }
    if (!CLASSES.includes(className as (typeof CLASSES)[number])) {
      result.failed++;
      result.errors.push({ row: line, message: `Invalid class "${className}".` });
      return;
    }
    if (section && !SECTIONS.includes(section as (typeof SECTIONS)[number])) {
      result.failed++;
      result.errors.push({ row: line, message: `Invalid section "${section}".` });
      return;
    }
    const monthlyFee = Number(feeRaw);
    if (!feeRaw || Number.isNaN(monthlyFee) || monthlyFee < 0) {
      result.failed++;
      result.errors.push({ row: line, message: "Invalid or missing monthly fee." });
      return;
    }

    let parent = parents.find((p) => p.phone.trim() === parentPhone);
    if (!parent) {
      parentSeq += 1;
      parent = buildParent(
        parentName,
        parentPhone,
        parentSeq,
        parents.map((p) => p.username),
        { id: `p_${Date.now()}_${parentSeq}_${i}` },
      );
      parents.push(parent);
    }

    const dup = students.some(
      (s) =>
        s.parentId === parent!.id &&
        norm(s.fullName) === norm(fullName) &&
        s.className === className &&
        (s.section ?? "") === (section ?? ""),
    );
    if (dup) {
      result.skipped++;
      result.errors.push({ row: line, message: `Duplicate student "${fullName}".` });
      return;
    }

    studentSeq += 1;
    students.unshift({
      id: `s_${Date.now()}_${studentSeq}_${i}`,
      code: code(STUDENT_PREFIX, studentSeq),
      fullName,
      gender: genderRaw as Gender,
      dob: null,
      phone: null,
      parentId: parent.id,
      className,
      section,
      monthlyFee,
      academicYear,
      registrationDate: new Date().toISOString(),
      status: "ACTIVE",
      notes: null,
    });
    result.imported++;
  });

  if (result.imported > 0) {
    setState({ students, parents, studentSeq, parentSeq });
  }
  return result;
}

// ---------------------------------------------------------------------------
// Parents (auto-created via student registration; admin can edit/disable)
// ---------------------------------------------------------------------------

export function getParent(id: string): Parent | null {
  return ensure().parents.find((p) => p.id === id || p.code === id) ?? null;
}

export interface ParentWithChildren extends Parent {
  children: Student[];
}

export function getParentWithChildren(id: string): ParentWithChildren | null {
  const st = ensure();
  const parent = st.parents.find((p) => p.id === id || p.code === id);
  if (!parent) return null;
  return {
    ...parent,
    children: st.students.filter((s) => s.parentId === parent.id),
  };
}

export interface ParentListRow extends Parent {
  childCount: number;
}

export function listParents(st: StudentsState): ParentListRow[] {
  const counts = new Map<string, number>();
  for (const s of st.students) {
    counts.set(s.parentId, (counts.get(s.parentId) ?? 0) + 1);
  }
  return st.parents
    .filter((p) => (counts.get(p.id) ?? 0) > 0)
    .map((p) => ({ ...p, childCount: counts.get(p.id) ?? 0 }));
}

export interface ParentAdminSummary {
  totalParents: number;
  activeParents: number;
  inactiveParents: number;
  totalChildren: number;
  multiChildFamilies: number;
  registeredThisMonth: number;
}

export function summarizeParents(st: StudentsState): ParentAdminSummary {
  const rows = listParents(st);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  let active = 0,
    inactive = 0,
    multi = 0,
    regMonth = 0,
    children = 0;
  for (const p of rows) {
    if (p.status === "ACTIVE") active++;
    else inactive++;
    if (p.childCount > 1) multi++;
    if (new Date(p.registrationDate).getTime() >= monthStart) regMonth++;
    children += p.childCount;
  }
  return {
    totalParents: rows.length,
    activeParents: active,
    inactiveParents: inactive,
    totalChildren: children,
    multiChildFamilies: multi,
    registeredThisMonth: regMonth,
  };
}

export interface ParentDashboardSummary {
  totalChildren: number;
  activeStudents: number;
  outstandingFees: number;
  totalFeesPaid: number;
  upcomingExams: number;
  activeQuizzes: number;
  attendancePercentage: number;
  latestGrade: string;
}

export function parentDashboard(
  parentId: string,
  st: StudentsState,
): ParentDashboardSummary {
  const children = st.students.filter((s) => s.parentId === parentId);
  const active = children.filter((s) => s.status === "ACTIVE").length;
  let outstanding = 0;
  let paid = 0;
  for (const c of children) {
    const seed = c.code.charCodeAt(c.code.length - 1) % 5;
    outstanding += seed > 2 ? c.monthlyFee * 2 : 0;
    paid += c.monthlyFee * (6 + (seed % 3));
  }
  const attPct =
    children.length === 0
      ? 0
      : Math.round(
          children.reduce((sum, c) => sum + (88 + (c.code.length % 10)), 0) /
            children.length,
        );
  return {
    totalChildren: children.length,
    activeStudents: active,
    outstandingFees: outstanding,
    totalFeesPaid: paid,
    upcomingExams: Math.min(children.length * 2, 6),
    activeQuizzes: Math.min(children.length, 4),
    attendancePercentage: attPct,
    latestGrade: ["A", "B+", "A-", "B", "A+"][children.length % 5],
  };
}

export type ParentPatch = Partial<
  Pick<
    Parent,
    "name" | "phone" | "altPhone" | "email" | "address" | "occupation" | "status"
  >
>;

export function updateParent(id: string, patch: ParentPatch): { ok: boolean; error?: string; parent?: Parent } {
  const st = ensure();
  const existing = st.parents.find((p) => p.id === id);
  if (!existing) return { ok: false, error: "Parent not found." };

  const phone = patch.phone?.trim() ?? existing.phone;
  if (
    patch.phone &&
    st.parents.some((p) => p.id !== id && p.phone.trim() === phone)
  ) {
    return { ok: false, error: "Another parent already uses this phone number." };
  }

  const updated: Parent = {
    ...existing,
    name: patch.name?.trim() ?? existing.name,
    phone,
    altPhone: patch.altPhone !== undefined ? patch.altPhone?.trim() || null : existing.altPhone,
    email: patch.email !== undefined ? patch.email?.trim() || null : existing.email,
    address: patch.address !== undefined ? patch.address?.trim() || null : existing.address,
    occupation:
      patch.occupation !== undefined ? patch.occupation?.trim() || null : existing.occupation,
    status: patch.status ?? existing.status,
  };

  setState({
    ...st,
    parents: st.parents.map((p) => (p.id === id ? updated : p)),
  });
  return { ok: true, parent: updated };
}

export function setParentStatus(id: string, status: ParentStatus) {
  return updateParent(id, { status });
}

export function resetParentPassword(id: string): { ok: boolean; password?: string } {
  const st = ensure();
  const password = generatePassword();
  const parents = st.parents.map((p) =>
    p.id === id ? { ...p, password } : p,
  );
  if (!parents.some((p) => p.id === id)) return { ok: false };
  setState({ ...st, parents });
  return { ok: true, password };
}

export function changeParentPassword(
  id: string,
  current: string,
  next: string,
): { ok: boolean; error?: string } {
  const st = ensure();
  const parent = st.parents.find((p) => p.id === id);
  if (!parent) return { ok: false, error: "Parent not found." };
  if (parent.password !== current)
    return { ok: false, error: "Current password is incorrect." };
  if (next.length < 6)
    return { ok: false, error: "New password must be at least 6 characters." };
  const parents = st.parents.map((p) =>
    p.id === id ? { ...p, password: next } : p,
  );
  setState({ ...st, parents });
  return { ok: true };
}

/** Danger: reset demo data back to the generated seed. */
export function resetStudents() {
  setState(buildSeed());
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

export function useStudentsState(): StudentsState {
  return useSyncExternalStore(subscribe, getState, () => EMPTY);
}

export type { Gender, Parent, Student, StudentStatus, StudentWithParent };
