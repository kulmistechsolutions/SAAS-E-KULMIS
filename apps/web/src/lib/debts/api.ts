"use client";

import { api } from "@/lib/api";
import type {
  DebtRepayment,
  DebtsSummary,
  SchoolDebt,
  SchoolDebtDetail,
} from "./types";

export interface CreateDebtInput {
  lender: string;
  purpose?: string;
  principal: number;
  reference?: string;
  takenAt?: string;
  dueAt?: string | null;
  note?: string;
}

export interface UpdateDebtInput extends Partial<CreateDebtInput> {
  status?: SchoolDebt["status"];
}

export interface CreateRepaymentInput {
  amount: number;
  method?: string;
  reference?: string;
  note?: string;
  paidAt?: string;
}

export const apiListDebts = (status?: string) =>
  api<SchoolDebt[]>(`/school-debts${status ? `?status=${status}` : ""}`);

export const apiDebtsSummary = () => api<DebtsSummary>("/school-debts/summary");

export const apiGetDebt = (id: string) =>
  api<SchoolDebtDetail>(`/school-debts/${id}`);

export const apiCreateDebt = (dto: CreateDebtInput) =>
  api<SchoolDebt>("/school-debts", { method: "POST", body: dto });

export const apiUpdateDebt = (id: string, dto: UpdateDebtInput) =>
  api<SchoolDebt>(`/school-debts/${id}`, { method: "PATCH", body: dto });

export const apiRepayDebt = (id: string, dto: CreateRepaymentInput) =>
  api<DebtRepayment>(`/school-debts/${id}/repayments`, {
    method: "POST",
    body: dto,
  });

export const apiDeleteRepayment = (repaymentId: string) =>
  api<{ success: boolean }>(`/school-debts/repayments/${repaymentId}`, {
    method: "DELETE",
  });
