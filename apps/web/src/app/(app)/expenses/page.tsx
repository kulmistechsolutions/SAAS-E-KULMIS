"use client";


import { useT } from "@/lib/i18n/provider";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Calendar, FileText, List, Plus, Tags } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
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
  expensesByMonth,
  generateRecurringDue,
  recentExpenses,
  refreshFinanceForMonth,
  useExpensesState,
} from "@/lib/expenses/store";
import { AcademicYearSelect } from "@/components/academics/academic-year-select";
import { toast } from "@/lib/toast";
import { useHydrated } from "@/lib/use-hydrated";

const CHART_MARGIN = { top: 8, right: 8, left: 0, bottom: 0 };

/** The tooltip sits on the themed card, so it takes the card's colours. */
const TOOLTIP_STYLE = {
  borderRadius: 12,
  border: "1px solid hsl(var(--border))",
  background: "hsl(var(--card))",
  color: "hsl(var(--card-foreground))",
  fontSize: 12,
} as const;

/** Distinct at a glance, and readable in both themes. */
const SLICE = [
  "#6366f1",
  "#f43f5e",
  "#f59e0b",
  "#10b981",
  "#0ea5e9",
  "#a855f7",
  "#14b8a6",
  "#ef4444",
];

const QUICK = [
  { href: "/expenses/list", label: "Expense List", desc: "Search, filter & manage", icon: List },
  { href: "/expenses/categories", label: "Categories", desc: "Custom expense categories", icon: Tags },
  { href: "/expenses/reports", label: "Reports", desc: "Print, PDF & CSV exports", icon: FileText },
];

