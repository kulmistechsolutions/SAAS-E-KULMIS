"use client";

import { useSyncExternalStore } from "react";
import { dashboardSummary as feeDashboard } from "@/lib/fees/store";
import { totalSalariesForMonth } from "@/lib/salary/store";
import { ACTIVE_ACADEMIC_YEAR } from "@/lib/students/constants";
import { buildSeed } from "./seed";
import { monthKey, referenceNo } from "./format";
import type {
  CreateCategoryInput,
  CreateExpenseInput,
  Expense,
  ExpenseDashboardSummary,
  ExpenseRow,
  ExpenseSortDir,
  ExpenseSortKey,
  ExpensesState,
  UpdateExpenseInput,
} from "./types";

const KEY = "ekulmis_expenses_v1";

const EMPTY: ExpensesState = {
  categories: [],
  expenses: [],
  recurring: [],
  audit: [],
  expenseSeq: 0,
  academicYear: ACTIVE_ACADEMIC_YEAR,
  maxAttachmentMb: 5,
};

let state: ExpensesState | null = null;
const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function emit() {
  listeners.forEach((l) => l());
}

function ensure(): ExpensesState {
  if (state) return state;
  if (typeof window === "undefined") return EMPTY;
  const raw = localStorage.getItem(KEY);
  if (raw) {
    try {
      state = JSON.parse(raw) as ExpensesState;
      return state;
    } catch {
      /* fall through */
    }
  }
  state = buildSeed();
  localStorage.setItem(KEY, JSON.stringify(state));
  return state;
}

function setState(next: ExpensesState) {
  state = next;
  if (typeof window !== "undefined") {
    localStorage.setItem(KEY, JSON.stringify(next));
  }
  emit();
}

export function getExpensesState(): ExpensesState {
  return ensure();
}

export function useExpensesState(): ExpensesState {
  return useSyncExternalStore(subscribe, getExpensesState, () => EMPTY);
}

export function resetExpenses() {
  setState(buildSeed());
}

function logAudit(
  action: string,
  referenceNo?: string,
  detail?: string,
  user = "Admin User",
  role = "ADMINISTRATOR",
) {
  const s = ensure();
  setState({
    ...s,
    audit: [
      {
        id: `exp_audit_${Date.now()}`,
        action,
        user,
        role,
        referenceNo,
        at: new Date().toISOString(),
        detail,
      },
      ...s.audit,
    ].slice(0, 300),
  });
}

function activeExpenses(year?: string): Expense[] {
  const y = year ?? ensure().academicYear;
  return ensure().expenses.filter(
    (e) => e.status !== "DELETED" && e.academicYear === y,
  );
}

export function getExpense(id: string): Expense | undefined {
  return ensure().expenses.find((e) => e.id === id || e.referenceNo === id);
}

export function getCategory(id: string) {
  return ensure().categories.find((c) => c.id === id);
}

export function categoryName(id: string): string {
  return getCategory(id)?.name ?? "—";
}

export function totalExpenses(opts?: {
  academicYear?: string;
  month?: string;
  dateFrom?: string;
  dateTo?: string;
}): number {
  let list = activeExpenses(opts?.academicYear);
  if (opts?.month) {
    list = list.filter((e) => e.expenseDate.slice(0, 7) === opts.month);
  }
  if (opts?.dateFrom) {
    list = list.filter((e) => e.expenseDate >= opts.dateFrom!);
  }
  if (opts?.dateTo) {
    list = list.filter((e) => e.expenseDate <= opts.dateTo!);
  }
  return list.reduce((sum, e) => sum + e.amount, 0);
}

export function dashboardSummary(opts?: {
  academicYear?: string;
  month?: string;
}): ExpenseDashboardSummary {
  const s = ensure();
  const year = opts?.academicYear ?? s.academicYear;
  const month = opts?.month ?? monthKey();
  const today = new Date().toISOString().slice(0, 10);

  const yearExpenses = activeExpenses(year);
  const monthExpenses = yearExpenses.filter(
    (e) => e.expenseDate.slice(0, 7) === month.slice(0, 7),
  );
  const todayExpenses = yearExpenses.filter((e) => e.expenseDate === today);

  const catTotals = new Map<string, number>();
  for (const e of monthExpenses) {
    const name = categoryName(e.categoryId);
    catTotals.set(name, (catTotals.get(name) ?? 0) + e.amount);
  }
  let highest = "—";
  let highestAmt = 0;
  for (const [name, amt] of catTotals) {
    if (amt > highestAmt) {
      highestAmt = amt;
      highest = name;
    }
  }

  const feeSum = feeDashboard(month, year);
  const totalIncome = feeSum.collectedThisMonth + feeSum.collectedToday;
  const totalSalaries = totalSalariesForMonth(month);
  const totalExp = monthExpenses.reduce((sum, e) => sum + e.amount, 0);
  const netIncome = totalIncome - totalSalaries - totalExp;

  const activeCats = s.categories.filter((c) => c.status === "ACTIVE");

  return {
    totalExpensesToday: todayExpenses.reduce((sum, e) => sum + e.amount, 0),
    totalExpensesThisMonth: totalExp,
    totalExpensesThisYear: yearExpenses.reduce((sum, e) => sum + e.amount, 0),
    totalCategories: activeCats.length,
    highestExpenseCategory: highest,
    pendingExpenses: yearExpenses.filter((e) => e.status === "PENDING").length,
    netIncome,
    totalFinancialOutflow: totalExp + totalSalaries,
    totalIncome,
    totalSalaries,
  };
}

