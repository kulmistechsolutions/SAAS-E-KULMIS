"use client";

import { useSyncExternalStore } from "react";
import { ApiError } from "@/lib/api";
import {
  getAcademicsState,
  activeAcademicYear as getActiveAcademicYear,
} from "@/lib/academics/store";
import { getState as getStudentsState, withParents } from "@/lib/students/store";
import type { Student } from "@/lib/students/types";
import { studentClassLabel } from "@/lib/students/types";
import {
  apiChargeMonth,
  apiFeeSettings,
  apiFinanceDashboard,
  apiListActivatedMonths,
  apiListCharges,
  apiListPayments,
  apiPayFamily,
  apiPayFee,
  apiPrintHistory,
  apiRecordReceiptPrint,
  apiReversePayment,
  mapApiCharge,
  mapApiPayment,
  type ApiPrintHistory,
} from "./api";
import { monthKey, monthLabel, nextMonthKey, parseMonthKey } from "./format";
import type {
  ClassFeeSummary,
  FamilyFeeRow,
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
  allowAdvance: boolean;
  /** serverClock - deviceClock at the last settings fetch, in ms. */
  clockOffsetMs: number;
} = {
  billingMode: "MONTHLY",
  monthSetupDay: 25,
  allowAdvance: true,
  clockOffsetMs: 0,
};

/**
 * "Now", corrected for whatever gap exists between this device's clock and
 * the server's — a school laptop with its date wrong otherwise blocks or
 * unlocks month setup on the wrong day with no visible reason. Falls back to
 * the device clock before the first successful settings fetch.
 */
function serverNow(): Date {
  return new Date(Date.now() + feeSettingsCache.clockOffsetMs);
}
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

/**
 * The active month and Billing History are keyed off real
 * MonthlyFeeActivation rows (an actual Setup This/Next Month click) — never
 * off FeeCharge dates. A REGISTRATION charge posts to whatever the real
 * calendar month is the moment a student enrolls, and an ADVANCE payment can
 * create genuine MONTHLY FeeCharge rows for a future month a family paid
 * ahead into. Either one landing in a not-yet-set-up month used to be enough
 * to make the frontend call that month "active" and relabel the school's
 * real, actually-set-up month as closed.
 */
function deriveActiveMonth(activatedKeys: string[]): string {
  if (activatedKeys.length === 0) {
    const now = serverNow();
    return monthKey(now.getFullYear(), now.getMonth() + 1);
  }
  return activatedKeys[activatedKeys.length - 1]!;
}

