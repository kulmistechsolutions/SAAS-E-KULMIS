"use client";

import { useSyncExternalStore } from "react";
import { getState as getStudentsState } from "@/lib/students/store";
import type { Student } from "@/lib/students/types";
import { monthLabel, nextMonthKey, parseMonthKey } from "./format";
import { buildSeed, DEMO_TODAY } from "./seed";
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

const KEY = "ekulmis_fees_v1";

const EMPTY: FeesState = {
  academicYear: "2024-2025",
  activeMonthKey: "2024-05",
  billingPeriods: [],
  charges: [],
  payments: [],
  receiptSeq: 1000,
  audit: [],
};

let state: FeesState | null = null;
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
  if (typeof window !== "undefined") {
    localStorage.setItem(KEY, JSON.stringify(next));
  }
  emit();
}

function ensure(): FeesState {
  if (state) return state;
  if (typeof window === "undefined") return EMPTY;
  const raw = localStorage.getItem(KEY);
  if (raw) {
    try {
      state = JSON.parse(raw) as FeesState;
      return state;
    } catch {
      /* fall through */
    }
  }
  state = buildSeed();
  localStorage.setItem(KEY, JSON.stringify(state));
  return state;
}

export function getFeesState(): FeesState {
  return ensure();
}

export function useFeesState(): FeesState {
  return useSyncExternalStore(subscribe, getFeesState, () => EMPTY);
}

export function resetFees() {
  setState(buildSeed());
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

function recomputeCharge(c: FeeCharge): FeeCharge {
  const balance = Math.max(0, c.monthlyFee - c.amountPaid);
  let status: FeeChargeStatus = "UNPAID";
  if (c.advanceCovered) status = "ADVANCE";
  else if (balance === 0) status = "PAID";
  else if (c.amountPaid > 0) status = "PARTIAL";
  return { ...c, balance, status };
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

export function outstandingBalance(studentId: string, upToMonth?: string): number {
  const charges = studentCharges(studentId);
  const month = upToMonth ?? ensure().activeMonthKey;
  return charges
    .filter((c) => c.monthKey <= month && c.balance > 0 && !c.advanceCovered)
    .reduce((sum, c) => sum + c.balance, 0);
}

export function advanceMonthsLeft(studentId: string, fromMonth: string): number {
  const charges = studentCharges(studentId);
  return charges.filter(
    (c) => c.monthKey >= fromMonth && c.advanceCovered && c.status === "ADVANCE",
  ).length;
}

export function aggregateStudentStatus(
  studentId: string,
  monthKey: string,
): { status: FeeChargeStatus | "ADVANCE_MULTI"; advanceMonthsLeft?: number } {
  const adv = advanceMonthsLeft(studentId, monthKey);
  if (adv > 0) return { status: "ADVANCE_MULTI", advanceMonthsLeft: adv };

  const outstanding = outstandingBalance(studentId, monthKey);
  if (outstanding > 0) {
    const charge = studentCharges(studentId).find((c) => c.monthKey === monthKey);
    if (charge && charge.amountPaid > 0) return { status: "PARTIAL" };
    return { status: "UNPAID" };
  }

  const charge = studentCharges(studentId).find((c) => c.monthKey === monthKey);
  if (charge?.status === "PAID" || charge?.advanceCovered) return { status: "PAID" };
  return { status: "UNPAID" };
}

function applyPaymentToCharges(
  charges: FeeCharge[],
  studentId: string,
  amount: number,
): { touched: string[] } {
  let left = amount;
  const touched: string[] = [];
  const pool = charges
    .filter(
      (c) => c.studentId === studentId && c.balance > 0 && !c.advanceCovered,
    )
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey));

  for (const c of pool) {
    if (left <= 0) break;
    const pay = Math.min(left, c.balance);
    c.amountPaid += pay;
    c.paymentDate = DEMO_TODAY;
    left -= pay;
    touched.push(c.monthKey);
    Object.assign(c, recomputeCharge(c));
  }
  return { touched };
}

export function canActivateNextMonth(at = new Date(DEMO_TODAY)): boolean {
  const s = ensure();
  const { year, month } = parseMonthKey(s.activeMonthKey);
  const day = at.getUTCDate();
  const isActiveMonth =
    at.getUTCFullYear() === year && at.getUTCMonth() + 1 === month;
  return isActiveMonth && day >= 25;
}

export function nextActivatableMonth(): string {
  return nextMonthKey(ensure().activeMonthKey);
}

export function activateNextMonth(user = "Admin User"): { ok: boolean; error?: string } {
  if (!canActivateNextMonth()) {
    return {
      ok: false,
      error: `Next month can only be activated after the 25th of ${monthLabel(ensure().activeMonthKey)}.`,
    };
  }

  const s = ensure();
  const nextKey = nextMonthKey(s.activeMonthKey);
  if (s.billingPeriods.some((b) => b.monthKey === nextKey)) {
    return { ok: false, error: "Next month is already activated." };
  }

  const students = activeStudents(s.academicYear);
  const charges = [...s.charges];
  let seq = charges.length;

  for (const st of students) {
    const advLeft = advanceMonthsLeft(st.id, nextKey);
    seq += 1;
    if (advLeft > 0) {
      charges.push(
        recomputeCharge({
          id: `fc_${seq}`,
          studentId: st.id,
          academicYear: s.academicYear,
          monthKey: nextKey,
          monthlyFee: st.monthlyFee,
          amountPaid: st.monthlyFee,
          balance: 0,
          status: "ADVANCE",
          paymentDate: null,
          advanceCovered: true,
        }),
      );
      continue;
    }

    charges.push(
      recomputeCharge({
        id: `fc_${seq}`,
        studentId: st.id,
        academicYear: s.academicYear,
        monthKey: nextKey,
        monthlyFee: st.monthlyFee,
        amountPaid: 0,
        balance: st.monthlyFee,
        status: "UNPAID",
        paymentDate: null,
      }),
    );
  }

  const billingPeriods = [
    ...s.billingPeriods.map((b) =>
      b.monthKey === s.activeMonthKey ? { ...b, status: "CLOSED" as const } : b,
    ),
    {
      id: `bp_${s.billingPeriods.length + 1}`,
      academicYear: s.academicYear,
      monthKey: nextKey,
      activatedAt: new Date().toISOString(),
      status: "ACTIVE" as const,
    },
  ];

  setState({
    ...s,
    activeMonthKey: nextKey,
    billingPeriods,
    charges,
  });
  logAudit("Month Setup", user, `Activated ${monthLabel(nextKey)}`);
  return { ok: true };
}

