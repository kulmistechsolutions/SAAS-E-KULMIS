"use client";

import { api } from "@/lib/api";
import { monthKey } from "./format";
import type { FeeCharge, FeePayment, PaymentType } from "./types";

export interface ApiFeeCharge {
  id: string;
  studentId: string;
  year: number;
  month: number;
  amount: number;
  paidAmount: number;
  status: "UNPAID" | "PARTIAL" | "PAID" | "INACTIVE";
  /** MONTHLY = the regular fee; EXTRA = an added charge such as an exam fee. */
  kind?: "MONTHLY" | "EXTRA";
  /** Name shown on the invoice for EXTRA rows, e.g. "Exam Fee". */
  label?: string | null;
  extraFeeId?: string | null;
  student?: {
    code: string;
    fullName: string;
    class: { name: string } | null;
    section: { name: string } | null;
  };
}

export interface ApiPayment {
  id: string;
  studentId: string;
  receiptNumber: string;
  type: PaymentType;
  amount: number;
  method: string | null;
  note: string | null;
  paidAt: string;
  student?: {
    code: string;
    fullName: string;
    class: { name: string } | null;
  };
}

export interface ApiFinanceDashboard {
  totalIncome: number;
  totalExpenses: number;
  totalSalaries: number;
  netIncome: number;
  totalOutstanding: number;
}

export interface ApiStudentLedger {
  student: {
    id: string;
    code: string;
    fullName: string;
    monthlyFee: number;
    annualFeeAmount?: number | null;
  };
  charges: ApiFeeCharge[];
  payments: ApiPayment[];
  outstanding: number;
  summary?: {
    billingMode: string;
    monthlyFee: number;
    totalAcademicFee: number;
    amountPaid: number;
    outstandingBalance: number;
    paidMonths: number;
    unpaidMonths: number;
    inactiveMonths: number;
    totalMonths: number;
    progressPercent: number;
  };
}

export function mapApiCharge(
  c: ApiFeeCharge,
  academicYear: string,
  activeMonthKey: string,
): FeeCharge {
  const mk = monthKey(c.year, c.month);
  let balance = Math.max(0, c.amount - c.paidAmount);
  if (c.status === "INACTIVE") balance = 0;
  const advanceCovered =
    mk > activeMonthKey && c.paidAmount >= c.amount && c.status === "PAID";
  let status = c.status as FeeCharge["status"];
  if (advanceCovered) status = "ADVANCE";

  return {
    id: c.id,
    studentId: c.studentId,
    academicYear,
    monthKey: mk,
    monthlyFee: c.amount,
    amountPaid: c.paidAmount,
    balance,
    status,
    paymentDate:
      c.paidAmount > 0 ? new Date().toISOString().slice(0, 10) : null,
    advanceCovered,
    kind: c.kind ?? "MONTHLY",
    label: c.label ?? null,
  };
}

export function mapApiPayment(p: ApiPayment, academicYear: string): FeePayment {
  return {
    id: p.id,
    receiptNo: p.receiptNumber,
    studentId: p.studentId,
    academicYear,
    amount: p.amount,
    paymentType: p.type,
    monthKeys: [],
    collectedBy: "Finance Officer",
    collectedAt: p.paidAt,
    outstandingAfter: 0,
  };
}

export async function apiListCharges(
  year?: number,
  month?: number,
): Promise<ApiFeeCharge[]> {
  const params = new URLSearchParams();
  if (year) params.set("year", String(year));
  if (month) params.set("month", String(month));
  const q = params.toString();
  return api<ApiFeeCharge[]>(`/fees/charges${q ? `?${q}` : ""}`);
}

export async function apiListPayments(limit = 100): Promise<ApiPayment[]> {
  return api<ApiPayment[]>(`/fees/payments?limit=${limit}`);
}

export async function apiOutstanding(
  classId?: string,
  sectionId?: string,
): Promise<ApiFeeCharge[]> {
  const params = new URLSearchParams();
  if (classId) params.set("classId", classId);
  if (sectionId) params.set("sectionId", sectionId);
  const q = params.toString();
  return api<ApiFeeCharge[]>(`/fees/outstanding${q ? `?${q}` : ""}`);
}

export async function apiStudentLedger(
  studentId: string,
): Promise<ApiStudentLedger> {
  return api<ApiStudentLedger>(`/fees/ledger/${studentId}`);
}

export async function apiFinanceDashboard(): Promise<ApiFinanceDashboard> {
  return api<ApiFinanceDashboard>("/finance/dashboard");
}

