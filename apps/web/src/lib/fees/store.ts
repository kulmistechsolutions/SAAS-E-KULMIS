"use client";

import { useSyncExternalStore } from "react";
import { ApiError } from "@/lib/api";
import {
  getAcademicsState,
  activeAcademicYear as getActiveAcademicYear,
} from "@/lib/academics/store";
import { getState as getStudentsState } from "@/lib/students/store";
import type { Student } from "@/lib/students/types";
import {
  apiChargeMonth,
  apiFeeSettings,
  apiFinanceDashboard,
  apiListCharges,
  apiListPayments,
  apiPayFee,
  mapApiCharge,
  mapApiPayment,
} from "./api";
import { monthKey, monthLabel, nextMonthKey, parseMonthKey } from "./format";
import type {
  FeeCharge,
  FeeChargeStatus,
  FeeDashboardSummary,
  FeePayment,
  FeesState,
  PaymentSummarySlice,
  PaymentType,
  RecentPaymentRow,
  StudentFeeRow,
  StudentLedgerRow,
} from "./types";

const EMPTY: FeesState = {
  academicYear: "2024-2025",
  activeMonthKey: monthKey(new Date().getFullYear(), new Date().getMonth() + 1),
  billingPeriods: [],
  charges: [],
  payments: [],
  receiptSeq: 1000,
  audit: [],
};

let state: FeesState | null = null;
let loaded = false;
let feeSettingsCache: {
  billingMode: "MONTHLY" | "ACADEMIC_YEAR";
  monthSetupDay: number;
} = { billingMode: "MONTHLY", monthSetupDay: 25 };
const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function emit() {
  listeners.forEach((l) => l());
}

function setState(next: FeesState) {
  state = next;
  emit();
}

function apiErr(e: unknown, fallback: string): string {
  return e instanceof ApiError ? e.message : fallback;
}

function activeAcademicYear(): string {
  return getActiveAcademicYear();
}

function deriveActiveMonth(charges: FeeCharge[]): string {
  if (charges.length === 0) {
    const now = new Date();
    return monthKey(now.getFullYear(), now.getMonth() + 1);
  }
  return charges.reduce((max, c) => (c.monthKey > max ? c.monthKey : max), charges[0]!.monthKey);
}

function buildBillingPeriods(charges: FeeCharge[], academicYear: string): FeesState["billingPeriods"] {
  const keys = [...new Set(charges.map((c) => c.monthKey))].sort();
  const active = deriveActiveMonth(charges);
  return keys.map((mk, i) => ({
    id: `bp_${i + 1}`,
    academicYear,
    monthKey: mk,
    activatedAt: new Date().toISOString(),
    status: mk === active ? ("ACTIVE" as const) : ("CLOSED" as const),
  }));
}

/** Load charges and payments from the API. */
export async function refreshFees(): Promise<void> {
  try {
    const academicYear = activeAcademicYear();
    const [chargeRows, paymentRows, feeSettings] = await Promise.all([
      apiListCharges(),
      apiListPayments(200),
      apiFeeSettings().catch(() => null),
    ]);
    if (feeSettings) {
      feeSettingsCache = {
        billingMode: feeSettings.billingMode,
        monthSetupDay: feeSettings.feeMonthSetupDay,
      };
    }
    const activeMonthKey = deriveActiveMonth(
      chargeRows.map((c) =>
        mapApiCharge(c, academicYear, monthKey(c.year, c.month)),
      ),
    );
    const charges = chargeRows.map((c) => mapApiCharge(c, academicYear, activeMonthKey));
    const payments = paymentRows.map((p) => mapApiPayment(p, academicYear));
    const maxReceipt = payments.reduce((max, p) => {
      const n = Number(p.receiptNo.replace(/\D/g, ""));
      return Number.isFinite(n) && n > max ? n : max;
    }, 1000);

    setState({
      academicYear,
      activeMonthKey,
      billingPeriods: buildBillingPeriods(charges, academicYear),
      charges,
      payments,
      receiptSeq: maxReceipt,
      audit: state?.audit ?? [],
    });
  } catch {
    /* keep cache */
  }
}

