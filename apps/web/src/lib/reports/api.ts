"use client";

import { api, getAccessToken } from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const TENANT = process.env.NEXT_PUBLIC_TENANT_SUBDOMAIN ?? "demo";

export async function apiStudentListReport(classId?: string) {
  const q = classId ? `?classId=${encodeURIComponent(classId)}` : "";
  return api<Record<string, string | number>[]>(`/reports/students${q}`);
}

export async function apiAttendanceReport(date: string, classId?: string) {
  const params = new URLSearchParams({ date });
  if (classId) params.set("classId", classId);
  return api<Record<string, unknown>[]>(`/reports/attendance?${params.toString()}`);
}

export async function apiExamResultsReport(studentId: string) {
  return api<unknown>(`/reports/exam-results/${studentId}`);
}

async function downloadExport(path: string, filename: string) {
  const token = getAccessToken();
  const res = await fetch(`${API_URL}/api${path}`, {
    headers: {
      Authorization: token ? `Bearer ${token}` : "",
      "x-tenant-subdomain": TENANT,
    },
  });
  if (!res.ok) throw new Error("Export failed");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadStudentsPdf(classId?: string) {
  const q = classId ? `?classId=${encodeURIComponent(classId)}` : "";
  return downloadExport(`/reports/students/export/pdf${q}`, "students.pdf");
}

export function downloadStudentsExcel(classId?: string) {
  const q = classId ? `?classId=${encodeURIComponent(classId)}` : "";
  return downloadExport(`/reports/students/export/excel${q}`, "students.xlsx");
}
