import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  Banknote,
  CircleDollarSign,
  Clock,
  PieChart,
  TrendingUp,
  UserCheck,
  Users,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { money } from "@/lib/salary/format";
import type { SalaryDashboardSummary } from "@/lib/salary/types";

const CARDS: {
  key: keyof SalaryDashboardSummary;
  label: string;
  icon: LucideIcon;
  chip: string;
  value: string;
  format: (v: number) => string;
}[] = [
  {
    key: "totalEmployees",
    label: "Total Employees",
    icon: Users,
    chip: "bg-blue-100 text-blue-600 dark:bg-blue-500/15",
    value: "text-blue-600 dark:text-blue-400",
    format: (v) => v.toLocaleString(),
  },
  {
    key: "totalTeachers",
    label: "Total Teachers",
    icon: UserCheck,
    chip: "bg-violet-100 text-violet-600 dark:bg-violet-500/15",
    value: "text-violet-600 dark:text-violet-400",
    format: (v) => v.toLocaleString(),
  },
  {
    key: "totalStaff",
    label: "Total Staff",
    icon: Users,
    chip: "bg-sky-100 text-sky-600 dark:bg-sky-500/15",
    value: "text-sky-600 dark:text-sky-400",
    format: (v) => v.toLocaleString(),
  },
  {
    key: "monthlyPayroll",
    label: "Monthly Payroll",
    icon: Wallet,
    chip: "bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15",
    value: "text-indigo-600 dark:text-indigo-400",
    format: money,
  },
  {
    key: "salariesPaid",
    label: "Salaries Paid",
    icon: Banknote,
    chip: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15",
    value: "text-emerald-600 dark:text-emerald-400",
    format: money,
  },
  {
    key: "pendingSalaries",
    label: "Pending Salaries",
    icon: Clock,
    chip: "bg-rose-100 text-rose-600 dark:bg-rose-500/15",
    value: "text-rose-600 dark:text-rose-400",
    format: (v) => v.toLocaleString(),
  },
  {
    key: "partialPayments",
    label: "Partial Payments",
    icon: PieChart,
    chip: "bg-amber-100 text-amber-600 dark:bg-amber-500/15",
    value: "text-amber-600 dark:text-amber-400",
    format: (v) => v.toLocaleString(),
  },
  {
    key: "payrollThisMonth",
    label: "Payroll This Month",
    icon: CircleDollarSign,
    chip: "bg-purple-100 text-purple-600 dark:bg-purple-500/15",
    value: "text-purple-600 dark:text-purple-400",
    format: money,
  },
  {
    key: "annualPayroll",
    label: "Annual Payroll",
    icon: TrendingUp,
    chip: "bg-teal-100 text-teal-600 dark:bg-teal-500/15",
    value: "text-teal-600 dark:text-teal-400",
    format: money,
  },
];

export function SalarySummaryCards({ summary }: { summary: SalaryDashboardSummary }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {CARDS.map((c) => (
        <div
          key={c.key}
          className="rounded-xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
        >
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
                c.chip,
              )}
            >
              <c.icon className="h-5 w-5" />
            </span>
            <p className="text-xs font-medium leading-tight text-muted-foreground">
              {c.label}
            </p>
          </div>
          <p
            className={cn(
              "mt-3 text-2xl font-bold tabular-nums tracking-tight",
              c.value,
            )}
          >
            {c.format(summary[c.key] as number)}
          </p>
          <button
            type="button"
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            View details
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  );
}