export interface ChargeMonthApiInput {
  classId: string;
  sectionId?: string | null;
  year: number;
  month: number;
  amount?: number;
}

export async function apiChargeMonth(input: ChargeMonthApiInput) {
  return api<{ year: number; month: number; charged: number; skipped: number }>(
    "/fees/charge",
    { method: "POST", body: input },
  );
}

export interface SetupMonthApiInput {
  year: number;
  month: number;
  scope: "all" | "selected";
  classIds?: string[];
  amount?: number;
}

/** Turn monthly billing on for a month — every class or a chosen set. */
export async function apiSetupMonth(input: SetupMonthApiInput) {
  return api<{
    year: number;
    month: number;
    classesActivated: number;
    charged: number;
    skipped: number;
  }>("/fees/setup-month", { method: "POST", body: input });
}

export interface MonthStatusClass {
  id: string;
  name: string;
  academicYear: string;
  activeStudents: number;
  activated: boolean;
}

/** Which classes are set up (activated) for a given month. */
export async function apiMonthStatus(year: number, month: number) {
  return api<{ year: number; month: number; classes: MonthStatusClass[] }>(
    `/fees/month-status?year=${year}&month=${month}`,
  );
}

export interface PayFeeApiInput {
  studentId: string;
  amount: number;
  type: PaymentType;
  method?: string | null;
  note?: string | null;
}

export async function apiPayFee(input: PayFeeApiInput) {
  return api<{
    receiptNumber: string;
    payment: ApiPayment;
    unallocated: number;
  }>("/fees/pay", { method: "POST", body: input });
}

export async function apiFeeSettings() {
  return api<{
    billingMode: "MONTHLY" | "ACADEMIC_YEAR";
    feeAcademicMonths: number;
    feeBillingStartMonth: number;
    feeBillingEndMonth: number;
    feeAllowPartial: boolean;
    feeAllowAdvance: boolean;
    feeMonthSetupDay: number;
  }>("/fees/settings");
}

export async function apiSetupAcademicYear(body: {
  academicYearId: string;
  academicMonths?: number;
  monthlyFee?: number;
  billingStartMonth?: number;
  billingEndMonth?: number;
}) {
  return api<{
    academicYearId: string;
    academicMonths: number;
    totalAnnualFee: number;
    studentsProcessed: number;
    chargesCreated: number;
  }>("/fees/setup-academic-year", { method: "POST", body });
}

// ── Extra fees ─────────────────────────────────────────────────────────────

export interface ApiExtraFeeClassAmount {
  id: string;
  classId: string;
  amount: number;
  class: { id: string; name: string };
}

export interface ApiExtraFee {
  id: string;
  name: string;
  description: string | null;
  year: number;
  month: number;
  appliesToAllClasses: boolean;
  defaultAmount: number | null;
  status: "ACTIVE" | "INACTIVE";
  appliedAt: string | null;
  createdAt: string;
  classAmounts: ApiExtraFeeClassAmount[];
  appliedCount: number;
  appliedTotal: number;
  collectedTotal: number;
}

export interface ExtraFeeBody {
  name: string;
  description?: string | null;
  year: number;
  month: number;
  appliesToAllClasses: boolean;
  defaultAmount?: number | null;
  classAmounts: { classId: string; amount: number }[];
}

export const apiListExtraFees = () => api<ApiExtraFee[]>("/fees/extra");

export const apiCreateExtraFee = (body: ExtraFeeBody) =>
  api<ApiExtraFee>("/fees/extra", { method: "POST", body });

export const apiUpdateExtraFee = (id: string, body: ExtraFeeBody) =>
  api<ApiExtraFee>(`/fees/extra/${id}`, { method: "PATCH", body });

export const apiDeleteExtraFee = (id: string) =>
  api<{ ok: boolean }>(`/fees/extra/${id}`, { method: "DELETE" });

export interface ExtraFeePreview {
  studentCount: number;
  pendingCount: number;
  totalAmount: number;
  targets: {
    studentId: string;
    code: string;
    fullName: string;
    className: string;
    amount: number;
    alreadyCharged: boolean;
  }[];
}

export const apiPreviewExtraFee = (id: string) =>
  api<ExtraFeePreview>(`/fees/extra/${id}/preview`);

export const apiApplyExtraFee = (id: string) =>
  api<{ applied: number; skipped: number; totalAmount: number }>(
    `/fees/extra/${id}/apply`,
    { method: "POST" },
  );
