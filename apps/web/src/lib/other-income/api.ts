"use client";

import { api } from "@/lib/api";

export interface ApiIncomeCategory {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApiOtherIncome {
  id: string;
  categoryId: string | null;
  title: string;
  source: string | null;
  amount: number;
  method: string | null;
  note: string | null;
  recordedByUserId: string | null;
  receivedAt: string;
  createdAt: string;
  updatedAt: string;
  category?: { id: string; name: string } | null;
}

export interface OtherIncomeSummary {
  total: number;
  count: number;
  bySource: { name: string; amount: number }[];
  recent: ApiOtherIncome[];
}

export interface OtherIncomeInput {
  categoryId?: string | null;
  title: string;
  source?: string | null;
  amount: number;
  method?: string | null;
  note?: string | null;
  receivedAt?: string;
}

export const apiListIncomeCategories = () =>
  api<ApiIncomeCategory[]>("/other-income/categories");

export const apiCreateIncomeCategory = (name: string) =>
  api<ApiIncomeCategory>("/other-income/categories", {
    method: "POST",
    body: { name },
  });

export const apiDeleteIncomeCategory = (id: string) =>
  api<{ success: boolean }>(`/other-income/categories/${id}`, {
    method: "DELETE",
  });

export const apiListOtherIncome = (categoryId?: string) =>
  api<ApiOtherIncome[]>(
    `/other-income${categoryId ? `?categoryId=${encodeURIComponent(categoryId)}` : ""}`,
  );

export const apiOtherIncomeSummary = (month?: string) =>
  api<OtherIncomeSummary>(
    `/other-income/summary${month ? `?month=${encodeURIComponent(month)}` : ""}`,
  );

export const apiCreateOtherIncome = (body: OtherIncomeInput) =>
  api<ApiOtherIncome>("/other-income", { method: "POST", body });

export const apiUpdateOtherIncome = (id: string, body: Partial<OtherIncomeInput>) =>
  api<ApiOtherIncome>(`/other-income/${id}`, { method: "PATCH", body });

export const apiDeleteOtherIncome = (id: string) =>
  api<{ success: boolean }>(`/other-income/${id}`, { method: "DELETE" });
