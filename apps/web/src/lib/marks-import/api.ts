"use client";

import { api, API_URL, ApiError, getAccessToken, TENANT } from "@/lib/api";

export interface ImportableExam {
  id: string;
  name: string;
  term: string;
  maxMarks: number;
  status: string;
  examGroup: { id: string; name: string } | null;
  class: { id: string; name: string };
  section: { id: string; name: string } | null;
  _count: { subjects: number };
}

export interface ImportIssue {
  sheet: string;
  row: number | null;
  studentCode: string | null;
  message: string;
}

export interface SheetPreview {
  sheet: string;
  examId: string;
  className: string;
  students: number;
  marks: number;
  blanks: number;
  issues: ImportIssue[];
}

export interface ImportPreview {
  ok: boolean;
  sheets: SheetPreview[];
  issues: ImportIssue[];
  totalMarks: number;
}

export const fetchImportableExams = (academicYearId: string) =>
  api<ImportableExam[]>(
    `/marks-import/exams?academicYearId=${encodeURIComponent(academicYearId)}`,
  );

/**
 * Download the template. An authenticated fetch rather than a link, because the
 * endpoint needs a bearer token an anchor cannot send.
 */
export async function downloadMarksTemplate(examIds: string[], filename: string) {
  const token = getAccessToken();
  const res = await fetch(`${API_URL}/api/marks-import/template`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-tenant-subdomain": TENANT,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ examIds }),
  });
  if (!res.ok) throw new ApiError(res.status, "Could not build the template.");
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Strips the data: prefix the FileReader adds. */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.readAsDataURL(file);
  });
}

export const validateMarksFile = (examIds: string[], file: string) =>
  api<ImportPreview>("/marks-import/validate", {
    method: "POST",
    body: { examIds, file },
  });

export const commitMarksFile = (examIds: string[], file: string) =>
  api<{ imported: number; sheets: SheetPreview[] }>("/marks-import/commit", {
    method: "POST",
    body: { examIds, file },
  });
