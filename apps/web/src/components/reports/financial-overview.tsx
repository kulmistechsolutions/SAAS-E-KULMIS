"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Coins,
  Eye,
  FileText,
  Landmark,
  PieChart as PieIcon,
  Printer,
  Receipt,
  TrendingUp,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { ExportMenu } from "@/components/export/export-menu";
import { printReport } from "@/lib/reports/print";
import { logReportAction, useReportAudit } from "@/lib/reports/audit";
import type { ExportSpec } from "@/lib/export/table-export";
import { cn } from "@/lib/utils";
import { useHydrated } from "@/lib/use-hydrated";

interface TrendMonth {
  month: string;
  feeIncome: number;
  otherIncome: number;
  expenses: number;
  salaries: number;
  debtRepaid: number;
}
interface Trend {
  months: TrendMonth[];
  otherIncomeByCategory: { month: string; category: string; amount: number }[];
  expensesByCategory: { month: string; category: string; amount: number }[];
}

const PERIODS = [
  { id: "1", label: "This Month", months: 1 },
  { id: "3", label: "Last 3 Months", months: 3 },
  { id: "6", label: "Last 6 Months", months: 6 },
  { id: "12", label: "Last 12 Months", months: 12 },
] as const;

const TABS = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "income", label: "Income", icon: Coins },
  { id: "expenses", label: "Expenses", icon: Receipt },
  { id: "salaries", label: "Salaries", icon: Users },
  { id: "net", label: "Net Income", icon: TrendingUp },
] as const;
type TabId = (typeof TABS)[number]["id"];

const DONUT = ["#22c55e", "#3b82f6", "#f59e0b", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#64748b"];

const fmt = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

function monthName(key: string, long = false): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y!, (m ?? 1) - 1, 1)).toLocaleString(undefined, {
    month: long ? "long" : "short",
    year: long ? "numeric" : undefined,
    timeZone: "UTC",
  });
}

function sum<T>(rows: T[], f: (r: T) => number): number {
  return Math.round(rows.reduce((a, r) => a + f(r), 0) * 100) / 100;
}

function change(now: number, before: number): number | null {
  if (!before) return null;
  return Math.round(((now - before) / Math.abs(before)) * 1000) / 10;
}

/**
 * Financial Reports — one place for everything about the school's money.
 *
 * The cards and chart cover the period picked at the top; the tabs open each
 * side of the ledger on its own (income, expenses, salaries, the net), each
 * with its own month-by-month table that can be printed or exported, and a
 * link through to the full detailed report.
 */
