"use client";

import { api } from "@/lib/api";
import type {
  AssignmentShift,
  EmploymentStatus,
  Gender,
  Shift,
  Teacher,
  TeacherAssignment,
} from "./types";

export interface ApiTeacher {
  id: string;
  code: string;
  fullName: string;
  gender: Gender;
  phone: string | null;
  email: string | null;
  address: string | null;
  qualification: string | null;
  salary: number;
  shift: Shift;
  status: EmploymentStatus;
  canViewStudents?: boolean;
  registrationDate: string;
}

interface ApiAssignment {
  id: string;
  teacherId: string;
  academicYear: { name: string };
  class: { name: string };
  section: { name: string } | null;
  subject: { name: string };
  shift: AssignmentShift | null;
}

export function mapApiTeacher(t: ApiTeacher): Teacher {
  return {
    id: t.id,
    code: t.code,
    fullName: t.fullName,
    gender: t.gender,
    phone: t.phone ?? "",
    email: t.email,
    address: t.address,
    qualification: t.qualification,
    salary: t.salary,
    shift: t.shift,
    status: t.status,
    canViewStudents: t.canViewStudents ?? false,
    registrationDate: t.registrationDate,
    username: t.code,
    password: "",
  };
}

export function mapApiAssignment(a: ApiAssignment): TeacherAssignment {
  return {
    id: a.id,
    teacherId: a.teacherId,
    academicYear: a.academicYear.name,
    className: a.class.name,
    section: a.section?.name ?? null,
    subject: a.subject.name,
    status: "ACTIVE",
    shift: a.shift,
  };
}

export async function apiListTeachers(): Promise<Teacher[]> {
  const rows = await api<ApiTeacher[]>("/teachers");
  return rows.map(mapApiTeacher);
}

export async function apiListAssignments(): Promise<TeacherAssignment[]> {
  const rows = await api<ApiAssignment[]>("/teacher-assignments");
  return rows.map(mapApiAssignment);
}

export async function apiRegisterTeacher(input: {
  fullName: string;
  gender: Gender;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  qualification?: string | null;
  salary?: number;
  shift: Shift;
  password?: string;
}): Promise<{ teacher: Teacher; initialPassword: string }> {
  const res = await api<{ teacher: ApiTeacher; initialPassword: string }>(
    "/teachers",
    { method: "POST", body: input },
  );
  return {
    teacher: mapApiTeacher(res.teacher),
    initialPassword: res.initialPassword,
  };
}

export async function apiUpdateTeacher(
  id: string,
  patch: {
    fullName?: string;
    gender?: Gender;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    qualification?: string | null;
    salary?: number;
    shift?: Shift;
    status?: EmploymentStatus;
    canViewStudents?: boolean;
  },
): Promise<Teacher> {
  const row = await api<ApiTeacher>(`/teachers/${id}`, {
    method: "PATCH",
    body: patch,
  });
  return mapApiTeacher(row);
}

export async function apiDeleteTeacher(id: string): Promise<void> {
  await api(`/teachers/${id}`, { method: "DELETE" });
}

export async function apiCreateAssignment(body: {
  teacherId: string;
  academicYearId: string;
  classId: string;
  sectionId?: string | null;
  subjectId: string;
  shift?: AssignmentShift | null;
}): Promise<TeacherAssignment> {
  const row = await api<ApiAssignment>("/teacher-assignments", {
    method: "POST",
    body,
  });
  return mapApiAssignment(row);
}

export async function apiBulkCreateAssignments(body: {
  teacherId: string;
  academicYearId: string;
  items: {
    classId: string;
    sectionId?: string | null;
    subjectId: string;
    shift?: AssignmentShift | null;
  }[];
}): Promise<{
  created: TeacherAssignment[];
  createdCount: number;
  skippedCount: number;
  requestedCount: number;
}> {
  const res = await api<{
    created: ApiAssignment[];
    createdCount: number;
    skippedCount: number;
    requestedCount: number;
  }>("/teacher-assignments/bulk", { method: "POST", body });
  return {
    created: res.created.map(mapApiAssignment),
    createdCount: res.createdCount,
    skippedCount: res.skippedCount,
    requestedCount: res.requestedCount,
  };
}

export async function apiDeleteAssignment(id: string): Promise<void> {
  await api(`/teacher-assignments/${id}`, { method: "DELETE" });
}

/** Full teacher profile returned by GET /teachers/me (includes assignments). */
export interface TeacherMeAssignment {
  id: string;
  academicYearId: string;
  classId: string;
  sectionId: string | null;
  subjectId: string;
  academicYear: { id: string; name: string };
  class: { id: string; name: string };
  section: { id: string; name: string } | null;
  subject: { id: string; name: string };
}

export interface TeacherMe extends ApiTeacher {
  canViewStudents: boolean;
  assignments: TeacherMeAssignment[];
}

export async function apiGetTeacherMe(): Promise<TeacherMe> {
  return api<TeacherMe>("/teachers/me");
}

export async function apiUpdateTeacherMe(patch: {
  phone?: string | null;
  email?: string | null;
  address?: string | null;
}): Promise<TeacherMe> {
  return api<TeacherMe>("/teachers/me", { method: "PATCH", body: patch });
}

export async function apiGetMyStudents(): Promise<unknown[]> {
  return api("/teachers/me/students");
}

export async function apiChangePassword(body: {
  currentPassword: string;
  newPassword: string;
}): Promise<void> {
  await api("/auth/change-password", { method: "POST", body });
}
