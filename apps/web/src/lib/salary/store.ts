"use client";

import { useSyncExternalStore } from "react";
import { buildSeed } from "./seed";
import { monthKey, monthLabel, netSalary } from "./format";
import type {
  Employee,
  PaySalaryInput,
  PayrollRecord,
  PayrollRow,
  PayrollStatus,
  SalaryDashboardSummary,
  SalaryPayment,
  SalaryState,
} from "./types";

const KEY = "ekulmis_salary_v1";

const EMPTY: SalaryState = {
  employees: [],
  payroll: [],
  payments: [],
  audit: [],
  employeeSeq: 0,
  activePayrollMonth: monthKey(),
  academicYear: "2024-2025",
};

let state: SalaryState | null = null;
const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function emit() {
  listeners.forEach((l) => l());
}

function ensure(): SalaryState {
  if (state) return state;
  if (typeof window === "undefined") return EMPTY;
  const raw = localStorage.getItem(KEY);
  if (raw) {
    try {
      state = JSON.parse(raw) as SalaryState;
      return state;
    } catch {
      /* fall through */
    }
  }
  state = buildSeed();
  localStorage.setItem(KEY, JSON.stringify(state));
  return state;
}

function setState(next: SalaryState) {
  state = next;
  if (typeof window !== "undefined") {
    localStorage.setItem(KEY, JSON.stringify(next));
  }
  emit();
}

export function getSalaryState(): SalaryState {
  return ensure();
}

export function useSalaryState(): SalaryState {
  return useSyncExternalStore(subscribe, getSalaryState, () => EMPTY);
}

export function resetSalary() {
  setState(buildSeed());
}

function logAudit(action: string, employee?: string, detail?: string, user = "Admin User", role = "ADMINISTRATOR") {
  const s = ensure();
  setState({
    ...s,
    audit: [
      {
        id: `sal_${Date.now()}`,
        action,
        user,
        role,
        employee,
        at: new Date().toISOString(),
        detail,
      },
      ...s.audit,
    ].slice(0, 300),
  });
}

function recomputePayroll(p: PayrollRecord): PayrollRecord {
  const remaining = Math.max(0, p.netSalary - p.amountPaid);
  let status: PayrollStatus = "PENDING";
  if (remaining === 0 && p.amountPaid > 0) status = "PAID";
  else if (p.amountPaid > 0) status = "PARTIAL";
  return { ...p, remainingBalance: remaining, status };
}

export function getEmployee(id: string): Employee | undefined {
  return ensure().employees.find((e) => e.id === id || e.code === id || e.teacherId === id);
}

export function getPayroll(id: string): PayrollRecord | undefined {
  return ensure().payroll.find((p) => p.id === id);
}

export function activePayrollMonth(): string {
  return ensure().activePayrollMonth;
}

export function availableMonths(): string[] {
  const s = ensure();
  const set = new Set(s.payroll.map((p) => p.payrollMonth));
  set.add(s.activePayrollMonth);
  return [...set].sort((a, b) => b.localeCompare(a));
}

export function totalSalariesForMonth(month?: string): number {
  const s = ensure();
  const m = month ?? s.activePayrollMonth;
  return s.payroll
    .filter((p) => p.payrollMonth === m)
    .reduce((sum, p) => sum + p.amountPaid, 0);
}

export function totalPayrollDue(month?: string): number {
  const s = ensure();
  const m = month ?? s.activePayrollMonth;
  return s.payroll
    .filter((p) => p.payrollMonth === m)
    .reduce((sum, p) => sum + p.netSalary, 0);
}

export function dashboardSummary(month?: string): SalaryDashboardSummary {
  const s = ensure();
  const m = month ?? s.activePayrollMonth;
  const active = s.employees.filter((e) => e.employmentStatus === "ACTIVE");
  const monthPayroll = s.payroll.filter((p) => p.payrollMonth === m);

  const monthlyPayroll = monthPayroll.reduce((sum, p) => sum + p.netSalary, 0);
  const salariesPaid = monthPayroll.reduce((sum, p) => sum + p.amountPaid, 0);
  const pendingSalaries = monthPayroll.filter((p) => p.status === "PENDING").length;
  const partialPayments = monthPayroll.filter((p) => p.status === "PARTIAL").length;

  const annualPayroll = s.payroll.reduce((sum, p) => sum + p.netSalary, 0);

  return {
    totalEmployees: active.length,
    totalTeachers: active.filter((e) => e.type === "TEACHER").length,
    totalStaff: active.filter((e) => e.type === "STAFF").length,
    monthlyPayroll,
    salariesPaid,
    pendingSalaries,
    partialPayments,
    payrollThisMonth: monthlyPayroll,
    annualPayroll,
  };
}

export function payrollRows(opts?: {
  month?: string;
  position?: string;
  status?: PayrollStatus;
  search?: string;
  type?: string;
}): PayrollRow[] {
  const s = ensure();
  const m = opts?.month ?? s.activePayrollMonth;
  const empMap = new Map(s.employees.map((e) => [e.id, e]));
  const q = opts?.search?.trim().toLowerCase() ?? "";

  let rows = s.payroll.filter((p) => p.payrollMonth === m);

  if (opts?.status) rows = rows.filter((p) => p.status === opts.status);
  if (opts?.position) {
    rows = rows.filter((p) => empMap.get(p.employeeId)?.position === opts.position);
  }
  if (opts?.type) {
    rows = rows.filter((p) => empMap.get(p.employeeId)?.type === opts.type);
  }

  return rows
    .map((p) => {
      const emp = empMap.get(p.employeeId);
      if (!emp) return null;
      if (q) {
        const hay = `${emp.code} ${emp.fullName} ${emp.position}`.toLowerCase();
        if (!hay.includes(q)) return null;
      }
      return {
        payrollId: p.id,
        employeeId: emp.id,
        employeeCode: emp.code,
        employeeName: emp.fullName,
        position: emp.position,
        type: emp.type,
        payrollMonth: p.payrollMonth,
        netSalary: p.netSalary,
        amountPaid: p.amountPaid,
        remainingBalance: p.remainingBalance,
        status: p.status,
      };
    })
    .filter((r): r is PayrollRow => r !== null)
    .sort((a, b) => a.employeeName.localeCompare(b.employeeName));
}

