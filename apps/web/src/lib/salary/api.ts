"use client";

import { api } from "@/lib/api";
import { monthKey } from "@/lib/fees/format";
import type {
  Employee,
  PayrollRecord,
  PayrollStatus,
  PaymentMethod,
} from "./types";

export interface ApiSalary {
  id: string;
  teacherId: string | null;
  employeeName: string;
  position: string | null;
  amount: number;
  year: number;
  month: number;
  status: PayrollStatus;
  paidAt: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export function mapApiSalary(s: ApiSalary, academicYear: string): {
  employee: Employee;
  payroll: PayrollRecord;
} {
  const payrollMonth = monthKey(s.year, s.month);
  const amountPaid = s.status === "PAID" ? s.amount : 0;
  const remainingBalance = s.status === "PAID" ? 0 : s.amount;

  const employee: Employee = {
    id: s.teacherId ?? s.id,
    code: s.teacherId ?? s.id.slice(0, 8).toUpperCase(),
    fullName: s.employeeName,
    type: s.teacherId ? "TEACHER" : "STAFF",
    teacherId: s.teacherId,
    position: (s.position as Employee["position"]) ?? "Other Staff",
    basicSalary: s.amount,
    allowances: 0,
    deductions: 0,
    bonus: 0,
    paymentMethod: "BANK_TRANSFER",
    joiningDate: s.createdAt.slice(0, 10),
    employmentStatus: "ACTIVE",
  };

  const payroll: PayrollRecord = {
    id: s.id,
    employeeId: employee.id,
    payrollMonth,
    academicYear,
    basicSalary: s.amount,
    allowances: 0,
    bonus: 0,
    deductions: 0,
    netSalary: s.amount,
    amountPaid,
    remainingBalance,
    status: s.status,
    generatedAt: s.createdAt,
  };

  return { employee, payroll };
}

export async function apiListSalaries(year?: number, month?: number): Promise<ApiSalary[]> {
  const params = new URLSearchParams();
  if (year) params.set("year", String(year));
  if (month) params.set("month", String(month));
  const q = params.toString();
  return api<ApiSalary[]>(`/salaries${q ? `?${q}` : ""}`);
}

export interface CreateSalaryApiInput {
  teacherId?: string | null;
  employeeName: string;
  position?: string | null;
  amount: number;
  year: number;
  month: number;
  status?: PayrollStatus;
  note?: string | null;
}

export async function apiCreateSalary(input: CreateSalaryApiInput): Promise<ApiSalary> {
  return api<ApiSalary>("/salaries", { method: "POST", body: input });
}

export async function apiUpdateSalary(
  id: string,
  patch: { amount?: number; status?: PayrollStatus; note?: string | null },
): Promise<ApiSalary> {
  return api<ApiSalary>(`/salaries/${id}`, { method: "PATCH", body: patch });
}

export async function apiDeleteSalary(id: string): Promise<void> {
  await api<{ success: boolean }>(`/salaries/${id}`, { method: "DELETE" });
}

export type { PaymentMethod };
