"use client";

import { api } from "@/lib/api";

export interface SearchResult {
  type: "student" | "teacher" | "parent";
  id: string;
  code: string;
  name: string;
  subtitle?: string;
}

export async function apiSearch(
  q: string,
  type?: "student" | "teacher" | "parent" | "all",
  limit = 20,
): Promise<SearchResult[]> {
  const params = new URLSearchParams({ q });
  if (type && type !== "all") params.set("type", type);
  params.set("limit", String(limit));
  return api<SearchResult[]>(`/search?${params.toString()}`);
}
