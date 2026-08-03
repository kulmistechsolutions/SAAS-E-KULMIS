"use client";

import { api, getAccessToken } from "@/lib/api";
import { readStudentPhotoFile } from "@/lib/media/image";
import type { Gender, Parent, Student, StudentStatus } from "./types";

interface ApiParent {
  id: string;
  code: string;
  name: string;
  phone: string;
  altPhone: string | null;
  email: string | null;
  address: string | null;
  occupation: string | null;
  status: "ACTIVE" | "INACTIVE";
  createdAt: string;
}

interface ApiStudent {
  id: string;
  code: string;
  fullName: string;
  gender: Gender;
  dob: string | null;
  phone: string | null;
  notes: string | null;
  placeOfBirth?: string | null;
  district?: string | null;
  motherName?: string | null;
  monthlyFee: number;
  status: StudentStatus;
  registrationDate: string;
  parentId: string;
  classId: string;
  sectionId: string | null;
  photoKey?: string | null;
  hasPhoto?: boolean;
  parent: ApiParent;
  class: { id: string; name: string; academicYear: { name: string } | null };
  section: { id: string; name: string } | null;
  village: { id: string; name: string } | null;
  photoUrl?: string | null;
  feeStartMode?: "FULL_CURRENT" | "AGREEMENT" | "NEXT_MONTH" | null;
  feeAgreementAmount?: number | null;
  annualFeeAmount?: number | null;
  feeWaived?: boolean;
}

export function mapApiParent(p: ApiParent): Parent {
  return {
    id: p.id,
    code: p.code,
    name: p.name,
    phone: p.phone,
    altPhone: p.altPhone,
    email: p.email,
    address: p.address,
    occupation: p.occupation,
    registrationDate: p.createdAt,
    status: p.status,
    username: p.code,
    password: "",
  };
}

export function mapApiStudent(s: ApiStudent): Student {
  return {
    id: s.id,
    code: s.code,
    fullName: s.fullName,
    gender: s.gender,
    dob: s.dob ? s.dob.slice(0, 10) : null,
    phone: s.phone,
    parentId: s.parentId,
    className: s.class?.name ?? "",
    section: s.section?.name ?? null,
    village: s.village?.name ?? null,
    monthlyFee: s.monthlyFee,
    academicYear: s.class?.academicYear?.name ?? "",
    registrationDate: s.registrationDate,
    status: s.status,
    notes: s.notes,
    placeOfBirth: s.placeOfBirth ?? null,
    district: s.district ?? null,
    motherName: s.motherName ?? null,
    hasPhoto: s.hasPhoto ?? !!(s.photoKey || s.photoUrl),
    photoUrl: s.photoUrl ?? null,
    feeStartMode: s.feeStartMode ?? null,
    feeAgreementAmount: s.feeAgreementAmount ?? null,
    annualFeeAmount: s.annualFeeAmount ?? null,
    feeWaived: s.feeWaived ?? false,
  };
}

export async function apiListStudents(): Promise<Student[]> {
  const rows = await api<ApiStudent[]>("/students?lite=1");
  return rows.map(mapApiStudent);
}

/**
 * Fetch students together with the parents embedded in each student row,
 * de-duplicated. Lets roles that may read students but NOT the full parents
 * directory (e.g. FINANCE_OFFICER during fee collection) still resolve each
 * student's guardian without a separate `/parents` call.
 */
export async function apiListStudentsWithParents(): Promise<{
  students: Student[];
  parents: Parent[];
}> {
  const rows = await api<ApiStudent[]>("/students?lite=1");
  const parentsById = new Map<string, Parent>();
  for (const r of rows) {
    if (r.parent && !parentsById.has(r.parent.id)) {
      parentsById.set(r.parent.id, mapApiParent(r.parent));
    }
  }
  return {
    students: rows.map(mapApiStudent),
    parents: [...parentsById.values()],
  };
}