function ensure(): FeesState {
  if (state) return state;
  if (typeof window === "undefined") return EMPTY;
  state = { ...EMPTY, academicYear: activeAcademicYear() };
  if (!loaded) {
    loaded = true;
    void refreshFees();
  }
  return state;
}

export function getFeesState(): FeesState {
  return ensure();
}

export function useFeesState(): FeesState {
  return useSyncExternalStore(subscribe, getFeesState, () => EMPTY);
}

export function resetFees() {
  void refreshFees();
}

function logAudit(action: string, user: string, detail?: string) {
  const s = ensure();
  setState({
    ...s,
    audit: [
      {
        id: `fa_${Date.now()}`,
        action,
        user,
        at: new Date().toISOString(),
        detail,
      },
      ...s.audit,
    ].slice(0, 200),
  });
}

function activeStudents(year: string): Student[] {
  return getStudentsState().students.filter(
    (s) => s.status === "ACTIVE" && s.academicYear === year,
  );
}

function resolveClassSectionIds(
  className: string,
  sectionName: string | null | undefined,
): { classId?: string; sectionId?: string | null; error?: string } {
  const a = getAcademicsState();
  const cls = a.classes.find((c) => c.name === className);
  if (!cls) return { error: `Class "${className}" not found.` };
  if (!sectionName) return { classId: cls.id, sectionId: null };
  const sec = a.sections.find((s) => s.classId === cls.id && s.name === sectionName);
  if (!sec) return { error: `Section "${sectionName}" not found.` };
  return { classId: cls.id, sectionId: sec.id };
}

export function studentCharges(
  studentId: string,
  academicYear?: string,
): FeeCharge[] {
  const s = ensure();
  const year = academicYear ?? s.academicYear;
  return s.charges
    .filter((c) => c.studentId === studentId && c.academicYear === year)
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey));
}

export function getFeeBillingMode(): "MONTHLY" | "ACADEMIC_YEAR" {
  return feeSettingsCache.billingMode;
}

export function getFeeMonthSetupDay(): number {
  return feeSettingsCache.monthSetupDay;
}

export function outstandingBalance(studentId: string, upToMonth?: string): number {
  const charges = studentCharges(studentId);
  const allBillable =
    feeSettingsCache.billingMode === "ACADEMIC_YEAR" && upToMonth === undefined;
  const month = upToMonth ?? ensure().activeMonthKey;
  return charges
    .filter(
      (c) =>
        c.status !== "INACTIVE" &&
        (allBillable || c.monthKey <= month) &&
        c.balance > 0 &&
        !c.advanceCovered,
    )
    .reduce((sum, c) => sum + c.balance, 0);
}

function earliestUnpaidCharge(studentId: string): FeeCharge | undefined {
  return studentCharges(studentId)
    .filter(
      (c) =>
        c.status !== "INACTIVE" && c.balance > 0 && !c.advanceCovered,
    )
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey))[0];
}

export function advanceMonthsLeft(studentId: string, fromMonth: string): number {
  const charges = studentCharges(studentId);
  return charges.filter(
    (c) => c.monthKey >= fromMonth && c.advanceCovered && c.status === "ADVANCE",
  ).length;
}

export function aggregateStudentStatus(
  studentId: string,
  monthKeyArg: string,
): { status: FeeChargeStatus | "ADVANCE_MULTI"; advanceMonthsLeft?: number } {
  const adv = advanceMonthsLeft(studentId, monthKeyArg);
  if (adv > 0) return { status: "ADVANCE_MULTI", advanceMonthsLeft: adv };

  const outstanding = outstandingBalance(studentId, monthKeyArg);
  if (outstanding > 0) {
    const charge = studentCharges(studentId).find((c) => c.monthKey === monthKeyArg);
    if (charge && charge.amountPaid > 0) return { status: "PARTIAL" };
    return { status: "UNPAID" };
  }

  const charge = studentCharges(studentId).find((c) => c.monthKey === monthKeyArg);
  if (charge?.status === "PAID" || charge?.advanceCovered) return { status: "PAID" };
  return { status: "UNPAID" };
}

