"use client";

import { api } from "@/lib/api";
import type {
  StudentCaseDashboard,
  StudentCaseRecord,
  StudentOwnCase,
} from "./types";

export interface CreateStudentCaseBody {
  studentId: string;
  classId: string;
  sectionId?: string | null;
  title: string;
  note?: string | null;
  date: string;
}

export async function apiCreateStudentCase(
  body: CreateStudentCaseBody,
): Promise<StudentCaseRecord> {
  return api("/student-cases", { method: "POST", body });
}

export async function apiListStudentCases(opts: {
  classId?: string;
  sectionId?: string;
  dateFrom?: string;
  dateTo?: string;
}): Promise<StudentCaseRecord[]> {
  const params = new URLSearchParams();
  if (opts.classId) params.set("classId", opts.classId);
  if (opts.sectionId) params.set("sectionId", opts.sectionId);
  if (opts.dateFrom) params.set("dateFrom", opts.dateFrom);
  if (opts.dateTo) params.set("dateTo", opts.dateTo);
  const qs = params.toString();
  return api<StudentCaseRecord[]>(`/student-cases${qs ? `?${qs}` : ""}`);
}

export async function apiStudentCasesDashboard(): Promise<StudentCaseDashboard> {
  return api<StudentCaseDashboard>("/student-cases/dashboard");
}

export async function apiStudentCasesForStudent(
  studentId: string,
): Promise<StudentOwnCase[]> {
  return api<StudentOwnCase[]>(`/student-cases/student/${studentId}`);
}

export async function apiParentChildCases(
  studentId: string,
): Promise<StudentOwnCase[]> {
  return api<StudentOwnCase[]>(`/parent-portal/children/${studentId}/cases`);
}
