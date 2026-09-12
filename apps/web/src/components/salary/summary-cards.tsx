"use client";

import Link from "next/link";
import { Banknote, Clock, PieChart, UserCheck, Users, Wallet } from "lucide-react";
import { useT } from "@/lib/i18n/provider";
import { money } from "@/lib/salary/format";
import { monthLabel } from "@/lib/salary/format";
import type { SalaryDashboardSummary } from "@/lib/salary/types";

/**
 * What this month's payroll costs, what has gone out, and what has not.
 *
 * There were nine cards. Three of them counted the same people (total = teachers
 * + staff), two carried the identical figure under different names, and one
 * called every payroll row ever recorded the "annual" total. Nine cards in a
 * five-column grid also left a ragged hole where the last row ran out.
 *
 * Six now, in two rows of three, and each says something the others do not.
 * Every one links to the page that explains it — they used to be buttons that
 * said "View details" and did nothing at all.
 */
export function SalarySummaryCards({
  summary,
  month,
}: {
  summary: SalaryDashboardSummary;
  /** The month these figures are for, so the card can say so. */
  month: string;
}) {
  const t = useT();
  const paidPct =
    summary.monthlyPayroll > 0
      ? Math.min(100, Math.round((summary.salariesPaid / summary.monthlyPayroll) * 100))
      : 0;

  return (
    <div className="space-y-4">
      {/* The month's money. One row, because it is one story: what it costs,
          what has gone out, what is left. */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card
          href="/salary/payroll"
          icon={Wallet}
          tone="indigo"
          label={t("salarySummaryCards.monthlyPayroll")}
          note={monthLabel(month)}
          value={money(summary.monthlyPayroll)}
        />
        <Card
          href="/salary/history"
          icon={Banknote}
          tone="emerald"
          label={t("salarySummaryCards.salariesPaid")}
          note={`${paidPct}% ${t("salarySummaryCards.ofThisMonth")}`}
          value={money(summary.salariesPaid)}
        >
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-emerald-500"
              style={{ width: `${paidPct}%` }}
            />
          </div>
        </Card>
        <Card
          href="/salary/payroll"
          icon={Clock}
          tone={summary.outstanding > 0 ? "rose" : "slate"}
          label={t("salarySummaryCards.outstanding")}
          note={
            summary.outstanding > 0
              ? t("salarySummaryCards.stillToPay")
              : t("salarySummaryCards.allPaid")
          }
          value={money(summary.outstanding)}
        />
      </div>

      {/* Who is on it, and where each of them stands. */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card
          href="/salary/employees"
          icon={Users}
          tone="blue"
          label={t("salarySummaryCards.totalEmployees")}
          note={`${summary.totalTeachers} ${t("salarySummaryCards.teachers")} · ${summary.totalStaff} ${t("salarySummaryCards.staff")}`}
          value={summary.totalEmployees.toLocaleString()}
        />
        <Card
          href="/salary/payroll"
          icon={UserCheck}
          tone="amber"
          label={t("salarySummaryCards.pendingSalaries")}
          note={t("salarySummaryCards.notYetPaid")}
          value={summary.pendingSalaries.toLocaleString()}
        />
        <Card
          href="/salary/payroll"
          icon={PieChart}
          tone="violet"
          label={t("salarySummaryCards.partialPayments")}
          note={t("salarySummaryCards.paidInPart")}
          value={summary.partialPayments.toLocaleString()}
        />
      </div>
    </div>
  );
}

const TONES: Record<string, { chip: string; value: string }> = {
  indigo: {
    chip: "bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300",
    value: "text-indigo-600 dark:text-indigo-400",
  },
  emerald: {
    chip: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300",
    value: "text-emerald-600 dark:text-emerald-400",
  },
  rose: {
    chip: "bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300",
    value: "text-rose-600 dark:text-rose-400",
  },
  slate: {
    chip: "bg-secondary text-muted-foreground",
    value: "text-foreground",
  },
  blue: {
    chip: "bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300",
    value: "text-blue-600 dark:text-blue-400",
  },
  amber: {
    chip: "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300",
    value: "text-amber-600 dark:text-amber-400",
  },
  violet: {
    chip: "bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300",
    value: "text-violet-600 dark:text-violet-400",
  },
};

function Card({
  href,
  icon: Icon,
  tone,
  label,
  note,
  value,
  children,
}: {
  href: string;
  icon: typeof Wallet;
  tone: keyof typeof TONES;
  label: string;
  note: string;
  value: string;
  children?: React.ReactNode;
}) {
  const c = TONES[tone] ?? TONES.slate;
  return (
    <Link
      href={href}
      className="rounded-xl border bg-card p-4 shadow-sm transition hover:border-primary/30 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className={`mt-1.5 text-2xl font-bold tabular-nums tracking-tight ${c.value}`}>
            {value}
          </p>
        </div>
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${c.chip}`}
        >
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <p className="mt-1 truncate text-xs text-muted-foreground">{note}</p>
      {children}
    </Link>
  );
}