export function canActivateNextMonth(at = new Date()): boolean {
  if (feeSettingsCache.billingMode === "ACADEMIC_YEAR") return false;
  const s = ensure();
  const { year, month } = parseMonthKey(s.activeMonthKey);
  const day = at.getUTCDate();
  const setupDay = feeSettingsCache.monthSetupDay;
  const isActiveMonth =
    at.getUTCFullYear() === year && at.getUTCMonth() + 1 === month;
  return isActiveMonth && day >= setupDay;
}

export function nextActivatableMonth(): string {
  return nextMonthKey(ensure().activeMonthKey);
}

export interface MonthSetupClassGroup {
  /** classId:sectionId — the same key used to exclude it from activation. */
  key: string;
  classId: string;
  sectionId: string | null;
  className: string;
  sectionName: string | null;
  studentCount: number;
}

/**
 * Every class/section that would be charged if the next month is activated
 * right now — for the setup screen to show as a checklist, so a class on
 * break (fasax) this month can be unticked before charging.
 */
export function pendingMonthClasses(): MonthSetupClassGroup[] {
  const s = ensure();
  const students = activeStudents(s.academicYear);
  const groups = new Map<string, MonthSetupClassGroup>();

  for (const st of students) {
    const r = resolveClassSectionIds(st.className, st.section);
    if (!r.classId) continue;
    const key = `${r.classId}:${r.sectionId ?? ""}`;
    const existing = groups.get(key);
    if (existing) {
      existing.studentCount += 1;
    } else {
      groups.set(key, {
        key,
        classId: r.classId,
        sectionId: r.sectionId ?? null,
        className: st.className,
        sectionName: st.section ?? null,
        studentCount: 1,
      });
    }
  }

  return [...groups.values()].sort(
    (a, b) =>
      a.className.localeCompare(b.className) ||
      (a.sectionName ?? "").localeCompare(b.sectionName ?? ""),
  );
}

/**
 * Charge every class for the next month, except the ones in `excludedKeys`
 * (each a `pendingMonthClasses()` group's `key`). A class left out this run
 * is simply not billed for the month — nothing is created for it, and it
 * picks back up normally whenever it's included again. There is no sequence
 * dependency between months in this billing mode, so skipping one is safe.
 */
export async function activateNextMonth(
  user = "Admin User",
  excludedKeys: string[] = [],
): Promise<{ ok: boolean; error?: string }> {
  if (feeSettingsCache.billingMode === "ACADEMIC_YEAR") {
    return {
      ok: false,
      error: "Monthly setup is disabled while Academic Year billing is active.",
    };
  }
  const setupDay = feeSettingsCache.monthSetupDay;
  if (!canActivateNextMonth()) {
    return {
      ok: false,
      error: `Next month can only be activated after the ${setupDay}th of ${monthLabel(ensure().activeMonthKey)}.`,
    };
  }

  const s = ensure();
  const nextKey = nextMonthKey(s.activeMonthKey);
  if (s.billingPeriods.some((b) => b.monthKey === nextKey)) {
    return { ok: false, error: "Next month is already activated." };
  }

  const { year, month } = parseMonthKey(nextKey);
  const groups = pendingMonthClasses();
  if (groups.length === 0) {
    return { ok: false, error: "No classes found for active students." };
  }

  const excluded = new Set(excludedKeys);
  const included = groups.filter((g) => !excluded.has(g.key));
  if (included.length === 0) {
    return { ok: false, error: "Every class was excluded — nothing to charge." };
  }

  try {
    for (const g of included) {
      await apiChargeMonth({ classId: g.classId, sectionId: g.sectionId, year, month });
    }
    await refreshFees();
    logAudit(
      "Month Setup",
      user,
      `Activated ${monthLabel(nextKey)}` +
        (excluded.size > 0 ? ` — ${excluded.size} class(es) excluded` : ""),
    );
    return { ok: true };
  } catch (e) {
    return { ok: false, error: apiErr(e, "Failed to activate next month.") };
  }
}

export interface PayInput {
  studentId: string;
  paymentType: PaymentType;
  amount?: number;
  advanceMonths?: number;
  collectedBy?: string;
}

