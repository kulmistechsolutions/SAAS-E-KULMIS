"use client";

import { api } from "@/lib/api";
import type { EmploymentStatus, StaffEmployee, StaffEmployeeInput } from "./types";

export interface ApiEmployee {
  id: string;
  code: string;
  fullName: string;
  position: string;
  phone: string | null;
  salary: number;
  status: EmploymentStatus;
  notes: string | null;
  createdAt: string;
}

export function mapApiEmployee(e: ApiEmployee): StaffEmployee {
  return {
    id: e.id,
    code: e.code,
    fullName: e.fullName,
    position: e.position,
    phone: e.phone,
    salary: e.salary,
    status: e.status,
    notes: e.notes,
    createdAt: e.createdAt,
  };
}

export async function apiListEmployees(): Promise<ApiEmployee[]> {
  return api<ApiEmployee[]>("/employees");
}

export async function apiCreateEmployee(input: StaffEmployeeInput): Promise<ApiEmployee> {
  return api<ApiEmployee>("/employees", { method: "POST", body: input });
}

export async function apiUpdateEmployee(
  id: string,
  patch: Partial<StaffEmployeeInput>,
): Promise<ApiEmployee> {
  return api<ApiEmployee>(`/employees/${id}`, { method: "PATCH", body: patch });
}

export async function apiDeleteEmployee(id: string): Promise<void> {
  await api<{ success: boolean }>(`/employees/${id}`, { method: "DELETE" });
}