function buildBillingPeriods(
  activatedKeys: string[],
  academicYear: string,
  active: string,
): FeesState["billingPeriods"] {
  return activatedKeys.map((mk, i) => ({
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
    const [chargeRows, paymentRows, feeSettings, activatedMonths] = await Promise.all([
      apiListCharges(),
      apiListPayments(200),
      apiFeeSettings().catch(() => null),
      apiListActivatedMonths().catch(() => []),
    ]);
    if (feeSettings) {
      const parsed = Date.parse(feeSettings.serverNow);
      feeSettingsCache = {
        billingMode: feeSettings.billingMode,
        monthSetupDay: feeSettings.feeMonthSetupDay,
        allowAdvance: feeSettings.feeAllowAdvance,
        clockOffsetMs: Number.isFinite(parsed) ? parsed - Date.now() : 0,
      };
    }
    const activatedKeys = [
      ...new Set(activatedMonths.map((a) => monthKey(a.year, a.month))),
    ].sort();
    const activeMonthKey = deriveActiveMonth(activatedKeys);
    const charges = chargeRows.map((c) => mapApiCharge(c, academicYear, activeMonthKey));
    const payments = paymentRows.map((p) => mapApiPayment(p, academicYear));
    const maxReceipt = payments.reduce((max, p) => {
      const n = Number(p.receiptNo.replace(/\D/g, ""));
      return Number.isFinite(n) && n > max ? n : max;
    }, 1000);

    setState({
      academicYear,
      activeMonthKey,
      billingPeriods: buildBillingPeriods(activatedKeys, academicYear, activeMonthKey),
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

/** Whether the school lets families pay months ahead of the current one. */
export function getFeeAllowAdvance(): boolean {
  return feeSettingsCache.allowAdvance;
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

export function canActivateNextMonth(at = serverNow()): boolean {
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
  /**
   * Settle exactly these charges. Set when the desk picked a named debt —
   * the admission fee, an exam fee, this month, or All — so the money lands
   * on what the receipt is about to say it paid, not merely on the oldest
   * thing owed.
   */
  chargeIds?: string[];
  /** Pre-computed total for a targeted selection; skips the type-based rules. */
  targetedAmount?: number;
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

  // A targeted selection already knows its own total — the charges were
  // picked on screen and their balances summed there.
  if (input.chargeIds && input.targetedAmount !== undefined) {
    amount = input.targetedAmount;
    if (amount <= 0) return { ok: false, error: "Nothing to pay." };
  } else if (input.paymentType === "THIS_MONTH") {
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
      ...(input.chargeIds ? { chargeIds: input.chargeIds } : {}),
    });
    await refreshFees();
    const payment = mapApiPayment(res.payment, s.academicYear);
    payment.receiptNo = res.receiptNumber;
    payment.collectedBy = input.collectedBy ?? "Admin User";
    payment.outstandingAfter = outstandingBalance(student.id, month);
    // The API now says which months this payment actually covered — it used
    // to say nothing, so every receipt printed "Month(s): —" no matter what
    // was paid.
    payment.monthKeys = res.monthKeys ?? [];
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

/**
 * Reverse a payment recorded wrong (wrong amount, wrong student, mistaken
 * entry). Never edits or deletes the original — the API creates a linked,
 * negative transaction so the receipt trail proves both the collection and
 * its undo.
 */
export async function reversePayment(
  paymentId: string,
  reason: string,
  actorName?: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await apiReversePayment(paymentId, reason);
    await refreshFees();
    logAudit(
      "Payment Reversal",
      actorName ?? "Admin User",
      `${res.originalReceiptNumber} reversed (${res.reversalReceiptNumber}) — ${reason}`,
    );
    return { ok: true };
  } catch (e) {
    return { ok: false, error: apiErr(e, "Failed to reverse payment.") };
  }
}

/** Fire-and-forget: records a receipt print so the school can count how many actually happened. */
export function recordReceiptPrint(paymentId: string): void {
  void apiRecordReceiptPrint(paymentId).catch(() => {});
}

export async function loadPrintHistory(filters: {
  dateFrom?: string;
  dateTo?: string;
  type?: PaymentType;
}): Promise<ApiPrintHistory> {
  try {
    return await apiPrintHistory(filters);
  } catch {
    return { total: 0, logs: [] };
  }
}

export async function collectFamilyPayment(input: {
  parentId: string;
  amount: number;
  collectedBy?: string;
}): Promise<{
  ok: boolean;
  error?: string;
  result?: {
    parentName: string;
    totalApplied: number;
    unallocated: number;
    receipts: { studentId: string; studentName: string; receiptNumber: string; amountApplied: number }[];
  };
}> {
  if (!input.amount || input.amount <= 0) {
    return { ok: false, error: "Enter a valid payment amount." };
  }
  try {
    const res = await apiPayFamily({
      parentId: input.parentId,
      amount: input.amount,
    });
    await refreshFees();
    logAudit(
      "Family Fee Collection",
      input.collectedBy ?? "Admin User",
      `${res.parentName} — ${res.totalApplied} across ${res.receipts.length} student(s)`,
    );
    return { ok: true, result: res };
  } catch (e) {
    return { ok: false, error: apiErr(e, "Payment failed.") };
  }
}

/** Whether a student has ever actually been billed for/through this month —
 *  distinct from owing nothing. A student with no monthly fee setup yet has
 *  no charge rows at all, so outstandingBalance() trivially reads 0; without
 *  this check they'd be miscounted as "fully paid" despite never having paid
 *  (or owed) anything. */
function hasBeenCharged(studentId: string, upToMonth?: string): boolean {
  const charges = studentCharges(studentId);
  const allBillable =
    feeSettingsCache.billingMode === "ACADEMIC_YEAR" && upToMonth === undefined;
  const month = upToMonth ?? ensure().activeMonthKey;
  return charges.some(
    (c) => c.status !== "INACTIVE" && (allBillable || c.monthKey <= month),
  );
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

  // Money totals come from the server, which sums every payment in SQL. Adding
  // them up here instead meant adding up the page of payments the browser had
  // cached — WIN STAR, past that page, reported $1,138 collected against a
  // real $1,239. The student counts below still come from charges, which are
  // loaded in full.
  const serverFinance =
    financeDashCache && financeDashCache.month === month.slice(0, 7)
      ? financeDashCache
      : null;

  const collectedToday =
    serverFinance?.feeCollectedToday ??
    s.payments
      .filter((p) => p.academicYear === year && p.collectedAt.slice(0, 10) === today)
      .reduce((sum, p) => sum + p.amount, 0);

  const collectedThisMonth =
    serverFinance?.feeIncome ??
    monthPayments.reduce((sum, p) => sum + p.amount, 0);
  // A waived student's stored monthlyFee is never actually charged, so it
  // would inflate "expected income" with money that can never arrive.
  const expectedMonthlyIncome = students.reduce(
    (sum, st) => sum + (st.feeWaived ? 0 : st.monthlyFee),
    0,
  );

  let fullyPaid = 0;
  let partial = 0;
  let advance = 0;
  let free = 0;
  for (const st of students) {
    // Never charged anything — has no payment behavior to report, so it
    // doesn't belong in fullyPaid/partial/advance at all.
    if (st.feeWaived || st.monthlyFee === 0) {
      free += 1;
      continue;
    }
    // No monthly fee setup activated for this student yet — they haven't
    // been billed, so they can't be "fully paid" either.
    if (!hasBeenCharged(st.id, month)) continue;
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
    freeStudents: free,
    expectedMonthlyIncome,
    netFeeCollection: collectedThisMonth,
    totalActiveStudents: students.length,
  };
}

/**
 * The server's ledger-wide money totals for one month. The fee dashboard reads
 * these instead of summing its own cached payments, which is only ever the
 * newest page of them.
 */
let financeDashCache: Awaited<ReturnType<typeof apiFinanceDashboard>> | null = null;

export async function refreshFinanceDashboard(month?: string): Promise<void> {
  const key = month?.slice(0, 7);
  try {
    financeDashCache = await apiFinanceDashboard(key);
  } catch {
    // Drop it rather than show another month's totals as though they were
    // this one's; dashboardSummary falls back to what it has cached.
    financeDashCache = null;
  }
  emit();
}

export function paymentSummary(filterMonth?: string): PaymentSummarySlice[] {
  const s = ensure();
  const month = filterMonth ?? s.activeMonthKey;
  const students = activeStudents(s.academicYear);

  let paidCount = 0;
  let unpaidCount = 0;
  let advanceCount = 0;
  let freeCount = 0;
  let paidAmount = 0;
  let unpaidAmount = 0;
  let advanceAmount = 0;

  for (const st of students) {
    // Never charged anything — money never moved for this student, so it
    // can't count as "Paid" (that would credit them with income that was
    // never actually collected, especially when a waived student still has
    // a nonzero stored monthlyFee from before they were waived).
    if (st.feeWaived || st.monthlyFee === 0) {
      freeCount += 1;
      continue;
    }
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
    { name: "Free", value: freeCount, amount: 0, color: "#14b8a6" },
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
      className: st ? studentClassLabel(st) : "—",
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
  /** Matches the badge shown per row — "ADVANCE_MULTI" included since that's
   *  what a student paid several months ahead actually displays as. */
  status?: FeeChargeStatus | "ADVANCE_MULTI";
}): StudentFeeRow[] {
  const s = ensure();
  const month = opts.monthKey ?? s.activeMonthKey;
  // Fall back to a fresh active-year read (not `??`) so an empty snapshot —
  // which happens when the fees store initializes before academics loads —
  // never silently filters every student out.
  const year =
    opts.academicYear || s.academicYear || activeAcademicYear();
  let students = withParents(getStudentsState()).filter(
    (x) => x.status === "ACTIVE" && x.academicYear === year,
  );

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

  let rows = students
    .map((st) => {
      const agg = aggregateStudentStatus(st.id, month);
      return {
        studentId: st.id,
        code: st.code,
        fullName: st.fullName,
        className: studentClassLabel(st),
        section: st.section ?? "—",
        monthlyFee: st.monthlyFee,
        feeWaived: st.feeWaived ?? false,
        outstandingBalance: outstandingBalance(st.id, month),
        status: agg.status,
        advanceMonthsLeft: agg.advanceMonthsLeft,
        parentId: st.parentId,
        parentName: st.parent.name,
        parentPhone: st.parent.phone,
      };
    })
    .sort((a, b) => a.fullName.localeCompare(b.fullName));

  // Applied after the per-student status is computed — it isn't known until
  // aggregateStudentStatus runs, so it can't join the earlier student-level
  // filters above.
  if (opts.status) rows = rows.filter((r) => r.status === opts.status);

  return rows;
}

/**
 * One card per class for the Collect Fees entry screen — this month's
 * students/paid/advance/partial counts and the money still owed, so an admin
 * sees which classes need attention before drilling into any one of them.
 * Grouped by each student's home class (the one billing is keyed to), same
 * as `listStudentFees` — a student's extra classes never split their charge.
 */
export function classFeeSummaries(
  academicYear?: string,
  monthKey?: string,
): ClassFeeSummary[] {
  const s = ensure();
  const year = academicYear || s.academicYear || activeAcademicYear();
  const month = monthKey ?? s.activeMonthKey;
  const rows = listStudentFees({ academicYear: year, monthKey: month });

  const byClass = new Map<string, ClassFeeSummary>();
  for (const r of rows) {
    const key = r.className.split(" + ")[0];
    let summary = byClass.get(key);
    if (!summary) {
      summary = {
        className: key,
        totalStudents: 0,
        paidStudents: 0,
        advanceStudents: 0,
        partialStudents: 0,
        freeStudents: 0,
        outstandingAmount: 0,
      };
      byClass.set(key, summary);
    }
    summary.totalStudents++;
    if (r.feeWaived || r.monthlyFee === 0) {
      summary.freeStudents++;
    } else if (r.status === "ADVANCE_MULTI" || r.status === "ADVANCE") {
      summary.advanceStudents++;
    } else if (r.status === "PARTIAL") {
      summary.partialStudents++;
      summary.outstandingAmount += r.outstandingBalance;
    } else if (r.status === "PAID") {
      summary.paidStudents++;
    } else {
      summary.outstandingAmount += r.outstandingBalance;
    }
  }

  return [...byClass.values()].sort((a, b) =>
    a.className.localeCompare(b.className, undefined, { numeric: true }),
  );
}

/**
 * Siblings often land in different classes, so the by-class Collect Fees
 * screen can't find them together. This groups active students by parent —
 * matching on parent name/phone as well as any child's name/ID — so a
 * family can be found and settled in one place regardless of which classes
 * its children are actually in.
 */
export function listFamilies(opts: {
  academicYear?: string;
  search?: string;
  monthKey?: string;
}): FamilyFeeRow[] {
  const s = ensure();
  const month = opts.monthKey ?? s.activeMonthKey;
  const year = opts.academicYear || s.academicYear || activeAcademicYear();
  const students = withParents(getStudentsState()).filter(
    (x) => x.status === "ACTIVE" && x.academicYear === year,
  );

  const q = opts.search?.trim().toLowerCase();
  const byParent = new Map<string, typeof students>();
  for (const st of students) {
    const matches =
      !q ||
      st.fullName.toLowerCase().includes(q) ||
      st.code.toLowerCase().includes(q) ||
      st.parent.name.toLowerCase().includes(q) ||
      st.parent.phone.toLowerCase().includes(q);
    if (!matches) continue;
    const group = byParent.get(st.parentId) ?? [];
    group.push(st);
    byParent.set(st.parentId, group);
  }

  const families: FamilyFeeRow[] = [];
  for (const [parentId, siblings] of byParent) {
    const children = siblings
      .map((st) => {
        const agg = aggregateStudentStatus(st.id, month);
        return {
          studentId: st.id,
          code: st.code,
          fullName: st.fullName,
          className: studentClassLabel(st),
          section: st.section ?? "—",
          outstandingBalance: outstandingBalance(st.id, month),
          status: agg.status,
        };
      })
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
    families.push({
      parentId,
      parentCode: siblings[0]!.parent.code,
      parentName: siblings[0]!.parent.name,
      parentPhone: siblings[0]!.parent.phone,
      children,
      totalOutstanding: children.reduce((sum, c) => sum + c.outstandingBalance, 0),
    });
  }

  return families.sort((a, b) => a.parentName.localeCompare(b.parentName));
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
        c.status !== "INACTIVE" &&
        c.balance > 0 &&
        !c.advanceCovered &&
        // A registration or exam fee is not a month. Listing it under
        // "Outstanding Month(s)" told a school it still owed August when
        // August's tuition was never the debt — the admission fee was.
        c.kind === "MONTHLY",
    )
    .map((c) => c.monthKey);
}

export interface OutstandingLine {
  key: string;
  /** Ready to show: a month name, or the charge's own label. */
  label: string;
  balance: number;
}

export interface OutstandingBreakdown {
  /** The month the school is currently collecting, if it is still owed. */
  thisMonth: OutstandingLine | null;
  /** Earlier months left unpaid — arrears, owed on top of this month. */
  arrears: OutstandingLine[];
  /** Registration, exam and other one-off charges, which are not months. */
  other: OutstandingLine[];
  total: number;
}

/**
 * What a student owes, split the way the person at the desk thinks about it.
 *
 * One lump "Outstanding: $5" over a list headed "Month(s)" could not say
 * whether that was this month's tuition, a leftover from a month already
 * closed, or an admission fee — and it named non-month charges as months.
 * Each part is separated here so the desk sees this month's fee, what is
 * still carried from before, and anything that is not tuition at all.
 */
export function outstandingBreakdown(studentId: string): OutstandingBreakdown {
  const s = ensure();
  const active = s.activeMonthKey;
  const open = studentCharges(studentId).filter(
    (c) => c.status !== "INACTIVE" && c.balance > 0 && !c.advanceCovered,
  );

  let thisMonth: OutstandingLine | null = null;
  const arrears: OutstandingLine[] = [];
  const other: OutstandingLine[] = [];

  for (const c of open) {
    if (c.kind !== "MONTHLY") {
      other.push({
        key: c.id,
        label: c.label || monthLabel(c.monthKey),
        balance: c.balance,
      });
      continue;
    }
    if (c.monthKey > active) continue; // not due yet
    const line = { key: c.id, label: monthLabel(c.monthKey), balance: c.balance };
    if (c.monthKey === active) thisMonth = line;
    else arrears.push(line);
  }

  arrears.sort((a, b) => a.label.localeCompare(b.label));
  const total =
    (thisMonth?.balance ?? 0) +
    arrears.reduce((n, l) => n + l.balance, 0) +
    other.reduce((n, l) => n + l.balance, 0);

  return { thisMonth, arrears, other, total };
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
