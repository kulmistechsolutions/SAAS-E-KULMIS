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
  photoUrl?: string | null;
  feeStartMode?: "FULL_CURRENT" | "AGREEMENT" | "NEXT_MONTH" | null;
  feeAgreementAmount?: number | null;
  annualFeeAmount?: number | null;
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
    monthlyFee: s.monthlyFee,
    academicYear: s.class?.academicYear?.name ?? "",
    registrationDate: s.registrationDate,
    status: s.status,
    notes: s.notes,
    hasPhoto: s.hasPhoto ?? !!(s.photoKey || s.photoUrl),
    photoUrl: s.photoUrl ?? null,
    feeStartMode: s.feeStartMode ?? null,
    feeAgreementAmount: s.feeAgreementAmount ?? null,
    annualFeeAmount: s.annualFeeAmount ?? null,
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
  parentName: string;
  parentPhone: string;
  classId: string;
  sectionId?: string | null;
  monthlyFee: number;
  feeStartMode?: "FULL_CURRENT" | "AGREEMENT" | "NEXT_MONTH";
  agreementAmount?: number;
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
  classId?: string;
  sectionId?: string | null;
  monthlyFee?: number;
  status?: StudentStatus;
}

export async function apiUpdateStudent(
  id: string,
  patch: UpdateStudentApiInput,
): Promise<Student> {
  const row = await api<ApiStudent>(`/students/${id}`, {
    method: "PATCH",
    body: patch,
  });
  return mapApiStudent(row);
}

export async function apiDeleteStudent(
  id: string,
): Promise<{ parentDeleted: boolean }> {
  return api<{ success: boolean; parentDeleted: boolean }>(`/students/${id}`, {
    method: "DELETE",
  });
}

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