export interface PayInput {
  studentId: string;
  paymentType: PaymentType;
  amount?: number;
  advanceMonths?: number;
  collectedBy?: string;
}

export function collectPayment(input: PayInput): {
  ok: boolean;
  error?: string;
  payment?: FeePayment;
} {
  const s = ensure();
  const student = getStudentsState().students.find((x) => x.id === input.studentId);
  if (!student) return { ok: false, error: "Student not found." };

  const month = s.activeMonthKey;
  const outstanding = outstandingBalance(student.id, month);
  const activeCharge = s.charges.find(
    (c) =>
      c.studentId === student.id &&
      c.academicYear === s.academicYear &&
      c.monthKey === month,
  );

  const charges = s.charges.map((c) => ({ ...c }));
  let amount = 0;
  let monthKeys: string[] = [];
  let advanceMonths: number | undefined;

  if (input.paymentType === "THIS_MONTH") {
    if (!activeCharge || activeCharge.advanceCovered)
      return { ok: false, error: "This month is already covered." };
    if (activeCharge.balance === 0)
      return { ok: false, error: "This month is already fully paid." };
    amount = activeCharge.balance;
    const idx = charges.findIndex((c) => c.id === activeCharge.id);
    charges[idx].amountPaid += amount;
    charges[idx].paymentDate = DEMO_TODAY;
    Object.assign(charges[idx], recomputeCharge(charges[idx]));
    monthKeys = [month];
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
    const result = applyPaymentToCharges(charges, student.id, amount);
    monthKeys = result.touched;
  } else if (input.paymentType === "ADVANCE") {
    if (outstanding > 0)
      return {
        ok: false,
        error: "Clear outstanding balance before advance payment.",
      };
    if (activeCharge && activeCharge.balance > 0 && !activeCharge.advanceCovered)
      return { ok: false, error: "Current month must be fully paid first." };

    advanceMonths = input.advanceMonths ?? 1;
    if (advanceMonths < 1 || advanceMonths > 12)
      return { ok: false, error: "Select 1–12 months for advance payment." };

    amount = student.monthlyFee * advanceMonths;
    monthKeys = [];
    let seq = charges.length;
    let mk = nextMonthKey(month);
    for (let i = 0; i < advanceMonths; i++) {
      const existing = charges.find(
        (c) =>
          c.studentId === student.id &&
          c.academicYear === s.academicYear &&
          c.monthKey === mk,
      );
      if (existing) {
        existing.amountPaid = existing.monthlyFee;
        existing.advanceCovered = true;
        existing.paymentDate = DEMO_TODAY;
        Object.assign(existing, recomputeCharge(existing));
      } else {
        seq += 1;
        charges.push(
          recomputeCharge({
            id: `fc_${seq}`,
            studentId: student.id,
            academicYear: s.academicYear,
            monthKey: mk,
            monthlyFee: student.monthlyFee,
            amountPaid: student.monthlyFee,
            balance: 0,
            status: "ADVANCE",
            paymentDate: DEMO_TODAY,
            advanceCovered: true,
          }),
        );
      }
      monthKeys.push(mk);
      mk = nextMonthKey(mk);
    }
  }

  const receiptSeq = s.receiptSeq + 1;
  const payment: FeePayment = {
    id: `fp_${Date.now()}`,
    receiptNo: `RCP-${receiptSeq}`,
    studentId: student.id,
    academicYear: s.academicYear,
    amount,
    paymentType: input.paymentType,
    advanceMonths,
    monthKeys,
    collectedBy: input.collectedBy ?? "Admin User",
    collectedAt: DEMO_TODAY,
    outstandingAfter: outstandingBalance(student.id, month),
  };

  setState({
    ...s,
    charges,
    payments: [payment, ...s.payments],
    receiptSeq,
  });
  logAudit("Fee Collection", payment.collectedBy, `${payment.receiptNo} — ${amount}`);
  return { ok: true, payment };
}

export function dashboardSummary(
  filterMonth?: string,
  academicYear?: string,
): FeeDashboardSummary {
  const s = ensure();
  const month = filterMonth ?? s.activeMonthKey;
  const year = academicYear ?? s.academicYear;
  const students = activeStudents(year);
  const today = DEMO_TODAY.slice(0, 10);

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
  const year = opts.academicYear ?? s.academicYear;
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
    monthLabel: monthLabel(c.monthKey),
    monthlyCharge: c.monthlyFee,
    amountPaid: c.amountPaid,
    remainingBalance: c.balance,
    status: c.status,
    paymentDate: c.paymentDate,
    chargeId: c.id,
  }));
}

export function getPayment(receiptNo: string): FeePayment | undefined {
  return ensure().payments.find((p) => p.receiptNo === receiptNo);
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
  if (outstandingBalance(studentId, s.activeMonthKey) > 0) return false;
  const charge = s.charges.find(
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
    .filter((c) => c.balance > 0 && !c.advanceCovered)
    .map((c) => c.monthKey);
}