export async function collectPayment(input: PayInput): Promise<{
  ok: boolean;
  error?: string;
  payment?: FeePayment;
}> {
  const s = ensure();
  const student = getStudentsState().students.find((x) => x.id === input.studentId);
  if (!student) return { ok: false, error: "Student not found." };

  const month = s.activeMonthKey;
  const outstanding =
    feeSettingsCache.billingMode === "ACADEMIC_YEAR"
      ? outstandingBalance(student.id)
      : outstandingBalance(student.id, month);
  const activeCharge =
    feeSettingsCache.billingMode === "ACADEMIC_YEAR"
      ? earliestUnpaidCharge(student.id)
      : s.charges.find(
          (c) =>
            c.studentId === student.id &&
            c.academicYear === s.academicYear &&
            c.monthKey === month,
        );

  let amount = 0;

  if (input.paymentType === "THIS_MONTH") {
    if (!activeCharge || activeCharge.advanceCovered)
      return { ok: false, error: "This month is already covered." };
    if (activeCharge.balance === 0)
      return { ok: false, error: "This month is already fully paid." };
    amount = activeCharge.balance;
  } else if (input.paymentType === "PARTIAL") {
    if (outstanding <= 0)
      return { ok: false, error: "No outstanding balance to pay." };
    amount = input.amount ?? 0;
    if (amount <= 0) return { ok: false, error: "Enter a valid payment amount." };
    if (amount > outstanding)
      return {
        ok: false,
        error: `Amount cannot exceed outstanding balance (${outstanding}).`,
      };
  } else if (input.paymentType === "ADVANCE") {
    if (outstanding > 0)
      return {
        ok: false,
        error: "Clear outstanding balance before advance payment.",
      };
    if (activeCharge && activeCharge.balance > 0 && !activeCharge.advanceCovered)
      return { ok: false, error: "Current month must be fully paid first." };

    const advanceMonths = input.advanceMonths ?? 1;
    if (advanceMonths < 1 || advanceMonths > 12)
      return { ok: false, error: "Select 1–12 months for advance payment." };
    amount = student.monthlyFee * advanceMonths;
  }

  try {
    const res = await apiPayFee({
      studentId: student.id,
      amount,
      type: input.paymentType,
    });
    await refreshFees();
    const payment = mapApiPayment(res.payment, s.academicYear);
    payment.receiptNo = res.receiptNumber;
    payment.collectedBy = input.collectedBy ?? "Admin User";
    payment.outstandingAfter = outstandingBalance(student.id, month);
    logAudit(
      "Fee Collection",
      payment.collectedBy,
      `${payment.receiptNo} — ${amount}`,
    );
    return { ok: true, payment };
  } catch (e) {
    return { ok: false, error: apiErr(e, "Payment failed.") };
  }
}

export function dashboardSummary(
  filterMonth?: string,
  academicYear?: string,
): FeeDashboardSummary {
  const s = ensure();
  const month = filterMonth ?? s.activeMonthKey;
  const year = academicYear ?? s.academicYear;
  const students = activeStudents(year);
  const today = new Date().toISOString().slice(0, 10);

  const monthCharges = s.charges.filter(
    (c) => c.academicYear === year && c.monthKey === month,
  );
  const monthPayments = s.payments.filter(
    (p) =>
      p.academicYear === year &&
      p.collectedAt.slice(0, 7) === month.slice(0, 7),
  );

  const totalOutstanding = students.reduce(
    (sum, st) => sum + outstandingBalance(st.id, month),
    0,
  );
  const outstandingThisMonth = monthCharges
    .filter((c) => !c.advanceCovered)
    .reduce((sum, c) => sum + c.balance, 0);

  const collectedToday = s.payments
    .filter((p) => p.academicYear === year && p.collectedAt.slice(0, 10) === today)
    .reduce((sum, p) => sum + p.amount, 0);

  const collectedThisMonth = monthPayments.reduce((sum, p) => sum + p.amount, 0);
  const expectedMonthlyIncome = students.reduce((sum, st) => sum + st.monthlyFee, 0);

  let fullyPaid = 0;
  let partial = 0;
  let advance = 0;
  for (const st of students) {
    const adv = advanceMonthsLeft(st.id, month);
    const out = outstandingBalance(st.id, month);
    if (adv > 0) advance += 1;
    else if (out === 0) fullyPaid += 1;
    else partial += 1;
  }

  const collectionPercentage =
    expectedMonthlyIncome > 0
      ? Math.min(100, (collectedThisMonth / expectedMonthlyIncome) * 100)
      : 0;

  return {
    totalOutstanding,
    outstandingThisMonth,
    collectedToday,
    collectedThisMonth,
    collectionPercentage,
    fullyPaidStudents: fullyPaid,
    partialPayments: partial,
    advancePayments: advance,
    expectedMonthlyIncome,
    netFeeCollection: collectedThisMonth,
    totalActiveStudents: students.length,
  };
}