export default function ExpensesDashboardPage() {
  const t = useT();
  const mounted = useHydrated();
  const state = useExpensesState();
  const [filterYear, setFilterYear] = useState("");
  const [filterMonth, setFilterMonth] = useState("");
  const [showForm, setShowForm] = useState(false);

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
  const trend = useMemo(
    () => (mounted ? expensesByMonth(filterYear) : []),
    [mounted, filterYear, state],
  );

  /**
   * Is this month normal?
   *
   * A figure for the month says nothing without the month before it, which is
   * the comparison anyone reading an expense total is making in their head
   * anyway. Null when there is no earlier month to compare against — an
   * invented "+100%" against nothing would be worse than silence.
   */
  const versusLast = useMemo(() => {
    const i = trend.findIndex((x) => x.month === filterMonth.slice(0, 7));
    if (i <= 0) return null;
    const prev = trend[i - 1]!.amount;
    const now = trend[i]!.amount;
    if (prev === 0) return null;
    return Math.round(((now - prev) / prev) * 100);
  }, [trend, filterMonth]);

  const breakdownTotal = breakdown.reduce((n, b) => n + b.amount, 0);

  const chartData = useMemo(
    () =>
      trend.map((x) => ({
        label: monthLabel(x.month),
        amount: x.amount,
        count: x.count,
      })),
    [trend],
  );

  /**
   * Every month the school actually spent in, newest first.
   *
   * The picker offered two entries — this month, and this month — so the month
   * label beside it read as a filter that could not be moved. These come from
   * the expenses themselves, so a month in the list always has something in
   * it, and the current month is kept even when it is still empty because
   * that is the month somebody is about to record into.
   */
  const monthOptions = useMemo(() => {
    const set = new Set<string>(trend.map((x) => x.month));
    set.add(monthKey());
    if (filterMonth) set.add(filterMonth.slice(0, 7));
    return [...set].sort((a, b) => b.localeCompare(a));
  }, [trend, filterMonth]);

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
              {monthOptions.map((m) => (
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

      {/* Where this module goes. Three panels of their own put the pages a
          scroll away and repeated the sidebar in larger type. */}
      <div className="flex flex-wrap gap-2">
        {QUICK.map((q) => (
          <Link
            key={q.href}
            href={q.href}
            title={q.desc}
            className="group inline-flex items-center gap-2 rounded-xl border bg-card px-3 py-2 text-sm font-medium shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <q.icon className="h-4 w-4" />
            </span>
            {q.label}
          </Link>
        ))}
      </div>

      {summary && <ExpenseSummaryCards summary={summary} />}

      {/* ── The shape of the year, and of the month ─────────────────── */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex h-full flex-col rounded-2xl border bg-card p-5 shadow-sm lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="font-semibold">Monthly spending</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {filterYear || "This academic year"}
              </p>
            </div>
            {versusLast !== null && (
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                  versusLast > 0
                    ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                    : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                }`}
              >
                {versusLast > 0 ? "+" : ""}
                {versusLast}% vs last month
              </span>
            )}
          </div>

          {trend.length === 0 ? (
            <div className="flex flex-1 items-center justify-center py-10">
              <p className="text-sm text-muted-foreground">
                Nothing has been recorded in {filterYear || "this year"} yet.
              </p>
            </div>
          ) : (
            <div className="mt-4 h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                {trend.length < 3 ? (
                  // One or two months is not a curve. Drawn as an area it is a
                  // lone dot in an empty field, which reads as a broken chart.
                  <BarChart data={chartData} margin={CHART_MARGIN} barSize={54}>
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      width={56}
                      tickFormatter={(v: number) => money(v)}
                    />
                    <Tooltip
                      cursor={{ fill: "hsl(var(--secondary))", opacity: 0.5 }}
                      formatter={(v: number) => money(v)}
                      contentStyle={TOOLTIP_STYLE}
                    />
                    <Bar dataKey="amount" fill="#f43f5e" radius={[6, 6, 0, 0]} />
                  </BarChart>
                ) : (
                  <AreaChart data={chartData} margin={CHART_MARGIN}>
                    <defs>
                      <linearGradient id="expenseFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#f43f5e" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      width={56}
                      tickFormatter={(v: number) => money(v)}
                    />
                    <Tooltip
                      formatter={(v: number) => money(v)}
                      contentStyle={TOOLTIP_STYLE}
                    />
                    <Area
                      type="monotone"
                      dataKey="amount"
                      stroke="#f43f5e"
                      strokeWidth={2}
                      fill="url(#expenseFill)"
                    />
                  </AreaChart>
                )}
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="flex h-full flex-col rounded-2xl border bg-card p-5 shadow-sm">
          <h2 className="font-semibold">
            {t("expenses.expenseBreakdownByCategory")}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {monthLabel(filterMonth)}
          </p>

          {breakdown.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-1 py-10 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                <Tags className="h-5 w-5" />
              </span>
              <p className="mt-2 text-sm text-muted-foreground">
                {t("expenses.noExpensesThisMonth")}
              </p>
              <button
                type="button"
                onClick={() => setShowForm(true)}
                className="text-xs font-medium text-primary hover:underline"
              >
                {t("expenses.recordExpense")}
              </button>
            </div>
          ) : (
            <>
              <div className="relative mt-2 h-[190px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={breakdown}
                      dataKey="amount"
                      nameKey="category"
                      innerRadius={58}
                      outerRadius={84}
                      paddingAngle={2}
                      stroke="none"
                    >
                      {breakdown.map((b, i) => (
                        <Cell key={b.category} fill={SLICE[i % SLICE.length]!} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v: number) => money(v)}
                      contentStyle={{
                        borderRadius: 12,
                        border: "1px solid hsl(var(--border))",
                        background: "hsl(var(--card))",
                        color: "hsl(var(--card-foreground))",
                        fontSize: 12,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* The total belongs in the hole of a donut; without it the
                    slices are proportions of an unstated whole. */}
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-lg font-bold tabular-nums">
                    {money(breakdownTotal)}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    this month
                  </span>
                </div>
              </div>

              <ul className="mt-4 space-y-2">
                {breakdown.slice(0, 6).map((b, i) => (
                  <li
                    key={b.category}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: SLICE[i % SLICE.length] }}
                      />
                      <span className="truncate">{b.category}</span>
                    </span>
                    <span className="whitespace-nowrap tabular-nums text-muted-foreground">
                      {money(b.amount)}
                      <span className="ms-1 text-xs">
                        (
                        {breakdownTotal
                          ? Math.round((b.amount / breakdownTotal) * 100)
                          : 0}
                        %)
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h2 className="font-semibold">{t("expenses.recentExpenses")}</h2>
              <Link href="/expenses/list" className="text-xs font-medium text-primary hover:underline">
                {t("expenses.viewAll")}
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 text-start font-medium">{t("expenses.reference")}</th>
                    <th className="px-4 py-2.5 text-start font-medium">{t("expenses.title")}</th>
                    <th className="px-4 py-2.5 text-start font-medium">{t("expenses.category")}</th>
                    <th className="px-4 py-2.5 text-end font-medium">{t("expenses.amount")}</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-4 py-12 text-center text-muted-foreground"
                      >
                        {t("expenses.noExpensesThisMonth")}
                      </td>
                    </tr>
                  ) : (
                    recent.map((r) => (
                      <tr
                        key={r.id}
                        className="border-t transition-colors hover:bg-secondary/40"
                      >
                        <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-primary">
                          <Link href={`/expenses/${r.id}`}>{r.referenceNo}</Link>
                        </td>
                        <td className="px-4 py-2.5 font-medium">{r.title}</td>
                        <td className="px-4 py-2.5">
                          <CategoryBadge name={r.categoryName} />
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-end font-semibold tabular-nums text-rose-600">
                          {money(r.amount)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
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