export function employeePayrollHistory(employeeId: string): PayrollRecord[] {
  const emp = getEmployee(employeeId);
  const id = emp?.id ?? employeeId;
  return ensure()
    .payroll.filter((p) => p.employeeId === id)
    .sort((a, b) => b.payrollMonth.localeCompare(a.payrollMonth));
}

export function paymentsForPayroll(payrollId: string): SalaryPayment[] {
  return ensure()
    .payments.filter((p) => p.payrollId === payrollId)
    .sort((a, b) => b.paidAt.localeCompare(a.paidAt));
}

export function generatePayroll(month?: string): { ok: boolean; error?: string; created: number } {
  const s = ensure();
  const payrollMonth = month ?? s.activePayrollMonth;
  const active = s.employees.filter((e) => e.employmentStatus === "ACTIVE");
  const existing = new Set(
    s.payroll
      .filter((p) => p.payrollMonth === payrollMonth)
      .map((p) => p.employeeId),
  );

  const newRecords: PayrollRecord[] = [];
  for (const emp of active) {
    if (existing.has(emp.id)) continue;
    const ns = netSalary(emp.basicSalary, emp.allowances, emp.bonus, emp.deductions);
    newRecords.push({
      id: `pay_${payrollMonth}_${emp.id}`,
      employeeId: emp.id,
      payrollMonth,
      academicYear: s.academicYear,
      basicSalary: emp.basicSalary,
      allowances: emp.allowances,
      bonus: emp.bonus,
      deductions: emp.deductions,
      netSalary: ns,
      amountPaid: 0,
      remainingBalance: ns,
      status: "PENDING",
      generatedAt: new Date().toISOString(),
    });
  }

  if (newRecords.length === 0) {
    return { ok: false, error: "Payroll already generated for all active employees this month.", created: 0 };
  }

  setState({
    ...ensure(),
    payroll: [...newRecords, ...s.payroll],
    activePayrollMonth: payrollMonth,
  });
  logAudit("Salary Generated", undefined, `${newRecords.length} records for ${monthLabel(payrollMonth)}`);
  return { ok: true, created: newRecords.length };
}

export function paySalary(input: PaySalaryInput): {
  ok: boolean;
  error?: string;
  payment?: SalaryPayment;
} {
  const s = ensure();
  const payroll = s.payroll.find((p) => p.id === input.payrollId);
  if (!payroll) return { ok: false, error: "Payroll record not found." };
  if (payroll.status === "PAID") {
    return { ok: false, error: "This payroll month is already fully paid." };
  }
  if (input.amount <= 0) return { ok: false, error: "Payment amount must be greater than zero." };
  if (input.amount > payroll.remainingBalance) {
    return { ok: false, error: "Payment cannot exceed the remaining balance." };
  }

  const emp = s.employees.find((e) => e.id === payroll.employeeId);
  const payment: SalaryPayment = {
    id: `sp_${Date.now()}`,
    payrollId: payroll.id,
    employeeId: payroll.employeeId,
    amount: input.amount,
    paymentMethod: input.paymentMethod,
    paidAt: new Date().toISOString(),
    paidBy: input.paidBy ?? "Admin User",
    notes: input.notes ?? null,
  };

  const updated = recomputePayroll({
    ...payroll,
    amountPaid: payroll.amountPaid + input.amount,
  });

  setState({
    ...ensure(),
    payroll: s.payroll.map((p) => (p.id === payroll.id ? updated : p)),
    payments: [payment, ...s.payments],
  });

  logAudit(
    updated.status === "PAID" ? "Salary Paid" : "Partial Salary Paid",
    emp?.fullName,
    `${money(input.amount)} for ${monthLabel(payroll.payrollMonth)}`,
  );

  return { ok: true, payment };
}

function money(n: number) {
  return `$${n.toLocaleString()}`;
}

export function recentPayments(limit = 8): (SalaryPayment & { employeeName: string; employeeCode: string; month: string })[] {
  const s = ensure();
  const empMap = new Map(s.employees.map((e) => [e.id, e]));
  const payrollMap = new Map(s.payroll.map((p) => [p.id, p]));
  return s.payments.slice(0, limit).map((p) => {
    const emp = empMap.get(p.employeeId);
    const pr = payrollMap.get(p.payrollId);
    return {
      ...p,
      employeeName: emp?.fullName ?? "—",
      employeeCode: emp?.code ?? "—",
      month: pr ? monthLabel(pr.payrollMonth) : "—",
    };
  });
}

export function exportPayrollCsv(rows: PayrollRow[]) {
  const header = "Employee ID,Name,Position,Month,Net Salary,Paid,Balance,Status\n";
  const body = rows
    .map((r) =>
      [
        r.employeeCode,
        r.employeeName,
        r.position,
        r.payrollMonth,
        r.netSalary,
        r.amountPaid,
        r.remainingBalance,
        r.status,
      ].join(","),
    )
    .join("\n");
  const blob = new Blob([header + body], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "payroll.csv";
  a.click();
  URL.revokeObjectURL(url);
}