export function FinancialOverview() {
  const mounted = useHydrated();
  const { user } = useAuth();
  const [trend, setTrend] = useState<Trend | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<(typeof PERIODS)[number]["id"]>("12");
  const [tab, setTab] = useState<TabId>("overview");
  const audit = useReportAudit();

  useEffect(() => {
    if (!mounted) return;
    let live = true;
    api<Trend>("/finance/trend?months=24")
      .then((t) => live && setTrend(t))
      .catch((e) => live && setError(e instanceof ApiError ? e.message : "Could not load the figures."));
    return () => {
      live = false;
    };
  }, [mounted]);

  const span = PERIODS.find((p) => p.id === period)!.months;
  const { current, previous } = useMemo(() => {
    const all = trend?.months ?? [];
    return {
      current: all.slice(-span),
      previous: all.slice(-2 * span, -span),
    };
  }, [trend, span]);
  const inWindow = useMemo(() => new Set(current.map((m) => m.month)), [current]);

  const totals = (rows: TrendMonth[]) => {
    const income = sum(rows, (r) => r.feeIncome + r.otherIncome);
    const expenses = sum(rows, (r) => r.expenses);
    const salaries = sum(rows, (r) => r.salaries);
    const debt = sum(rows, (r) => r.debtRepaid);
    return { income, expenses, salaries, debt, net: Math.round((income - expenses - salaries - debt) * 100) / 100 };
  };
  const now = totals(current);
  const before = totals(previous);
  const periodLabel =
    current.length > 0
      ? current.length === 1
        ? monthName(current[0]!.month, true)
        : `${monthName(current[0]!.month, true)} – ${monthName(current[current.length - 1]!.month, true)}`
      : "";

  const incomeBreakdown = useMemo(() => {
    const fees = sum(current, (r) => r.feeIncome);
    const byCat = new Map<string, number>();
    for (const r of trend?.otherIncomeByCategory ?? []) {
      if (inWindow.has(r.month)) byCat.set(r.category, (byCat.get(r.category) ?? 0) + r.amount);
    }
    return [
      { name: "Student Fees", value: fees },
      ...[...byCat].map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 })),
    ]
      .filter((x) => x.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [current, trend, inWindow]);

  const expenseBreakdown = useMemo(() => {
    const byCat = new Map<string, number>();
    for (const r of trend?.expensesByCategory ?? []) {
      if (inWindow.has(r.month)) byCat.set(r.category, (byCat.get(r.category) ?? 0) + r.amount);
    }
    return [...byCat]
      .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
      .filter((x) => x.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [trend, inWindow]);

  // ── The table each tab shows, prints and exports ──
  const tableFor = (t: TabId): ExportSpec => {
    const sub = [`Period: ${periodLabel}`];
    if (t === "income") {
      return {
        title: "Income Report",
        subtitle: sub,
        columns: [
          { key: "month", label: "Month" },
          { key: "fees", label: "Student Fees", align: "right" },
          { key: "other", label: "Other Income", align: "right" },
          { key: "total", label: "Total Income", align: "right" },
        ],
        rows: [
          ...current.map((m) => ({
            month: monthName(m.month, true),
            fees: m.feeIncome,
            other: m.otherIncome,
            total: Math.round((m.feeIncome + m.otherIncome) * 100) / 100,
          })),
          { month: "Total", fees: sum(current, (r) => r.feeIncome), other: sum(current, (r) => r.otherIncome), total: now.income },
        ],
      };
    }
    if (t === "expenses") {
      return {
        title: "Expense Report",
        subtitle: sub,
        columns: [
          { key: "category", label: "Category" },
          { key: "amount", label: "Amount", align: "right" },
          { key: "share", label: "Share %", align: "right" },
        ],
        rows: [
          ...expenseBreakdown.map((c) => ({
            category: c.name,
            amount: c.value,
            share: now.expenses ? Math.round((c.value / now.expenses) * 1000) / 10 : 0,
          })),
          { category: "Total", amount: now.expenses, share: now.expenses ? 100 : 0 },
        ],
      };
    }
    if (t === "salaries") {
      return {
        title: "Salary Report",
        subtitle: sub,
        columns: [
          { key: "month", label: "Payroll Month" },
          { key: "paid", label: "Salaries Paid", align: "right" },
        ],
        rows: [
          ...current.map((m) => ({ month: monthName(m.month, true), paid: m.salaries })),
          { month: "Total", paid: now.salaries },
        ],
      };
    }
    // overview and net: the monthly statement
    return {
      title: t === "net" ? "Net Income Report" : "Monthly Financial Statement",
      subtitle: sub,
      columns: [
        { key: "month", label: "Month" },
        { key: "income", label: "Income", align: "right" },
        { key: "expenses", label: "Expenses", align: "right" },
        { key: "salaries", label: "Salaries", align: "right" },
        { key: "debt", label: "Debt Repaid", align: "right" },
        { key: "net", label: "Net Income", align: "right" },
      ],
      rows: [
        ...current.map((m) => {
          const income = m.feeIncome + m.otherIncome;
          return {
            month: monthName(m.month, true),
            income: Math.round(income * 100) / 100,
            expenses: m.expenses,
            salaries: m.salaries,
            debt: m.debtRepaid,
            net: Math.round((income - m.expenses - m.salaries - m.debtRepaid) * 100) / 100,
          };
        }),
        { month: "Total", income: now.income, expenses: now.expenses, salaries: now.salaries, debt: now.debt, net: now.net },
      ],
    };
  };

  function printTab(t: TabId) {
    const spec = tableFor(t);
    printReport({
      title: spec.title,
      scope: [{ label: "Period", value: periodLabel }],
      data: {
        columns: spec.columns.map((c) => ({ key: c.key, label: c.label, align: c.align })),
        rows: spec.rows.map((r) =>
          Object.fromEntries(
            Object.entries(r).map(([k, v]) => [k, typeof v === "number" && k !== "share" ? fmt(v) : (v ?? "")]),
          ),
        ) as Record<string, string | number>[],
        summary: [],
      },
    });
    logReportAction("Financial Reports", spec.title, "PRINTED");
  }

  const recent = audit.filter((a) => a.category === "Financial Reports").slice(0, 6);

  if (!mounted) return null;

  return (
    <div className="relative space-y-6">
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-x-4 -top-4 h-72 rounded-b-[3rem] bg-gradient-to-br from-violet-200/50 via-indigo-100/30 to-transparent dark:from-violet-900/25 dark:via-indigo-900/10 sm:-inset-x-6"
      />

      <Link href="/reports" className="relative inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
        <ArrowLeft className="h-4 w-4 rtl:rotate-180" /> Back to Reports Center
      </Link>

      {/* ── Header ── */}
      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-lg shadow-violet-500/30">
            <BarChart3 className="h-7 w-7" />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Financial Reports</h1>
            <p className="text-sm text-muted-foreground">Income, expenses, salaries and net income — {periodLabel || "…"}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative flex h-10 items-center rounded-lg border bg-card shadow-sm">
            <CalendarDays className="pointer-events-none absolute start-3 h-4 w-4 text-muted-foreground" />
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as typeof period)}
              className="h-full appearance-none rounded-lg bg-transparent ps-9 pe-9 text-sm outline-none focus:ring-2 focus:ring-primary/20"
              aria-label="Period"
            >
              {PERIODS.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute end-3 h-4 w-4 text-muted-foreground" />
          </label>
          <ExportMenu label="Export Report" disabled={!trend} spec={() => tableFor(tab)} />
        </div>
      </div>

      {error && (
        <div className="relative rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
          {error}
        </div>
      )}

      {/* ── KPI cards ── */}
      <div className="relative grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={Coins} tone="emerald" label="Total Income" value={now.income} note="Fee collection & other income" delta={change(now.income, before.income)} loading={!trend} />
        <Kpi icon={Wallet} tone="rose" label="Total Expenses" value={now.expenses} note="Operational & administrative costs" delta={change(now.expenses, before.expenses)} invert loading={!trend} />
        <Kpi icon={TrendingUp} tone="sky" label="Net Income" value={now.net} note="After expenses, salaries & debt" delta={change(now.net, before.net)} loading={!trend} />
        <Kpi icon={Users} tone="violet" label="Salary Outflow" value={now.salaries} note="Total staff salaries paid" delta={change(now.salaries, before.salaries)} invert loading={!trend} />
      </div>

      {/* ── Detailed reports ── */}
      <div className="relative grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <ReportLink href="/reports/financial/income" icon={Coins} tone="emerald" title="Income Report" desc="Fee collection income." />
        <ReportLink href="/reports/financial/expenses" icon={Receipt} tone="rose" title="Expense Report" desc="Total operational expenses." />
        <ReportLink href="/reports/financial/salary" icon={Users} tone="violet" title="Salary Report" desc="Total salary outflow." />
        <ReportLink href="/reports/financial/net-income" icon={TrendingUp} tone="sky" title="Net Income Report" desc="Fees − expenses − salaries." />
        <ReportLink href="/reports/financial/monthly-statement" icon={FileText} tone="amber" title="Monthly Financial Statement" desc="Full monthly P&L summary." />
        <ReportLink href="/finance/debts" icon={Landmark} tone="slate" title="School Debts" desc="Loans and repayments." />
      </div>

      {/* ── Tabs ── */}
      <div className="relative rounded-2xl border bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 pt-2">
          <div role="tablist" className="flex flex-wrap gap-1">
            {TABS.map((t) => {
              const Icon = t.icon;
              const on = tab === t.id;
              return (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={on}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                    on ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {t.label}
                </button>
              );
            })}
          </div>
          <div className="flex gap-2 pb-2">
            <Button variant="outline" className="h-9" onClick={() => printTab(tab)} disabled={!trend}>
              <Printer className="me-2 h-4 w-4" /> Print
            </Button>
            <ExportMenu className="[&>button]:h-9" disabled={!trend} spec={() => tableFor(tab)} />
          </div>
        </div>

        <div className="p-4 sm:p-5">
          {!trend && !error ? (
            <p className="py-16 text-center text-sm text-muted-foreground">Loading the school&apos;s figures…</p>
          ) : tab === "overview" ? (
            <div className="grid gap-5 lg:grid-cols-5">
              <div className="lg:col-span-3">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  <BarChart3 className="h-4 w-4 text-primary" /> Income vs Expenses (Monthly)
                </h3>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart
                    data={current.map((m) => ({
                      name: monthName(m.month),
                      Income: Math.round((m.feeIncome + m.otherIncome) * 100) / 100,
                      Expenses: Math.round((m.expenses + m.salaries) * 100) / 100,
                    }))}
                    margin={{ top: 8, right: 8, left: -6, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `$${v.toLocaleString()}`} />
                    <Tooltip formatter={(v: number) => fmt(v)} contentStyle={TOOLTIP} cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="Income" fill="#22c55e" radius={[6, 6, 0, 0]} maxBarSize={28} />
                    <Bar dataKey="Expenses" fill="#8b5cf6" radius={[6, 6, 0, 0]} maxBarSize={28} />
                  </BarChart>
                </ResponsiveContainer>
                <p className="mt-1 text-xs text-muted-foreground">Expenses here include salaries paid.</p>
              </div>
              <div className="lg:col-span-2">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  <PieIcon className="h-4 w-4 text-primary" /> Income Breakdown
                </h3>
                <Donut data={incomeBreakdown} total={now.income} centerLabel="Total Income" />
              </div>
            </div>
          ) : tab === "expenses" ? (
            <div className="grid gap-5 lg:grid-cols-5">
              <div className="lg:col-span-3"><Table spec={tableFor("expenses")} /></div>
              <div className="lg:col-span-2">
                <h3 className="mb-3 text-sm font-semibold">By category</h3>
                <Donut data={expenseBreakdown} total={now.expenses} centerLabel="Total Expenses" />
              </div>
            </div>
          ) : tab === "income" ? (
            <div className="grid gap-5 lg:grid-cols-5">
              <div className="lg:col-span-3"><Table spec={tableFor("income")} /></div>
              <div className="lg:col-span-2">
                <h3 className="mb-3 text-sm font-semibold">Where it came from</h3>
                <Donut data={incomeBreakdown} total={now.income} centerLabel="Total Income" />
              </div>
            </div>
          ) : (
            <Table spec={tableFor(tab)} />
          )}
        </div>
      </div>

      {/* ── Recently opened ── */}
      <div className="relative rounded-2xl border bg-card shadow-sm">
        <div className="flex items-center gap-2 border-b px-5 py-3">
          <FileText className="h-4 w-4 text-primary" />
          <h2 className="font-semibold">Recent Financial Reports</h2>
        </div>
        {recent.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">
            Reports you print or export from here are listed for you to open again.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-muted/50 text-xs font-semibold text-foreground/80">
                <tr>
                  <th className="px-4 py-2.5 text-start">Report</th>
                  <th className="px-4 py-2.5 text-start">Action</th>
                  <th className="px-4 py-2.5 text-start">By</th>
                  <th className="px-4 py-2.5 text-start">When</th>
                  <th className="px-4 py-2.5 text-end">Open</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="px-4 py-2.5 font-medium">{r.reportName}</td>
                    <td className="px-4 py-2.5">
                      <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                        {r.action.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{user?.username ?? r.user}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{new Date(r.at).toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-end">
                      <Link href={reportHref(r.reportName)} className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted" title="Open">
                        <Eye className="h-4 w-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const TOOLTIP = {
  borderRadius: 12,
  border: "1px solid hsl(var(--border))",
  background: "hsl(var(--card))",
  color: "hsl(var(--card-foreground))",
  fontSize: 12,
};

function reportHref(name: string): string {
  const map: Record<string, string> = {
    "Income Report": "/reports/financial/income",
    "Expense Report": "/reports/financial/expenses",
    "Salary Report": "/reports/financial/salary",
    "Net Income Report": "/reports/financial/net-income",
    "Monthly Financial Statement": "/reports/financial/monthly-statement",
  };
  return map[name] ?? "/reports/financial";
}

const TONES: Record<string, { tile: string; card: string }> = {
  emerald: { tile: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400", card: "from-emerald-500/10" },
  rose: { tile: "bg-rose-500/15 text-rose-600 dark:text-rose-400", card: "from-rose-500/10" },
  sky: { tile: "bg-sky-500/15 text-sky-600 dark:text-sky-400", card: "from-sky-500/10" },
  violet: { tile: "bg-violet-500/15 text-violet-600 dark:text-violet-400", card: "from-violet-500/10" },
  amber: { tile: "bg-amber-500/15 text-amber-600 dark:text-amber-400", card: "from-amber-500/10" },
  slate: { tile: "bg-slate-500/15 text-slate-600 dark:text-slate-300", card: "from-slate-500/10" },
};

function Kpi({
  icon: Icon,
  tone,
  label,
  value,
  note,
  delta,
  invert,
  loading,
}: {
  icon: LucideIcon;
  tone: keyof typeof TONES;
  label: string;
  value: number;
  note: string;
  delta: number | null;
  /** For money going out, a rise is not good news. */
  invert?: boolean;
  loading?: boolean;
}) {
  const t = TONES[tone]!;
  const good = delta === null ? null : invert ? delta <= 0 : delta >= 0;
  return (
    <div className={cn("flex items-center gap-4 rounded-2xl border bg-gradient-to-br to-card p-4 shadow-sm", t.card)}>
      <span className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl", t.tile)}>
        <Icon className="h-6 w-6" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-medium text-muted-foreground">{label}</p>
          {delta !== null && !loading && (
            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                good ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-rose-500/10 text-rose-700 dark:text-rose-400",
              )}
              title="Compared with the previous period of the same length"
            >
              {delta >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {delta > 0 ? "+" : ""}
              {delta}%
            </span>
          )}
        </div>
        <p className="mt-0.5 text-2xl font-bold tabular-nums">{loading ? "…" : fmt(value)}</p>
        <p className="truncate text-xs text-muted-foreground">{note}</p>
      </div>
    </div>
  );
}

function ReportLink({
  href,
  icon: Icon,
  tone,
  title,
  desc,
}: {
  href: string;
  icon: LucideIcon;
  tone: keyof typeof TONES;
  title: string;
  desc: string;
}) {
  const t = TONES[tone]!;
  return (
    <Link
      href={href}
      className={cn(
        "group flex items-center gap-3 rounded-xl border bg-gradient-to-r to-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md",
        t.card,
      )}
    >
      <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", t.tile)}>
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{title}</span>
        <span className="block truncate text-xs text-muted-foreground">{desc}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 rtl:rotate-180" />
    </Link>
  );
}

function Donut({
  data,
  total,
  centerLabel,
}: {
  data: { name: string; value: number }[];
  total: number;
  centerLabel: string;
}) {
  if (data.length === 0) {
    return <p className="py-16 text-center text-sm text-muted-foreground">Nothing recorded in this period.</p>;
  }
  const all = data.reduce((a, d) => a + d.value, 0) || 1;
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row lg:flex-col xl:flex-row">
      <div className="relative h-48 w-48 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={58} outerRadius={88} paddingAngle={2} stroke="none">
              {data.map((_, i) => (
                <Cell key={i} fill={DONUT[i % DONUT.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(v: number) => fmt(v)} contentStyle={TOOLTIP} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-bold tabular-nums">{fmt(total)}</span>
          <span className="text-[11px] text-muted-foreground">{centerLabel}</span>
        </div>
      </div>
      <ul className="w-full min-w-0 space-y-2">
        {data.map((d, i) => (
          <li key={d.name} className="flex items-center gap-2 text-sm">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: DONUT[i % DONUT.length] }} />
            <span className="min-w-0 flex-1 truncate">{d.name}</span>
            <span className="w-12 text-end text-xs tabular-nums text-muted-foreground">
              {Math.round((d.value / all) * 1000) / 10}%
            </span>
            <span className="w-24 text-end font-semibold tabular-nums">{fmt(d.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Table({ spec }: { spec: ExportSpec }) {
  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full min-w-[480px] text-sm">
        <thead className="bg-muted/60 text-xs font-semibold text-foreground/80">
          <tr>
            {spec.columns.map((c) => (
              <th key={c.key} className={cn("px-4 py-2.5", c.align === "right" ? "text-end" : "text-start")}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {spec.rows.map((r, i) => {
            const isTotal = i === spec.rows.length - 1 && r[spec.columns[0]!.key] === "Total";
            return (
              <tr key={i} className={cn("border-t", isTotal ? "bg-primary/5 font-bold" : "even:bg-muted/20")}>
                {spec.columns.map((c) => {
                  const v = r[c.key];
                  const negative = typeof v === "number" && v < 0;
                  return (
                    <td
                      key={c.key}
                      className={cn(
                        "px-4 py-2.5",
                        c.align === "right" && "text-end tabular-nums",
                        negative && "text-rose-600 dark:text-rose-400",
                      )}
                    >
                      {typeof v === "number" ? (c.key === "share" ? `${v}%` : fmt(v)) : (v ?? "—")}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default FinancialOverview;