/** Finance dashboard totals from API (cached call on refresh). */
let financeDashCache: Awaited<ReturnType<typeof apiFinanceDashboard>> | null = null;

export async function refreshFinanceDashboard() {
  try {
    financeDashCache = await apiFinanceDashboard();
  } catch {
    /* ignore */
  }
}

export function paymentSummary(filterMonth?: string): PaymentSummarySlice[] {
  const s = ensure();
  const month = filterMonth ?? s.activeMonthKey;
  const students = activeStudents(s.academicYear);

  let paidCount = 0;
  let unpaidCount = 0;
  let advanceCount = 0;
  let paidAmount = 0;
  let unpaidAmount = 0;
  let advanceAmount = 0;

  for (const st of students) {
    const adv = advanceMonthsLeft(st.id, month);
    const out = outstandingBalance(st.id, month);
    if (adv > 0) {
      advanceCount += 1;
      advanceAmount += st.monthlyFee * adv;
    } else if (out === 0) {
      paidCount += 1;
      paidAmount += st.monthlyFee;
    } else {
      unpaidCount += 1;
      unpaidAmount += out;
    }
  }

  const totalAmount = paidAmount + unpaidAmount + advanceAmount || 1;
  const slices = [
    { name: "Paid", value: paidCount, amount: paidAmount, color: "#22c55e" },
    { name: "Unpaid", value: unpaidCount, amount: unpaidAmount, color: "#ef4444" },
    { name: "Advance", value: advanceCount, amount: advanceAmount, color: "#a855f7" },
  ];

  return slices.map((sl) => ({
    ...sl,
    percent: Math.round((sl.amount / totalAmount) * 1000) / 10,
  }));
}

export function recentPayments(limit = 5): RecentPaymentRow[] {
  const s = ensure();
  const students = getStudentsState().students;
  return s.payments.slice(0, limit).map((p) => {
    const st = students.find((x) => x.id === p.studentId);
    return {
      payment: p,
      studentCode: st?.code ?? "—",
      studentName: st?.fullName ?? "Unknown",
      className: st?.className ?? "—",
      section: st?.section ?? "—",
    };
  });
}

export function listStudentFees(opts: {
  academicYear?: string;
  className?: string;
  section?: string;
  search?: string;
  monthKey?: string;
}): StudentFeeRow[] {
  const s = ensure();
  const month = opts.monthKey ?? s.activeMonthKey;
  // Fall back to a fresh active-year read (not `??`) so an empty snapshot —
  // which happens when the fees store initializes before academics loads —
  // never silently filters every student out.
  const year =
    opts.academicYear || s.academicYear || activeAcademicYear();
  let students = activeStudents(year);

  if (opts.className) students = students.filter((x) => x.className === opts.className);
  if (opts.section) students = students.filter((x) => (x.section ?? "") === opts.section);
  if (opts.search?.trim()) {
    const q = opts.search.trim().toLowerCase();
    students = students.filter(
      (x) =>
        x.fullName.toLowerCase().includes(q) ||
        x.code.toLowerCase().includes(q),
    );
  }

  return students
    .map((st) => {
      const agg = aggregateStudentStatus(st.id, month);
      return {
        studentId: st.id,
        code: st.code,
        fullName: st.fullName,
        className: st.className,
        section: st.section ?? "—",
        monthlyFee: st.monthlyFee,
        outstandingBalance: outstandingBalance(st.id, month),
        status: agg.status,
        advanceMonthsLeft: agg.advanceMonthsLeft,
      };
    })
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
}