export function expensesByCategory(month?: string, year?: string) {
  const y = year ?? ensure().academicYear;
  const m = month ?? monthKey();
  const map = new Map<string, number>();
  for (const e of activeExpenses(y)) {
    if (e.expenseDate.slice(0, 7) !== m.slice(0, 7)) continue;
    const name = categoryName(e.categoryId);
    map.set(name, (map.get(name) ?? 0) + e.amount);
  }
  return [...map.entries()]
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);
}

export function listExpenses(opts?: {
  academicYear?: string;
  categoryId?: string;
  paymentMethod?: string;
  dateFrom?: string;
  dateTo?: string;
  recordedBy?: string;
  search?: string;
  sortKey?: ExpenseSortKey;
  sortDir?: ExpenseSortDir;
}): ExpenseRow[] {
  const s = ensure();
  const q = opts?.search?.trim().toLowerCase() ?? "";
  let list = activeExpenses(opts?.academicYear);

  if (opts?.categoryId) list = list.filter((e) => e.categoryId === opts.categoryId);
  if (opts?.paymentMethod) {
    list = list.filter((e) => e.paymentMethod === opts.paymentMethod);
  }
  if (opts?.dateFrom) list = list.filter((e) => e.expenseDate >= opts.dateFrom!);
  if (opts?.dateTo) list = list.filter((e) => e.expenseDate <= opts.dateTo!);
  if (opts?.recordedBy) {
    list = list.filter((e) =>
      e.recordedBy.toLowerCase().includes(opts.recordedBy!.toLowerCase()),
    );
  }

  const rows: ExpenseRow[] = list
    .filter((e) => {
      if (!q) return true;
      const cat = categoryName(e.categoryId);
      const hay = `${e.referenceNo} ${e.title} ${cat} ${e.paidTo}`.toLowerCase();
      return hay.includes(q);
    })
    .map((e, i) => ({
      id: e.id,
      serial: i + 1,
      referenceNo: e.referenceNo,
      title: e.title,
      categoryName: categoryName(e.categoryId),
      amount: e.amount,
      paymentMethod: e.paymentMethod,
      expenseDate: e.expenseDate,
      recordedBy: e.recordedBy,
      paidTo: e.paidTo,
      status: e.status,
    }));

  const key = opts?.sortKey ?? "expenseDate";
  const dir = opts?.sortDir ?? "desc";
  rows.sort((a, b) => {
    let cmp = 0;
    if (key === "amount") cmp = a.amount - b.amount;
    else if (key === "category") cmp = a.categoryName.localeCompare(b.categoryName);
    else if (key === "title") cmp = a.title.localeCompare(b.title);
    else cmp = a.expenseDate.localeCompare(b.expenseDate);
    return dir === "asc" ? cmp : -cmp;
  });

  return rows.map((r, i) => ({ ...r, serial: i + 1 }));
}

export function recentExpenses(limit = 8): ExpenseRow[] {
  return listExpenses({ sortKey: "expenseDate", sortDir: "desc" }).slice(0, limit);
}

export function createExpense(
  input: CreateExpenseInput,
): { ok: boolean; error?: string; expense?: Expense } {
  const s = ensure();
  if (!input.title.trim()) return { ok: false, error: "Expense title is required." };
  if (!input.categoryId) return { ok: false, error: "Category is required." };
  const cat = getCategory(input.categoryId);
  if (!cat) return { ok: false, error: "Invalid category." };
  if (cat.status === "INACTIVE") {
    return { ok: false, error: "Cannot use an inactive category." };
  }
  if (!input.amount || input.amount <= 0) {
    return { ok: false, error: "Amount must be greater than zero." };
  }
  if (!input.paymentMethod) return { ok: false, error: "Payment method is required." };

  const seq = s.expenseSeq + 1;
  const now = new Date().toISOString();
  const expense: Expense = {
    id: `exp_${Date.now()}`,
    referenceNo: referenceNo(seq),
    title: input.title.trim(),
    categoryId: input.categoryId,
    amount: input.amount,
    expenseDate: input.expenseDate,
    academicYear: input.academicYear ?? s.academicYear,
    paymentMethod: input.paymentMethod,
    paidTo: input.paidTo.trim() || "—",
    description: input.description ?? null,
    attachment: input.attachment ?? null,
    recordedBy: input.recordedBy ?? "Finance Officer",
    status: input.status ?? "RECORDED",
    createdAt: now,
    updatedAt: now,
  };

  setState({
    ...ensure(),
    expenses: [expense, ...s.expenses],
    expenseSeq: seq,
  });
  logAudit("Expense Created", expense.referenceNo, expense.title);
  if (input.attachment) logAudit("Attachment Uploaded", expense.referenceNo);
  return { ok: true, expense };
}

