import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  ArrowUpRight,
  Banknote,
  CircleDollarSign,
  ClipboardList,
  PieChart,
  TrendingUp,
  UserCheck,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { money } from "@/lib/fees/format";
import type { FeeDashboardSummary } from "@/lib/fees/types";

const CARDS: {
  key: keyof FeeDashboardSummary;
  label: string;
  icon: LucideIcon;
  chip: string;
  value: string;
  format: (v: number) => string;
}[] = [
  {
    key: "totalOutstanding",
    label: "Total Outstanding",
    icon: CircleDollarSign,
    chip: "bg-rose-100 text-rose-600 dark:bg-rose-500/15",
    value: "text-rose-600 dark:text-rose-400",
    format: money,
  },
  {
    key: "outstandingThisMonth",
    label: "Outstanding This Month",
    icon: ClipboardList,
    chip: "bg-orange-100 text-orange-600 dark:bg-orange-500/15",
    value: "text-orange-600 dark:text-orange-400",
    format: money,
  },
  {
    key: "collectedToday",
    label: "Fee Collected Today",
    icon: Banknote,
    chip: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15",
    value: "text-emerald-600 dark:text-emerald-400",
    format: money,
  },
  {
    key: "collectedThisMonth",
    label: "Fee Collected This Month",
    icon: TrendingUp,
    chip: "bg-blue-100 text-blue-600 dark:bg-blue-500/15",
    value: "text-blue-600 dark:text-blue-400",
    format: money,
  },
  {
    key: "collectionPercentage",
    label: "Collection Percentage",
    icon: PieChart,
    chip: "bg-violet-100 text-violet-600 dark:bg-violet-500/15",
    value: "text-violet-600 dark:text-violet-400",
    format: (v) => `${v.toFixed(2)}%`,
  },
  {
    key: "fullyPaidStudents",
    label: "Total Fully Paid Students",
    icon: UserCheck,
    chip: "bg-green-100 text-green-600 dark:bg-green-500/15",
    value: "text-green-600 dark:text-green-400",
    format: (v) => v.toLocaleString(),
  },
  {
    key: "partialPayments",
    label: "Total Partial Payments",
    icon: PieChart,
    chip: "bg-amber-100 text-amber-600 dark:bg-amber-500/15",
    value: "text-amber-600 dark:text-amber-400",
    format: (v) => v.toLocaleString(),
  },
  {
    key: "advancePayments",
    label: "Total Advance Payments",
    icon: ArrowUpRight,
    chip: "bg-purple-100 text-purple-600 dark:bg-purple-500/15",
    value: "text-purple-600 dark:text-purple-400",
    format: (v) => v.toLocaleString(),
  },
  {
    key: "expectedMonthlyIncome",
    label: "Expected Monthly Income",
    icon: Wallet,
    chip: "bg-sky-100 text-sky-600 dark:bg-sky-500/15",
    value: "text-sky-600 dark:text-sky-400",
    format: money,
  },
  {
    key: "netFeeCollection",
    label: "Net Fee Collection",
    icon: CircleDollarSign,
    chip: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15",
    value: "text-emerald-600 dark:text-emerald-400",
    format: money,
  },
];

export function FeeSummaryCards({ summary }: { summary: FeeDashboardSummary }) {
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
