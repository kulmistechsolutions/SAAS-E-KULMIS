"use client";

import { api } from "@/lib/api";
import type {
  CreateCategoryInput,
  CreateExpenseInput,
  Expense,
  ExpenseCategory,
  PaymentMethod,
} from "./types";

export interface ApiExpenseCategory {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApiExpense {
  id: string;
  categoryId: string | null;
  title: string;
  amount: number;
  method: string | null;
  note: string | null;
  recordedByUserId: string | null;
  spentAt: string;
  createdAt: string;
  updatedAt: string;
  category?: { id: string; name: string } | null;
}

export function mapApiCategory(c: ApiExpenseCategory): ExpenseCategory {
  return {
    id: c.id,
    name: c.name,
    status: "ACTIVE",
    createdAt: c.createdAt,
  };
}

export function mapApiExpense(
  e: ApiExpense,
  academicYear: string,
): Expense {
  const method = (e.method?.toUpperCase() ?? "CASH") as PaymentMethod;
  const validMethods: PaymentMethod[] = [
    "CASH",
    "BANK_TRANSFER",
    "MOBILE_MONEY",
    "CHEQUE",
    "OTHER",
  ];
  return {
    id: e.id,
    referenceNo: `EXP-${e.id.slice(-6).toUpperCase()}`,
    title: e.title,
    categoryId: e.categoryId ?? "",
    amount: e.amount,
    expenseDate: e.spentAt.slice(0, 10),
    academicYear,
    paymentMethod: validMethods.includes(method) ? method : "OTHER",
    paidTo: "—",
    description: e.note,
    attachment: null,
    recordedBy: "Finance Officer",
    status: "RECORDED",
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  };
}

export async function apiListCategories(): Promise<ExpenseCategory[]> {
  const rows = await api<ApiExpenseCategory[]>("/expenses/categories");
  return rows.map(mapApiCategory);
}

export async function apiCreateCategory(input: CreateCategoryInput): Promise<ExpenseCategory> {
  const row = await api<ApiExpenseCategory>("/expenses/categories", {
    method: "POST",
    body: { name: input.name.trim() },
  });
  return mapApiCategory(row);
}

export async function apiDeleteCategory(id: string): Promise<void> {
  await api<{ success: boolean }>(`/expenses/categories/${id}`, { method: "DELETE" });
}

export async function apiListExpenses(categoryId?: string): Promise<ApiExpense[]> {
  const q = categoryId ? `?categoryId=${encodeURIComponent(categoryId)}` : "";
  return api<ApiExpense[]>(`/expenses${q}`);
}

export async function apiCreateExpense(
  input: CreateExpenseInput,
  academicYear: string,
): Promise<Expense> {
  const note = [input.paidTo?.trim(), input.description?.trim()]
    .filter(Boolean)
    .join(" — ") || null;
  const row = await api<ApiExpense>("/expenses", {
    method: "POST",
    body: {
      categoryId: input.categoryId || null,
      title: input.title.trim(),
      amount: input.amount,
      method: input.paymentMethod,
      note,
      spentAt: input.expenseDate,
    },
  });
  return mapApiExpense(row, academicYear);
}

export async function apiDeleteExpense(id: string): Promise<void> {
  await api<{ success: boolean }>(`/expenses/${id}`, { method: "DELETE" });
}