export function studentLedger(studentId: string): StudentLedgerRow[] {
  return studentCharges(studentId).map((c) => ({
    monthKey: c.monthKey,
    monthLabel:
      // An extra charge shares its month with the regular fee, so the row is
      // labelled by what it is rather than just the month it lands in.
      c.kind === "EXTRA" && c.label
        ? `${c.label} · ${monthLabel(c.monthKey)}`
        : monthLabel(c.monthKey),
    monthlyCharge: c.monthlyFee,
    amountPaid: c.amountPaid,
    remainingBalance: c.balance,
    status: c.status,
    paymentDate: c.paymentDate,
    chargeId: c.id,
    kind: c.kind,
    label: c.label,
  }));
}

export function getPayment(receiptNo: string): FeePayment | undefined {
  return ensure().payments.find(
    (p) => p.receiptNo === receiptNo || p.id === receiptNo,
  );
}

export function availableMonths(): string[] {
  const s = ensure();
  return [...new Set(s.billingPeriods.map((b) => b.monthKey))].sort();
}

export function outstandingStudents(limit = 10): StudentFeeRow[] {
  const s = ensure();
  return listStudentFees({ monthKey: s.activeMonthKey })
    .filter((r) => r.outstandingBalance > 0)
    .sort((a, b) => b.outstandingBalance - a.outstandingBalance)
    .slice(0, limit);
}

export function canPayThisMonth(studentId: string): boolean {
  if (feeSettingsCache.billingMode === "ACADEMIC_YEAR") {
    return !!earliestUnpaidCharge(studentId);
  }
  const s = ensure();
  const charge = s.charges.find(
    (c) =>
      c.studentId === studentId &&
      c.monthKey === s.activeMonthKey &&
      c.academicYear === s.academicYear,
  );
  if (!charge || charge.advanceCovered) return false;
  return charge.balance > 0;
}

export function canPayPartial(studentId: string): boolean {
  return outstandingBalance(studentId) > 0;
}

export function canPayAdvance(studentId: string): boolean {
  const s = ensure();
  const monthCap =
    feeSettingsCache.billingMode === "ACADEMIC_YEAR"
      ? undefined
      : s.activeMonthKey;
  if (outstandingBalance(studentId, monthCap) > 0) return false;
  const charge =
    feeSettingsCache.billingMode === "ACADEMIC_YEAR"
      ? earliestUnpaidCharge(studentId)
      : s.charges.find(
          (c) =>
            c.studentId === studentId &&
            c.monthKey === s.activeMonthKey &&
            c.academicYear === s.academicYear,
        );
  if (charge && charge.balance > 0 && !charge.advanceCovered) return false;
  return true;
}

export function partialOutstandingMonths(studentId: string): string[] {
  return studentCharges(studentId)
    .filter(
      (c) =>
        c.status !== "INACTIVE" && c.balance > 0 && !c.advanceCovered,
    )
    .map((c) => c.monthKey);
}

/** Per-student annual fee summary from charge records. */
export function studentAnnualSummary(studentId: string) {
  const charges = studentCharges(studentId).filter((c) => c.status !== "INACTIVE");
  const totalDue = charges.reduce((s, c) => s + c.monthlyFee, 0);
  const totalPaid = charges.reduce((s, c) => s + c.amountPaid, 0);
  const outstanding = charges.reduce((s, c) => s + c.balance, 0);
  const paidMonths = charges.filter((c) => c.status === "PAID").length;
  const unpaidMonths = charges.filter(
    (c) => c.status === "UNPAID" || c.status === "PARTIAL",
  ).length;
  const inactiveMonths = studentCharges(studentId).filter(
    (c) => c.status === "INACTIVE",
  ).length;
  return {
    totalDue,
    totalPaid,
    outstanding,
    paidMonths,
    unpaidMonths,
    inactiveMonths,
    totalMonths: charges.length,
    progressPercent:
      charges.length > 0
        ? Math.round((paidMonths / charges.length) * 1000) / 10
        : 0,
  };
}
