"use client";

import { api, API_URL, ApiError, getAccessToken, TENANT } from "@/lib/api";

export interface Book {
  id: string;
  title: string;
  author: string | null;
  isbn: string | null;
  category: string | null;
  totalCopies: number;
  availableCopies: number;
  status: "ACTIVE" | "INACTIVE";
  createdAt: string;
}

export interface BookLoan {
  id: string;
  bookId: string;
  studentId: string;
  issuedAt: string;
  dueDate: string;
  returnedAt: string | null;
  status: "ISSUED" | "RETURNED" | "OVERDUE";
  book: { id: string; title: string; author: string | null };
  student: { id: string; code: string; fullName: string };
}

export interface LibraryDashboard {
  totalTitles: number;
  totalCopies: number;
  issued: number;
  overdue: number;
}

export const apiLibraryDashboard = () =>
  api<LibraryDashboard>("/library/dashboard");

export const apiListBooks = (q?: string) =>
  api<Book[]>(`/library/books${q ? `?q=${encodeURIComponent(q)}` : ""}`);

export const apiCreateBook = (body: {
  title: string;
  author?: string | null;
  isbn?: string | null;
  category?: string | null;
  totalCopies: number;
}) => api<Book>("/library/books", { method: "POST", body });

export const apiUpdateBook = (
  id: string,
  body: Partial<{
    title: string;
    author: string | null;
    isbn: string | null;
    category: string | null;
    totalCopies: number;
    status: "ACTIVE" | "INACTIVE";
  }>,
) => api<Book>(`/library/books/${id}`, { method: "PATCH", body });

export const apiDeleteBook = (id: string) =>
  api<{ success: boolean }>(`/library/books/${id}`, { method: "DELETE" });

export const apiListLoans = (filters?: { status?: string; bookId?: string }) => {
  const q = new URLSearchParams();
  if (filters?.status) q.set("status", filters.status);
  if (filters?.bookId) q.set("bookId", filters.bookId);
  const qs = q.toString();
  return api<BookLoan[]>(`/library/loans${qs ? `?${qs}` : ""}`);
};

export const apiIssueBook = (body: {
  bookId: string;
  studentId: string;
  dueDate: string;
}) => api<BookLoan>("/library/loans", { method: "POST", body });

export const apiReturnBook = (loanId: string) =>
  api<BookLoan>(`/library/loans/${loanId}/return`, { method: "POST" });

// ── PDF documents ──────────────────────────────────────────────────────────

export interface LibraryDocument {
  id: string;
  title: string;
  description: string | null;
  author: string | null;
  classId: string | null;
  class: { id: string; name: string } | null;
  fileSizeBytes: number;
  allowDownload: boolean;
  status: "ACTIVE" | "INACTIVE";
  createdAt: string;
}

export interface LibraryStorageUsage {
  usedBytes: number;
  limitMb: number | null;
  limitBytes: number | null;
}

export const apiListLibraryDocuments = (params?: {
  q?: string;
  classId?: string;
}) => {
  const qs = new URLSearchParams();
  if (params?.q) qs.set("q", params.q);
  if (params?.classId) qs.set("classId", params.classId);
  const s = qs.toString();
  return api<LibraryDocument[]>(`/library/documents${s ? `?${s}` : ""}`);
};

export const apiLibraryStorageUsage = () =>
  api<LibraryStorageUsage>("/library/documents/usage");

export const apiUpdateLibraryDocument = (
  id: string,
  body: Partial<{
    title: string;
    description: string | null;
    author: string | null;
    classId: string | null;
    allowDownload: boolean;
    status: "ACTIVE" | "INACTIVE";
  }>,
) => api<LibraryDocument>(`/library/documents/${id}`, { method: "PATCH", body });

export const apiDeleteLibraryDocument = (id: string) =>
  api<{ ok: boolean }>(`/library/documents/${id}`, { method: "DELETE" });

/**
 * Multipart upload — can't go through `api()`, which forces a JSON body. The
 * Content-Type header is deliberately omitted so the browser sets the
 * multipart boundary itself.
 */
export async function apiUploadLibraryDocument(input: {
  file: File;
  title: string;
  description?: string;
  author?: string;
  classId?: string;
  allowDownload: boolean;
}): Promise<LibraryDocument> {
  const form = new FormData();
  form.append("file", input.file);
  form.append("title", input.title);
  if (input.description) form.append("description", input.description);
  if (input.author) form.append("author", input.author);
  if (input.classId) form.append("classId", input.classId);
  form.append("allowDownload", String(input.allowDownload));

  const token = getAccessToken();
  const res = await fetch(`${API_URL}/api/library/documents`, {
    method: "POST",
    headers: {
      "x-tenant-subdomain": TENANT,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: form,
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
    if (res.status === 413) {
      message = "That PDF is too large for the server to accept.";
    }
    throw new ApiError(res.status, message);
  }
  return (await res.json()) as LibraryDocument;
}

/** Staff preview URL for a stored PDF. */
export const libraryDocumentFileUrl = (id: string) =>
  `${API_URL}/api/library/documents/${id}/file`;