export async function apiGetStudent(id: string): Promise<{
  student: Student;
  parent: Parent;
}> {
  const row = await api<ApiStudent>(`/students/${id}`);
  return {
    student: mapApiStudent(row),
    parent: mapApiParent(row.parent),
  };
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const TENANT = process.env.NEXT_PUBLIC_TENANT_SUBDOMAIN ?? "demo";

export async function apiFetchStudentPhotoBlob(
  studentId: string,
): Promise<Blob> {
  const token = getAccessToken();
  const headers: Record<string, string> = {
    "x-tenant-subdomain": TENANT,
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}/api/students/${studentId}/photo`, {
    headers,
  });
  if (!res.ok) {
    throw new Error(
      res.status === 404 ? "Photo not found" : "Failed to load photo",
    );
  }
  return res.blob();
}

/** Students carry their parent; derive a de-duplicated parent list from them. */
export async function apiListParents(): Promise<Parent[]> {
  const rows = await api<ApiParent[]>("/parents");
  return rows.map(mapApiParent);
}

export interface RegisterStudentApiInput {
  fullName: string;
  gender: Gender;
  dob?: string | null;
  phone?: string | null;
  notes?: string | null;
  placeOfBirth?: string | null;
  district?: string | null;
  motherName?: string | null;
  parentName: string;
  parentPhone: string;
  classId: string;
  sectionId?: string | null;
  villageId?: string | null;
  monthlyFee: number;
  feeStartMode?: "FULL_CURRENT" | "AGREEMENT" | "NEXT_MONTH";
  agreementAmount?: number;
  feeWaived?: boolean;
  chargeRegistrationFee?: boolean;
}

export async function apiRegisterStudent(
  input: RegisterStudentApiInput,
): Promise<{
  student: Student;
  parent: Parent;
  parentCreated: boolean;
  parentCode?: string;
  initialParentPassword?: string;
}> {
  const res = await api<{
    student: ApiStudent;
    parentCreated: boolean;
    initialParentPassword?: string;
  }>("/students", { method: "POST", body: input });
  return {
    student: mapApiStudent(res.student),
    parent: mapApiParent(res.student.parent),
    parentCreated: res.parentCreated,
    parentCode: res.student.parent?.code,
    initialParentPassword: res.initialParentPassword,
  };
}

export async function apiUploadStudentPhoto(
  id: string,
  file: File,
): Promise<Student> {
  const { base64, mimeType } = await readStudentPhotoFile(file);
  const row = await api<ApiStudent>(`/students/${id}/photo`, {
    method: "POST",
    body: { file: base64, mimeType },
  });
  return mapApiStudent(row);
}

export async function apiDeleteStudentPhoto(id: string): Promise<Student> {
  const row = await api<ApiStudent>(`/students/${id}/photo`, {
    method: "DELETE",
  });
  return mapApiStudent(row);
}

export interface UpdateStudentApiInput {
  fullName?: string;
  gender?: Gender;
  dob?: string | null;
  phone?: string | null;
  notes?: string | null;
  placeOfBirth?: string | null;
  district?: string | null;
  motherName?: string | null;
  classId?: string;
  sectionId?: string | null;
  villageId?: string | null;
  monthlyFee?: number;
  feeWaived?: boolean;
  status?: StudentStatus;
  /** Re-links the student to the parent on this phone — see the API schema. */
  parentName?: string;
  parentPhone?: string;
}

export interface UpdateStudentResult {
  student: Student;
  /** A parent record was created for this child by the edit. */
  parentCreated: boolean;
  parentCode?: string;
  initialParentPassword?: string;
  /** The family they left had no other children and was cleared. */
  formerParentRemoved: boolean;
  /** Set only when the child changed families. */
  movedToParentName?: string;
}

export async function apiUpdateStudent(
  id: string,
  patch: UpdateStudentApiInput,
): Promise<UpdateStudentResult> {
  const res = await api<{
    student: ApiStudent;
    parentCreated: boolean;
    parentCode?: string;
    initialParentPassword?: string;
    formerParentRemoved: boolean;
    movedToParentName?: string;
  }>(`/students/${id}`, { method: "PATCH", body: patch });
  return { ...res, student: mapApiStudent(res.student) };
}

export async function apiDeleteStudent(
  id: string,
): Promise<{ parentDeleted: boolean }> {
  return api<{ success: boolean; parentDeleted: boolean }>(`/students/${id}`, {
    method: "DELETE",
  });
}

/** Delete several students at once (multi-select). IDs are not reused. */
export async function apiBulkDeleteStudents(
  ids: string[],
): Promise<{ deletedCount: number; parentsDeleted: number }> {
  return api<{
    success: boolean;
    deletedCount: number;
    parentsDeleted: number;
  }>("/students/bulk-delete", { method: "POST", body: { ids } });
}

// ── Danger Zone: deliberate resets (admin only) ────────────────────────────

export interface ApiSchoolResetPreview {
  scope: "school";
  name: string;
  counts: { students: number; parents: number };
}

export interface ApiClassResetPreview {
  scope: "class";
  name: string;
  academicYear: string;
  counts: { students: number; parents: number; parentsKept: number };
}

export const apiSchoolResetPreview = () =>
  api<ApiSchoolResetPreview>("/admin/reset/school/preview");

export const apiClassResetPreview = (classId: string) =>
  api<ApiClassResetPreview>(`/admin/reset/class/${classId}/preview`);

export interface ApiTeacherResetPreview {
  scope: "teachers";
  name: string;
  counts: {
    teachers: number;
    assignments: number;
    attendance: number;
    quizzes: number;
    timetableEntries: number;
  };
}

export const apiTeacherResetPreview = () =>
  api<ApiTeacherResetPreview>("/admin/reset/teachers/preview");

/** Erase every teacher in the school and restart teacher numbering at 1. */
export const apiResetTeachers = (confirmName: string) =>
  api<{ success: true; name: string; teachersDeleted: number }>(
    "/admin/reset/teachers",
    { method: "POST", body: { confirmName } },
  );

/** Erase every student in the school and restart numbering at 1. */
export const apiResetSchool = (confirmName: string) =>
  api<{ success: true; name: string; studentsDeleted: number }>(
    "/admin/reset/school",
    { method: "POST", body: { confirmName } },
  );

/** Erase every student in one class; the class itself is kept. */
export const apiResetClass = (classId: string, confirmName: string) =>
  api<{ success: true; name: string; studentsDeleted: number }>(
    `/admin/reset/class/${classId}`,
    { method: "POST", body: { confirmName } },
  );

export interface ApiFeeResetPreview {
  scope: "fees";
  name: string;
  counts: {
    charges: number;
    payments: number;
    monthlyActivations: number;
    yearlySetups: number;
    extraFees: number;
  };
}

export const apiFeeResetPreview = () =>
  api<ApiFeeResetPreview>("/admin/reset/fees/preview");

/** Erase every fee charge, payment, and billing activation; students and classes are kept. */
export const apiResetFees = (confirmName: string) =>
  api<{ success: true; name: string; chargesDeleted: number; paymentsDeleted: number }>(
    "/admin/reset/fees",
    { method: "POST", body: { confirmName } },
  );

export interface ApiActivatedMonth {
  year: number;
  month: number;
  classesActivated: number;
  chargesCount: number;
  totalCharged: number;
  totalPaid: number;
  hasPayments: boolean;
}

export const apiListActivatedMonths = () =>
  api<ApiActivatedMonth[]>("/admin/reset/months");

/** Undo one month's activation — blocked once any payment has landed against it. */
export const apiDeleteMonth = (
  year: number,
  month: number,
  confirmName: string,
) =>
  api<{
    success: true;
    year: number;
    month: number;
    name: string;
    chargesDeleted: number;
    activationsDeleted: number;
  }>(`/admin/reset/months/${year}/${month}`, {
    method: "POST",
    body: { confirmName },
  });

export interface UpdateParentApiInput {
  name?: string;
  phone?: string;
  altPhone?: string | null;
  email?: string | null;
  address?: string | null;
  occupation?: string | null;
  status?: "ACTIVE" | "INACTIVE";
}

export async function apiUpdateParent(
  id: string,
  patch: UpdateParentApiInput,
): Promise<Parent> {
  const row = await api<ApiParent>(`/parents/${id}`, {
    method: "PATCH",
    body: patch,
  });
  return mapApiParent(row);
}

/**
 * Reset the parent's portal password on the server; returns the new one once.
 * With no argument it resets to the default 12345; pass a string to set a
 * specific password the admin chose.
 */
export async function apiResetParentPassword(
  id: string,
  password?: string,
): Promise<{ password: string }> {
  return api<{ password: string }>(`/parents/${id}/reset-password`, {
    method: "POST",
    body: password ? { password } : undefined,
  });
}

export interface ApiAttendanceSummary {
  present: number;
  absent: number;
  late: number;
  percentage: number;
  rows: { date: string; status: "PRESENT" | "ABSENT" | "LATE" }[];
}

export async function apiStudentAttendance(
  studentId: string,
  limit = 60,
): Promise<ApiAttendanceSummary> {
  return api<ApiAttendanceSummary>(
    `/students/${studentId}/attendance?limit=${limit}`,
  );
}
