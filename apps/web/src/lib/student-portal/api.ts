"use client";

import { API_URL, ApiError, TENANT } from "@/lib/api";
import type { StudentExamResult } from "@/lib/examinations/types";

/**
 * The student portal is a separate, password-based session from staff auth —
 * a distinct token key so a student logging in here never touches (or gets
 * clobbered by) an admin's own session in the same browser. Mirrors
 * lib/library-portal/api.ts.
 */
const TOKEN_KEY = "ekulmis_student_portal_token";

export function getStudentPortalToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setStudentPortalToken(token: string | null): void {
  if (typeof window === "undefined") return;
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
}

async function studentApi<T>(
  path: string,
  opts: { method?: "GET" | "POST"; body?: unknown } = {},
): Promise<T> {
  const token = getStudentPortalToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-tenant-subdomain": TENANT,
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}/api${path}`, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  if (!res.ok) {
    let message = res.statusText;
    try {
      const data = (await res.json()) as { message?: string | string[] };
      if (data.message) {
        message = Array.isArray(data.message) ? data.message.join(", ") : data.message;
      }
    } catch {
      // keep statusText
    }
    if (res.status === 401) setStudentPortalToken(null);
    throw new ApiError(res.status, message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export interface StudentPortalStudent {
  id: string;
  code: string;
  fullName: string;
  className: string;
}

export interface StudentPortalMe {
  id: string;
  code: string;
  fullName: string;
  gender: string;
  phone: string | null;
  status: string;
  monthlyFee: number;
  feeWaived: boolean;
  registrationDate: string;
  class: { id: string; name: string };
  section: { id: string; name: string } | null;
  parent: { name: string; phone: string };
}

export async function apiStudentPortalLogin(studentCode: string, password: string) {
  const res = await studentApi<{
    accessToken: string;
    student: StudentPortalStudent;
  }>("/student-portal/login", { method: "POST", body: { studentCode, password } });
  setStudentPortalToken(res.accessToken);
  return res.student;
}

export function studentPortalLogout(): void {
  setStudentPortalToken(null);
}

export const apiStudentPortalMe = () => studentApi<StudentPortalMe>("/student-portal/me");

export interface StudentPortalAttendanceRow {
  id: string;
  date: string;
  status: string;
  shift: { name: string } | null;
}

export const apiStudentPortalAttendance = () =>
  studentApi<StudentPortalAttendanceRow[]>("/student-portal/attendance");

export const apiStudentPortalFees = () => studentApi<unknown>("/student-portal/fees");

export interface StudentPortalResults {
  studentId: string;
  studentCode: string;
  studentName: string;
  className: string;
  section: string | null;
  academicYearId: string;
  termResults: StudentExamResult[];
  finalAverage: number;
  finalGrade: string;
  passed: boolean;
}

export const apiStudentPortalResults = () =>
  studentApi<StudentPortalResults>("/student-portal/results");

export const apiStudentPortalTimetable = () =>
  studentApi<unknown[]>("/student-portal/timetable");
