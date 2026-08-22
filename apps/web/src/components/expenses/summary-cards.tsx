
import { useT, type TranslationKey } from "@/lib/i18n/provider";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  CircleDollarSign,
  FolderOpen,
  PieChart,
  Receipt,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { money } from "@/lib/expenses/format";
import type { ExpenseDashboardSummary } from "@/lib/expenses/types";

const CARDS: {
  key: keyof ExpenseDashboardSummary;
  label: TranslationKey;
  icon: LucideIcon;
  chip: string;
  value: string;
  format: (v: number | string) => string;
}[] = [
  {
    key: "totalExpensesToday",
    label: "expensesSummaryCards.totalExpensesToday",
    icon: Receipt,
    chip: "bg-rose-100 text-rose-600 dark:bg-rose-500/15",
    value: "text-rose-600 dark:text-rose-400",
    format: (v) => money(v as number),
  },
  {
    key: "totalExpensesThisMonth",
    label: "expensesSummaryCards.totalExpensesThisMonth",
    icon: Wallet,
    chip: "bg-orange-100 text-orange-600 dark:bg-orange-500/15",
    value: "text-orange-600 dark:text-orange-400",
    format: (v) => money(v as number),
  },
  {
    key: "totalExpensesThisYear",
    label: "expensesSummaryCards.totalExpensesThisYear",
    icon: TrendingDown,
    chip: "bg-red-100 text-red-600 dark:bg-red-500/15",
    value: "text-red-600 dark:text-red-400",
    format: (v) => money(v as number),
  },
  {
    key: "totalCategories",
    label: "expensesSummaryCards.activeCategories",
    icon: FolderOpen,
    chip: "bg-violet-100 text-violet-600 dark:bg-violet-500/15",
    value: "text-violet-600 dark:text-violet-400",
    format: (v) => String(v),
  },
  {
    key: "highestExpenseCategory",
    label: "expensesSummaryCards.highestCategoryMonth",
    icon: PieChart,
    chip: "bg-amber-100 text-amber-600 dark:bg-amber-500/15",
    value: "text-amber-700 dark:text-amber-400",
    format: (v) => String(v),
  },
  {
    key: "pendingExpenses",
    label: "expensesSummaryCards.pendingExpenses",
    icon: CircleDollarSign,
    chip: "bg-sky-100 text-sky-600 dark:bg-sky-500/15",
    value: "text-sky-600 dark:text-sky-400",
    format: (v) => String(v),
  },
  {
    key: "netIncome",
    label: "expensesSummaryCards.netIncome",
    icon: TrendingUp,
    chip: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15",
    value: "text-emerald-600 dark:text-emerald-400",
    format: (v) => money(v as number),
  },
  {
    key: "totalFinancialOutflow",
    label: "expensesSummaryCards.totalFinancialOutflow",
    icon: TrendingDown,
    chip: "bg-rose-100 text-rose-600 dark:bg-rose-500/15",
    value: "text-rose-600 dark:text-rose-400",
    format: (v) => money(v as number),
  },
];

/** Figures the server owns — shown as "—" until they arrive, never as $0. */
const SERVER_BACKED = new Set(["netIncome", "totalFinancialOutflow"]);

export function ExpenseSummaryCards({ summary }: { summary: ExpenseDashboardSummary }) {
  const t = useT();
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
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
              {t(c.label)}
            </p>
          </div>
          <p
            className={cn(
              "mt-3 text-xl font-bold tabular-nums tracking-tight",
              c.value,
              c.key === "highestExpenseCategory" && "text-base",
            )}
          >
            {SERVER_BACKED.has(c.key) && !summary.financeLoaded
              ? "—"
              : c.format(summary[c.key] as number | string)}
          </p>
          <button
            type="button"
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            {t("expensesSummaryCards.viewDetails")}
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  );
}

export function FinancialSummaryPanel({
  summary,
}: {
  summary: ExpenseDashboardSummary;
}) {
  const t = useT();
  // Only Total Expenses is computed locally (the expense list is loaded in
  // full); the rest are the server's ledger-wide totals, so they read "—"
  // rather than $0 until they arrive.
  const items: {
    label: TranslationKey;
    value: number;
    tone: string;
    fromServer?: boolean;
  }[] = [
    { label: "expensesSummaryCards.totalIncomeFees", value: summary.totalIncome, tone: "text-emerald-600", fromServer: true },
    { label: "expensesSummaryCards.totalSalaries", value: summary.totalSalaries, tone: "text-violet-600", fromServer: true },
    { label: "expensesSummaryCards.totalExpenses", value: summary.totalExpensesThisMonth, tone: "text-rose-600" },
    { label: "expensesSummaryCards.netIncome", value: summary.netIncome, tone: "text-blue-600", fromServer: true },
  ];
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <h2 className="font-semibold">{t("expensesSummaryCards.financialSummary")}</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        {t("expensesSummaryCards.netIncomeFeeCollectionSalariesExpenses")}
      </p>
      <dl className="mt-4 space-y-3">
        {items.map((item) => (
          <div key={t(item.label)} className="flex items-center justify-between text-sm">
            <dt className="text-muted-foreground">{t(item.label)}</dt>
            <dd
              className={cn("font-semibold tabular-nums", item.tone)}
              data-loaded={summary.financeLoaded}
            >
              {item.fromServer && !summary.financeLoaded ? "—" : money(item.value)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