export function updateExpense(
  input: UpdateExpenseInput,
): { ok: boolean; error?: string; expense?: Expense } {
  const s = ensure();
  const existing = s.expenses.find((e) => e.id === input.id);
  if (!existing || existing.status === "DELETED") {
    return { ok: false, error: "Expense not found." };
  }
  if (input.amount !== undefined && input.amount <= 0) {
    return { ok: false, error: "Amount must be greater than zero." };
  }
  if (input.categoryId) {
    const cat = getCategory(input.categoryId);
    if (!cat) return { ok: false, error: "Invalid category." };
    if (cat.status === "INACTIVE") {
      return { ok: false, error: "Cannot use an inactive category." };
    }
  }

  const updated: Expense = {
    ...existing,
    title: input.title?.trim() ?? existing.title,
    categoryId: input.categoryId ?? existing.categoryId,
    amount: input.amount ?? existing.amount,
    expenseDate: input.expenseDate ?? existing.expenseDate,
    paymentMethod: input.paymentMethod ?? existing.paymentMethod,
    paidTo: input.paidTo?.trim() ?? existing.paidTo,
    description: input.description !== undefined ? input.description : existing.description,
    attachment: input.attachment !== undefined ? input.attachment : existing.attachment,
    status: input.status ?? existing.status,
    updatedAt: new Date().toISOString(),
  };

  setState({
    ...ensure(),
    expenses: s.expenses.map((e) => (e.id === existing.id ? updated : e)),
  });
  logAudit("Expense Updated", updated.referenceNo);
  return { ok: true, expense: updated };
}

export function deleteExpense(id: string): { ok: boolean; error?: string } {
  const s = ensure();
  const existing = s.expenses.find((e) => e.id === id);
  if (!existing || existing.status === "DELETED") {
    return { ok: false, error: "Expense not found." };
  }
  const updated = {
    ...existing,
    status: "DELETED" as const,
    updatedAt: new Date().toISOString(),
  };
  setState({
    ...ensure(),
    expenses: s.expenses.map((e) => (e.id === id ? updated : e)),
  });
  logAudit("Expense Deleted", existing.referenceNo);
  return { ok: true };
}

export function createCategory(
  input: CreateCategoryInput,
): { ok: boolean; error?: string } {
  const s = ensure();
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Category name is required." };
  if (s.categories.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
    return { ok: false, error: "Category already exists." };
  }
  setState({
    ...ensure(),
    categories: [
      ...s.categories,
      {
        id: `cat_${Date.now()}`,
        name,
        status: "ACTIVE",
        createdAt: new Date().toISOString(),
      },
    ],
  });
  return { ok: true };
}

export function toggleCategoryStatus(id: string): { ok: boolean; error?: string } {
  const s = ensure();
  const cat = s.categories.find((c) => c.id === id);
  if (!cat) return { ok: false, error: "Category not found." };
  setState({
    ...ensure(),
    categories: s.categories.map((c) =>
      c.id === id
        ? { ...c, status: c.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" }
        : c,
    ),
  });
  return { ok: true };
}

export function generateRecurringDue(): number {
  const s = ensure();
  const today = new Date().toISOString().slice(0, 10);
  let created = 0;

  for (const rec of s.recurring.filter((r) => r.active)) {
    if (rec.nextDueDate > today) continue;
    const res = createExpense({
      title: rec.title,
      categoryId: rec.categoryId,
      amount: rec.amount,
      expenseDate: rec.nextDueDate,
      academicYear: rec.academicYear,
      paymentMethod: rec.paymentMethod,
      paidTo: rec.paidTo,
      description: rec.description ?? `Auto-generated recurring expense (${rec.frequency})`,
      recordedBy: "System",
    });
    if (res.ok) {
      created += 1;
      const next = new Date(rec.nextDueDate);
      if (rec.frequency === "MONTHLY") next.setMonth(next.getMonth() + 1);
      else if (rec.frequency === "QUARTERLY") next.setMonth(next.getMonth() + 3);
      else next.setFullYear(next.getFullYear() + 1);
      setState({
        ...getExpensesState(),
        recurring: getExpensesState().recurring.map((r) =>
          r.id === rec.id ? { ...r, nextDueDate: next.toISOString().slice(0, 10) } : r,
        ),
      });
    }
  }
  return created;
}

export function exportExpensesCsv(rows: ExpenseRow[]) {
  const header =
    "Reference,Title,Category,Amount,Payment Method,Date,Vendor,Recorded By,Status\n";
  const body = rows
    .map((r) =>
      [
        r.referenceNo,
        `"${r.title}"`,
        r.categoryName,
        r.amount,
        r.paymentMethod,
        r.expenseDate,
        `"${r.paidTo}"`,
        r.recordedBy,
        r.status,
      ].join(","),
    )
    .join("\n");
  const blob = new Blob([header + body], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "expenses.csv";
  a.click();
  URL.revokeObjectURL(url);
  logAudit("Expense Exported", undefined, `${rows.length} rows`);
}
