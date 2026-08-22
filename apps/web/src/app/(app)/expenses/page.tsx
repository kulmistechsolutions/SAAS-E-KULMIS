"use client";


import { useT } from "@/lib/i18n/provider";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Calendar, ChevronRight, FileText, List, Plus, Tags } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  ExpenseSummaryCards,
  FinancialSummaryPanel,
} from "@/components/expenses/summary-cards";
import { CategoryBadge } from "@/components/expenses/category-badge";
import { ExpenseFormDialog } from "@/components/expenses/expense-form-dialog";
import { money, monthKey, monthLabel } from "@/lib/expenses/format";
import {
  dashboardSummary,
  expensesByCategory,
  generateRecurringDue,
  recentExpenses,
  refreshFinanceForMonth,
  useExpensesState,
} from "@/lib/expenses/store";
import { AcademicYearSelect } from "@/components/academics/academic-year-select";
import { toast } from "@/lib/toast";

const QUICK = [
  { href: "/expenses/list", label: "Expense List", desc: "Search, filter & manage", icon: List },
  { href: "/expenses/categories", label: "Categories", desc: "Custom expense categories", icon: Tags },
  { href: "/expenses/reports", label: "Reports", desc: "Print, PDF & CSV exports", icon: FileText },
];

export default function ExpensesDashboardPage() {
  const t = useT();
  const [mounted, setMounted] = useState(false);
  const state = useExpensesState();
  const [filterYear, setFilterYear] = useState("");
  const [filterMonth, setFilterMonth] = useState("");
  const [showForm, setShowForm] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!mounted) return;
    setFilterYear(state.academicYear);
    setFilterMonth(monthKey());
  }, [mounted, state.academicYear]);

  // Income, salaries and net income are the server's — refetch whenever the
  // month changes so the cards never show another month's figures.
  useEffect(() => {
    if (!mounted || !filterMonth) return;
    void refreshFinanceForMonth(filterMonth);
  }, [mounted, filterMonth]);

  const summary = useMemo(
    () => (mounted ? dashboardSummary({ academicYear: filterYear, month: filterMonth }) : null),
    [mounted, filterYear, filterMonth, state],
  );
  const recent = useMemo(() => (mounted ? recentExpenses(8) : []), [mounted, state]);
  const breakdown = useMemo(
    () => (mounted ? expensesByCategory(filterMonth, filterYear) : []),
    [mounted, filterMonth, filterYear, state],
  );

  function handleRecurring() {
    const n = generateRecurringDue();
    toast(n > 0 ? `Generated ${n} recurring expense(s)` : "No recurring expenses due", "info");
  }

  if (!mounted) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        {t("expenses.loadingExpenses")}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("expenses.expenseManagement")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("expenses.trackOperationalExpendituresAndNetIncome")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <AcademicYearSelect
              value={filterYear}
              onChange={setFilterYear}
              className="h-8 min-w-[120px] border-0 bg-transparent py-0 shadow-none"
            />
          </div>
          <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm">
            <span className="text-muted-foreground">{t("expenses.month")}</span>
            <Select
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="h-8 min-w-[140px] border-0 bg-transparent py-0 shadow-none"
            >
              {[filterMonth, monthKey()].filter((v, i, a) => a.indexOf(v) === i).map((m) => (
                <option key={m} value={m}>
                  {monthLabel(m)}
                </option>
              ))}
            </Select>
          </div>
          <Button className="h-9" onClick={() => setShowForm(true)}>
            <Plus className="me-2 h-4 w-4" />
            {t("expenses.recordExpense")}
          </Button>
        </div>
      </div>

      {summary && <ExpenseSummaryCards summary={summary} />}

      <div className="grid gap-4 sm:grid-cols-3">
        {QUICK.map((q) => (
          <Link
            key={q.href}
            href={q.href}
            className="group rounded-xl border bg-card p-4 shadow-sm transition hover:border-primary/30 hover:shadow-md"
          >
            <div className="flex items-start justify-between">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <q.icon className="h-5 w-5" />
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
            </div>
            <p className="mt-3 font-semibold">{q.label}</p>
            <p className="mt-1 text-xs text-muted-foreground">{q.desc}</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-xl border bg-card shadow-sm">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h2 className="font-semibold">{t("expenses.recentExpenses")}</h2>
              <Link href="/expenses/list" className="text-xs font-medium text-primary hover:underline">
                {t("expenses.viewAll")}
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary text-start text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">{t("expenses.reference")}</th>
                    <th className="px-4 py-2 font-medium">{t("expenses.title")}</th>
                    <th className="px-4 py-2 font-medium">{t("expenses.category")}</th>
                    <th className="px-4 py-2 font-medium">{t("expenses.amount")}</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((r) => (
                    <tr key={r.id} className="border-t">
                      <td className="px-4 py-2.5 font-mono text-xs text-primary">
                        <Link href={`/expenses/${r.id}`}>{r.referenceNo}</Link>
                      </td>
                      <td className="px-4 py-2.5">{r.title}</td>
                      <td className="px-4 py-2.5">
                        <CategoryBadge name={r.categoryName} />
                      </td>
                      <td className="px-4 py-2.5 tabular-nums font-medium text-rose-600">
                        {money(r.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <h2 className="font-semibold">{t("expenses.expenseBreakdownByCategory")}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{monthLabel(filterMonth)}</p>
            <div className="mt-4 space-y-3">
              {breakdown.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("expenses.noExpensesThisMonth")}</p>
              ) : (
                breakdown.slice(0, 8).map((b) => (
                  <div key={b.category} className="flex items-center justify-between text-sm">
                    <CategoryBadge name={b.category} />
                    <span className="font-semibold tabular-nums text-rose-600">
                      {money(b.amount)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {summary && <FinancialSummaryPanel summary={summary} />}
          <Button variant="outline" className="h-9 w-full" onClick={handleRecurring}>
            {t("expenses.processRecurringExpenses")}
          </Button>
        </div>
      </div>

      <ExpenseFormDialog open={showForm} onClose={() => setShowForm(false)} />
    </div>
  );
}
