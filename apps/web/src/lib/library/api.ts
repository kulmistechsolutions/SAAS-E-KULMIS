"use client";

import { api } from "@/lib/api";

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
