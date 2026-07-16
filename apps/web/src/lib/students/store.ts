"use client";

import { useSyncExternalStore } from "react";
import { ApiError, getAccessToken } from "@/lib/api";
import { getCachedAuthUser } from "@/lib/auth";
import { ensureAcademicsLoaded, getAcademicsState } from "@/lib/academics/store";
import {
  apiDeleteStudent,
  apiDeleteStudentPhoto,
  apiGetStudent,
  apiListParents,
  apiListStudentsWithParents,
  apiRegisterStudent,
  apiResetParentPassword,
  apiUpdateParent,
  apiUpdateStudent,
  apiUploadStudentPhoto,
} from "./api";
import { invalidateStudentPhoto } from "./photo";
import { isTeacherPortalRoute } from "@/lib/teacher-portal/routes";
import type {
  Gender,
  Parent,
  ParentStatus,
  Student,
  StudentInput,
  StudentPhotoChange,
  StudentStatus,
  StudentWithParent,
  StudentsState,
} from "./types";

const EMPTY: StudentsState = {
  students: [],
  parents: [],
  studentSeq: 0,
  parentSeq: 0,
};

let state: StudentsState | null = null;
let refreshing = false;
let refreshFailed = false;
const listeners = new Set<() => void>();

interface RefreshSnapshot {
  loading: boolean;
  failed: boolean;
}
let refreshSnapshot: RefreshSnapshot = { loading: false, failed: false };

function getRefreshSnapshot(): RefreshSnapshot {
  if (
    refreshSnapshot.loading !== refreshing ||
    refreshSnapshot.failed !== refreshFailed
  ) {
    refreshSnapshot = { loading: refreshing, failed: refreshFailed };
  }
  return refreshSnapshot;
}

