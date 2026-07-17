"use client";

import { API_URL, ApiError, TENANT } from "@/lib/api";

/**
 * The library portal is a separate, password-less session from staff auth —
 * a distinct token key so logging a student in here never touches (or gets
 * clobbered by) an admin's own session in the same browser.
 */
const TOKEN_KEY = "ekulmis_library_portal_token";

export function getLibraryPortalToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setLibraryPortalToken(token: string | null): void {
  if (typeof window === "undefined") return;
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
}

async function libraryApi<T>(
  path: string,
  opts: { method?: "GET" | "POST"; body?: unknown } = {},
): Promise<T> {
  const token = getLibraryPortalToken();
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
    if (res.status === 401) setLibraryPortalToken(null);
    throw new ApiError(res.status, message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export interface LibraryPortalStudent {
  id: string;
  code: string;
  fullName: string;
  className: string;
}

export interface LibraryPortalMe {
  schoolName: string;
  student: LibraryPortalStudent;
}

export interface LibraryPortalBook {
  id: string;
  title: string;
  description: string | null;
  author: string | null;
  fileSizeBytes: number;
  allowDownload: boolean;
  classId: string | null;
  createdAt: string;
}

export async function apiLibraryPortalLogin(studentCode: string) {
  const res = await libraryApi<{
    accessToken: string;
    student: LibraryPortalStudent;
  }>("/library-portal/login", { method: "POST", body: { studentCode } });
  setLibraryPortalToken(res.accessToken);
  return res.student;
}

export const apiLibraryPortalMe = () => libraryApi<LibraryPortalMe>("/library-portal/me");

export const apiLibraryPortalBooks = () =>
  libraryApi<LibraryPortalBook[]>("/library-portal/books");

export interface LibraryPortalBookDetail {
  id: string;
  title: string;
  description: string | null;
  author: string | null;
  fileSizeBytes: number;
  allowDownload: boolean;
}

export const apiLibraryPortalBook = (id: string) =>
  libraryApi<LibraryPortalBookDetail>(`/library-portal/books/${id}`);

/** Fetches the PDF bytes as a Blob — always via an authenticated request, never a bare URL. */
export async function fetchLibraryPortalBookFile(id: string): Promise<Blob> {
  const token = getLibraryPortalToken();
  const res = await fetch(`${API_URL}/api/library-portal/books/${id}/file`, {
    headers: {
      "x-tenant-subdomain": TENANT,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) {
    if (res.status === 401) setLibraryPortalToken(null);
    throw new ApiError(res.status, "Could not load this book.");
  }
  return res.blob();
}

export function libraryPortalLogout(): void {
  setLibraryPortalToken(null);
}