function setState(next: StudentsState) {
  state = next;
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

const TEACHER_PORTAL_SESSION_KEY = "ekulmis_teacher_portal_session_v1";

function shouldSkipBulkStudentDirectory(): boolean {
  if (typeof window === "undefined") return false;
  if (isTeacherPortalRoute(window.location.pathname)) return true;
  const role = getCachedAuthUser()?.role;
  if (role === "TEACHER") return true;
  if (role) {
    // We know the logged-in role and it isn't TEACHER — any leftover
    // teacher-portal session flag from an earlier login in this browser is
    // stale, so clear it instead of letting it block this account forever.
    localStorage.removeItem(TEACHER_PORTAL_SESSION_KEY);
    return false;
  }
  if (localStorage.getItem(TEACHER_PORTAL_SESSION_KEY)) return true;
  return false;
}

/** Load students + parents from the API into the name-based UI cache. */
export async function refreshStudents(): Promise<boolean> {
  if (shouldSkipBulkStudentDirectory()) return false;
  if (!getAccessToken()) return false;
  if (refreshing) return false;

  refreshing = true;
  refreshFailed = false;
  listeners.forEach((l) => l());

  try {
    const { students, parents: embeddedParents } =
      await apiListStudentsWithParents();
    setState({
      students,
      parents: embeddedParents,
      studentSeq: students.length,
      parentSeq: embeddedParents.length,
    });

    // Full parents directory in the background (includes guardians with no students).
    void apiListParents()
      .then((parents) => {
        if (parents.length === 0) return;
        const st = state;
        if (!st) return;
        setState({
          ...st,
          parents,
          parentSeq: parents.length,
        });
      })
      .catch(() => {
        /* keep embedded parents */
      });

    return true;
  } catch (e) {
    if (
      e instanceof ApiError &&
      (e.status === 403 || e.message.includes("View Students permission"))
    ) {
      return false;
    }
    refreshFailed = true;
    console.error("[students] refresh failed:", e);
    return false;
  } finally {
    refreshing = false;
    listeners.forEach((l) => l());
  }
}

function mergeStudentIntoState(student: Student, parent?: Parent): void {
  const st = ensure();
  const students = [
    ...st.students.filter((s) => s.id !== student.id),
    student,
  ];
  let parents = st.parents;
  if (parent) {
    parents = [...st.parents.filter((p) => p.id !== parent.id), parent];
  }
  setState({
    ...st,
    students,
    parents,
    studentSeq: students.length,
    parentSeq: parents.length,
  });
}

/** Fetch one student from the API and merge into the local cache. */
export async function ensureStudentLoaded(
  id: string,
): Promise<StudentWithParent | null> {
  try {
    const { student, parent } = await apiGetStudent(id);
    mergeStudentIntoState(student, parent);
  } catch (e) {
    console.error(`[students] failed to load student ${id}:`, e);
  }
  return getStudentWithParent(id);
}

function ensure(): StudentsState {
  if (state) return state;
  if (typeof window === "undefined") return EMPTY;
  state = EMPTY;
  return state;
}

const norm = (v: string) => v.trim().toLowerCase().replace(/\s+/g, " ");

function apiErr(e: unknown, fallback: string): string {
  return e instanceof ApiError ? e.message : fallback;
}

/** Resolve a class name (+ academic year) to a real class id. */
function resolveClassId(
  className: string,
  academicYear: string,
): { classId?: string; error?: string } {
  const a = getAcademicsState();
  const cls =
    a.classes.find((c) => c.name === className && c.academicYear === academicYear) ??
    null;
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
  const a = getAcademicsState();
  const sec = a.sections.find(
    (s) => s.classId === classId && s.name === sectionName,
  );
  if (!sec) {
    return { sectionId: null, error: `Section "${sectionName}" was not found.` };
  }
  return { sectionId: sec.id };
}

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
// Mutations (API-backed)
// ---------------------------------------------------------------------------

export interface RegisterResult {
  ok: boolean;
  error?: string;
  warning?: string;
  student?: Student;
  parentCreated?: boolean;
  parentCode?: string;
  initialParentPassword?: string;
}

function isDuplicate(
  st: StudentsState,
  parentPhone: string,
  fullName: string,
  className: string,
  section: string | null | undefined,
): boolean {
  const parent = st.parents.find((p) => p.phone.trim() === parentPhone.trim());
  if (!parent) return false;
  return st.students.some(
    (s) =>
      s.parentId === parent.id &&
      norm(s.fullName) === norm(fullName) &&
      s.className === className &&
      (s.section ?? "") === (section ?? ""),
  );
}

function isDuplicateError(msg?: string): boolean {
  if (!msg) return false;
  const m = msg.toLowerCase();
  return m.includes("duplicate") || m.includes("already exists");
}

function isValidPhone(phone: string): boolean {
  return phone.replace(/\D/g, "").length >= 6;
}

async function applyStudentPhoto(
  studentId: string,
  photo?: StudentPhotoChange,
): Promise<{ ok: true; student?: Student } | { ok: false; error: string }> {
  if (!photo?.file && !photo?.remove) return { ok: true };
  try {
    if (photo.remove) {
      invalidateStudentPhoto(studentId);
      const student = await apiDeleteStudentPhoto(studentId);
      return { ok: true, student };
    }
    if (photo.file) {
      invalidateStudentPhoto(studentId);
      const student = await apiUploadStudentPhoto(studentId, photo.file);
      return { ok: true, student };
    }
    return { ok: true };
  } catch (e) {
    console.error(`[students] photo upload failed for ${studentId}:`, e);
    return { ok: false, error: apiErr(e, "Photo upload failed.") };
  }
}

export async function registerStudent(
  input: StudentInput,
  opts?: { skipRefresh?: boolean; photo?: StudentPhotoChange },
): Promise<RegisterResult> {
  await ensureAcademicsLoaded();
  const st = ensure();
  const { classId, error } = resolveClassId(input.className, input.academicYear);
  if (!classId) return { ok: false, error };
  const sec = resolveSectionId(classId, input.section);
  if (sec.error) return { ok: false, error: sec.error };

  if (!isValidPhone(input.parentPhone)) {
    return { ok: false, error: "Invalid parent phone number (at least 6 digits)." };
  }

  if (isDuplicate(st, input.parentPhone, input.fullName, input.className, input.section)) {
    return {
      ok: false,
      error:
        "Duplicate student: the same name already exists under this parent in the same class/section.",
    };
  }

  try {
    const res = await apiRegisterStudent({
      fullName: input.fullName.trim(),
      gender: input.gender,
      dob: input.dob ?? null,
      phone: input.phone?.trim() || null,
      notes: input.notes?.trim() || null,
      parentName: input.parentName.trim(),
      parentPhone: input.parentPhone.trim(),
      classId,
      sectionId: sec.sectionId,
      monthlyFee: input.monthlyFee,
      feeStartMode: input.feeStartMode,
      agreementAmount: input.agreementAmount,
    });

    let student = res.student;
    mergeStudentIntoState(res.student, res.parent);

    if (opts?.photo) {
      const photoRes = await applyStudentPhoto(res.student.id, opts.photo);
      if (!photoRes.ok) {
        await refreshStudents();
        return {
          ok: true,
          student: res.student,
          parentCreated: res.parentCreated,
          parentCode: res.parentCode,
          initialParentPassword: res.initialParentPassword,
          warning: photoRes.error,
        };
      }
      if (photoRes.student) {
        student = photoRes.student;
        mergeStudentIntoState(photoRes.student, res.parent);
      }
    }

    const refreshed = opts?.skipRefresh ? true : await refreshStudents();
    if (!refreshed) {
      mergeStudentIntoState(student, res.parent);
    }
    return {
      ok: true,
      student,
      parentCreated: res.parentCreated,
      parentCode: res.parentCode,
      initialParentPassword: res.initialParentPassword,
    };
  } catch (e) {
    return { ok: false, error: apiErr(e, "Failed to register student.") };
  }
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

export async function updateStudent(
  id: string,
  patch: StudentPatch,
  photo?: StudentPhotoChange,
): Promise<RegisterResult> {
  if (patch.className !== undefined || patch.section !== undefined) {
    await ensureAcademicsLoaded();
  }
  const st = ensure();
  const existing = st.students.find((s) => s.id === id);
  if (!existing) return { ok: false, error: "Student not found." };

  let classId: string | undefined;
  let sectionId: string | null | undefined;
  if (patch.className !== undefined) {
    const year = patch.academicYear ?? existing.academicYear;
    const r = resolveClassId(patch.className, year);
    if (!r.classId) return { ok: false, error: r.error };
    classId = r.classId;
    const sec = resolveSectionId(classId, patch.section ?? existing.section);
    if (sec.error) return { ok: false, error: sec.error };
    sectionId = sec.sectionId;
  } else if (patch.section !== undefined) {
    const r = resolveClassId(existing.className, existing.academicYear);
    if (r.classId) {
      const sec = resolveSectionId(r.classId, patch.section);
      if (sec.error) return { ok: false, error: sec.error };
      sectionId = sec.sectionId;
    }
  }

  try {
    if (patch.parentName !== undefined || patch.parentPhone !== undefined) {
      await apiUpdateParent(existing.parentId, {
        name: patch.parentName?.trim(),
        phone: patch.parentPhone?.trim(),
      });
    }
    const updated = await apiUpdateStudent(id, {
      fullName: patch.fullName?.trim(),
      gender: patch.gender,
      dob: patch.dob !== undefined ? patch.dob : undefined,
      phone: patch.phone !== undefined ? patch.phone?.trim() || null : undefined,
      notes: patch.notes !== undefined ? patch.notes?.trim() || null : undefined,
      classId,
      sectionId,
      monthlyFee: patch.monthlyFee,
      status: patch.status,
    });

    let student = updated;
    if (photo) {
      const photoRes = await applyStudentPhoto(id, photo);
      if (!photoRes.ok) {
        await refreshStudents();
        return { ok: true, student: updated, warning: photoRes.error };
      }
      if (photoRes.student) {
        student = photoRes.student;
        mergeStudentIntoState(photoRes.student);
      }
    }

    const refreshed = await refreshStudents();
    if (!refreshed) mergeStudentIntoState(student);
    return { ok: true, student };
  } catch (e) {
    return { ok: false, error: apiErr(e, "Failed to update student.") };
  }
}

export interface DeleteResult {
  ok: boolean;
  parentDeleted: boolean;
  error?: string;
}

export async function deleteStudent(id: string): Promise<DeleteResult> {
  const st = ensure();
  if (!st.students.some((s) => s.id === id)) {
    return { ok: false, parentDeleted: false, error: "Student not found." };
  }
  try {
    const res = await apiDeleteStudent(id);
    await refreshStudents();
    return { ok: true, parentDeleted: res.parentDeleted };
  } catch (e) {
    return { ok: false, parentDeleted: false, error: apiErr(e, "Failed to delete student.") };
  }
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
  [key: string]: string | undefined;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  failed: number;
  errors: { row: number; message: string }[];
}

export interface ImportPreviewRow {
  row: number;
  data: ImportRow;
  status: "valid" | "duplicate" | "invalid";
  message?: string;
}

function importRowKey(row: ImportRow): string {
  return [
    norm(row.parentPhone ?? ""),
    norm(row.fullName ?? ""),
    norm(row.className ?? ""),
    norm(row.section ?? ""),
  ].join("|");
}

function validateImportRow(
  row: ImportRow,
  line: number,
  academicYear: string,
  seenInFile: Set<string>,
): ImportPreviewRow {
  const fullName = row.fullName?.trim();
  const genderRaw = row.gender?.trim().toUpperCase();
  const parentName = row.parentName?.trim();
  const parentPhone = row.parentPhone?.trim();
  const className = row.className?.trim();
  const section = row.section?.trim() || null;
  const feeRaw = row.monthlyFee?.trim();

  if (!fullName || !parentName || !parentPhone || !className) {
    return {
      row: line,
      data: row,
      status: "invalid",
      message: "Missing required field(s).",
    };
  }
  if (genderRaw !== "MALE" && genderRaw !== "FEMALE") {
    return {
      row: line,
      data: row,
      status: "invalid",
      message: `Invalid gender "${row.gender}". Use MALE or FEMALE.`,
    };
  }
  if (!isValidPhone(parentPhone)) {
    return {
      row: line,
      data: row,
      status: "invalid",
      message: "Invalid parent phone (at least 6 digits).",
    };
  }
  const monthlyFee = Number(feeRaw);
  if (!feeRaw || Number.isNaN(monthlyFee) || monthlyFee < 0) {
    return {
      row: line,
      data: row,
      status: "invalid",
      message: "Invalid or missing monthly fee.",
    };
  }

  const key = importRowKey(row);
  if (seenInFile.has(key)) {
    return {
      row: line,
      data: row,
      status: "duplicate",
      message: "Duplicate row in file.",
    };
  }
  seenInFile.add(key);

  const { classId, error: classErr } = resolveClassId(className, academicYear);
  if (!classId) {
    return { row: line, data: row, status: "invalid", message: classErr };
  }
  const sec = resolveSectionId(classId, section);
  if (sec.error) {
    return { row: line, data: row, status: "invalid", message: sec.error };
  }

  const st = ensure();
  if (isDuplicate(st, parentPhone, fullName, className, section)) {
    return {
      row: line,
      data: row,
      status: "duplicate",
      message: "Student already exists in this class/section.",
    };
  }

  return { row: line, data: row, status: "valid" };
}

export async function previewImport(
  rows: ImportRow[],
  academicYear: string,
): Promise<ImportPreviewRow[]> {
  await ensureAcademicsLoaded();
  const seenInFile = new Set<string>();
  return rows.map((row, i) =>
    validateImportRow(row, i + 2, academicYear, seenInFile),
  );
}

export async function bulkImport(
  rows: ImportRow[],
  academicYear: string,
): Promise<ImportResult> {
  await ensureAcademicsLoaded();
  const result: ImportResult = { imported: 0, skipped: 0, failed: 0, errors: [] };
  const seenInFile = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const line = i + 2;
    const preview = validateImportRow(row, line, academicYear, seenInFile);

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

    const fullName = row.fullName!.trim();
    const genderRaw = row.gender!.trim().toUpperCase() as Gender;
    const parentName = row.parentName!.trim();
    const parentPhone = row.parentPhone!.trim();
    const className = row.className!.trim();
    const section = row.section?.trim() || null;
    const monthlyFee = Number(row.monthlyFee!.trim());

    const res = await registerStudent(
      {
        fullName,
        gender: genderRaw,
        parentName,
        parentPhone,
        className,
        section,
        monthlyFee,
        academicYear,
        status: "ACTIVE",
      },
      { skipRefresh: true },
    );
    if (res.ok) result.imported++;
    else if (isDuplicateError(res.error)) {
      result.skipped++;
      result.errors.push({ row: line, message: res.error ?? "Duplicate." });
    } else {
      result.failed++;
      result.errors.push({ row: line, message: res.error ?? "Failed." });
    }
  }

  if (result.imported > 0) await refreshStudents();
  return result;
}

// ---------------------------------------------------------------------------
// Parents
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
  return st.parents.map((p) => ({ ...p, childCount: counts.get(p.id) ?? 0 }));
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

export async function updateParent(
  id: string,
  patch: ParentPatch,
): Promise<{ ok: boolean; error?: string; parent?: Parent }> {
  const st = ensure();
  if (!st.parents.some((p) => p.id === id)) {
    return { ok: false, error: "Parent not found." };
  }
  try {
    const parent = await apiUpdateParent(id, {
      name: patch.name?.trim(),
      phone: patch.phone?.trim(),
      altPhone: patch.altPhone !== undefined ? patch.altPhone?.trim() || null : undefined,
      email: patch.email !== undefined ? patch.email?.trim() || null : undefined,
      address: patch.address !== undefined ? patch.address?.trim() || null : undefined,
      occupation:
        patch.occupation !== undefined ? patch.occupation?.trim() || null : undefined,
      status: patch.status,
    });
    await refreshStudents();
    return { ok: true, parent };
  } catch (e) {
    return { ok: false, error: apiErr(e, "Failed to update parent.") };
  }
}

export async function setParentStatus(id: string, status: ParentStatus) {
  return updateParent(id, { status });
}

/**
 * Reset the parent's portal password on the SERVER (persisted) and return the
 * new one-time password to show the admin. Previously this only mutated local
 * state, so the parent could never actually log in with the shown password.
 */
export async function resetParentPassword(
  id: string,
): Promise<{ ok: boolean; password?: string; error?: string }> {
  const st = ensure();
  if (!st.parents.some((p) => p.id === id)) {
    return { ok: false, error: "Parent not found." };
  }
  try {
    const { password } = await apiResetParentPassword(id);
    setState({
      ...st,
      parents: st.parents.map((p) => (p.id === id ? { ...p, password } : p)),
    });
    return { ok: true, password };
  } catch (e) {
    return { ok: false, error: apiErr(e, "Failed to reset password.") };
  }
}

export function changeParentPassword(
  id: string,
  _current: string,
  next: string,
): { ok: boolean; error?: string } {
  const st = ensure();
  if (!st.parents.some((p) => p.id === id)) {
    return { ok: false, error: "Parent not found." };
  }
  if (next.length < 6) {
    return { ok: false, error: "New password must be at least 6 characters." };
  }
  setState({
    ...st,
    parents: st.parents.map((p) => (p.id === id ? { ...p, password: next } : p)),
  });
  return { ok: true };
}

export function resetStudents() {
  void refreshStudents();
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

export function useStudentsState(): StudentsState {
  return useSyncExternalStore(subscribe, getState, () => EMPTY);
}

export function useStudentsRefresh(): { loading: boolean; failed: boolean } {
  return useSyncExternalStore(
    subscribe,
    getRefreshSnapshot,
    () => ({ loading: false, failed: false }),
  );
}

export type { Gender, Parent, Student, StudentStatus, StudentWithParent };
