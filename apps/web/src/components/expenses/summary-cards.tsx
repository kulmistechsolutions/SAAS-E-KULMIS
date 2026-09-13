import Link from "next/link";
import { useT, type TranslationKey } from "@/lib/i18n/provider";
import type { LucideIcon } from "lucide-react";
import {
  ChevronRight,
  Clock,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { money } from "@/lib/expenses/format";
import type { ExpenseDashboardSummary } from "@/lib/expenses/types";

/**
 * What the month cost, in four figures.
 *
 * This was eight cards on a four-column grid, and half of them could not be
 * read: "Highest Category" and "Net Income" showed a coloured dash most of the
 * time, "Active Categories" is a setting rather than a figure, and every card
 * carried a "View details →" that was wired to nothing at all. What is left is
 * the four a bursar actually reads, each one a link to the list behind it —
 * the highest category is drawn properly by the chart below instead.
 */
interface CardDef {
  key: keyof ExpenseDashboardSummary;
  label: TranslationKey;
  href: string;
  note: string;
  icon: LucideIcon;
  chip: string;
  value: string;
  money?: boolean;
  /** The server owns it: show "—" until it arrives, never a wrong $0. */
  server?: boolean;
}

const CARDS: CardDef[] = [
  {
    key: "totalExpensesThisMonth",
    label: "expensesSummaryCards.totalExpensesThisMonth",
    href: "/expenses/list",
    note: "Recorded this month",
    icon: Wallet,
    chip: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
    value: "text-orange-600 dark:text-orange-400",
    money: true,
  },
  {
    key: "totalExpensesThisYear",
    label: "expensesSummaryCards.totalExpensesThisYear",
    href: "/expenses/list",
    note: "This academic year",
    icon: TrendingDown,
    chip: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
    value: "text-rose-600 dark:text-rose-400",
    money: true,
  },
  {
    key: "netIncome",
    label: "expensesSummaryCards.netIncome",
    href: "/expenses/reports",
    note: "Income less salaries and expenses",
    icon: TrendingUp,
    chip: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    value: "text-emerald-600 dark:text-emerald-400",
    money: true,
    server: true,
  },
  {
    key: "pendingExpenses",
    label: "expensesSummaryCards.pendingExpenses",
    href: "/expenses/list",
    note: "Awaiting approval",
    icon: Clock,
    chip: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
    value: "text-sky-600 dark:text-sky-400",
  },
];

export function ExpenseSummaryCards({
  summary,
}: {
  summary: ExpenseDashboardSummary;
}) {
  const t = useT();
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {CARDS.map((c) => {
        const raw = summary[c.key];
        const pending = c.server && !summary.financeLoaded;
        const negative = c.key === "netIncome" && Number(raw) < 0;
        return (
          <Link
            key={c.key}
            href={c.href}
            className="group rounded-2xl border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
          >
            <div className="flex items-center justify-between gap-2">
              <span
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-xl transition-transform group-hover:scale-105",
                  c.chip,
                )}
              >
                <c.icon className="h-5 w-5" />
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
            </div>
            <p
              className={cn(
                "mt-4 text-2xl font-bold leading-none tabular-nums",
                pending
                  ? "text-muted-foreground/40"
                  : negative
                    ? "text-rose-600 dark:text-rose-400"
                    : c.value,
              )}
            >
              {pending
                ? "—"
                : c.money
                  ? money(raw as number)
                  : String(raw)}
            </p>
            <p className="mt-1.5 truncate text-sm font-medium">{t(c.label)}</p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {pending ? "Loading…" : c.note}
            </p>
          </Link>
        );
      })}
    </div>
  );
}

/**
 * Where the month's money came from and where it went.
 *
 * The same five lines as before, but each one drawn against the largest of
 * them, because "$4,200 salaries" beside "$180 expenses" is a fact anyone can
 * read twice as fast as a bar than as two numbers in a column.
 */
export function FinancialSummaryPanel({
  summary,
}: {
  summary: ExpenseDashboardSummary;
}) {
  const t = useT();

  const items: {
    label: TranslationKey;
    value: number;
    bar: string;
    tone: string;
    fromServer?: boolean;
  }[] = [
    {
      label: "expensesSummaryCards.totalIncomeFees",
      value: summary.feeIncome,
      bar: "bg-emerald-500",
      tone: "text-emerald-600 dark:text-emerald-400",
      fromServer: true,
    },
    // Donations, rent, canteen and the like — on its own line so the school
    // can see how much of the month did not come from parents.
    {
      label: "expensesSummaryCards.additionalIncome",
      value: summary.otherIncome,
      bar: "bg-teal-500",
      tone: "text-teal-600 dark:text-teal-400",
      fromServer: true,
    },
    {
      label: "expensesSummaryCards.totalSalaries",
      value: summary.totalSalaries,
      bar: "bg-violet-500",
      tone: "text-violet-600 dark:text-violet-400",
      fromServer: true,
    },
    {
      label: "expensesSummaryCards.totalExpenses",
      value: summary.totalExpensesThisMonth,
      bar: "bg-rose-500",
      tone: "text-rose-600 dark:text-rose-400",
    },
  ];

  const scale = Math.max(1, ...items.map((i) => Math.abs(i.value)));
  const net = summary.netIncome;

  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm">
      <h2 className="font-semibold">
        {t("expensesSummaryCards.financialSummary")}
      </h2>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {t("expensesSummaryCards.netIncomeFeeCollectionSalariesExpenses")}
      </p>

      <dl className="mt-4 space-y-3.5">
        {items.map((item) => {
          const unknown = item.fromServer && !summary.financeLoaded;
          return (
            <div key={t(item.label)}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <dt className="truncate text-muted-foreground">
                  {t(item.label)}
                </dt>
                <dd
                  className={cn(
                    "font-semibold tabular-nums",
                    unknown ? "text-muted-foreground/40" : item.tone,
                  )}
                  data-loaded={summary.financeLoaded}
                >
                  {unknown ? "—" : money(item.value)}
                </dd>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary">
                {!unknown && (
                  <div
                    className={cn("h-full rounded-full transition-all", item.bar)}
                    style={{
                      width: `${Math.round((Math.abs(item.value) / scale) * 100)}%`,
                    }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </dl>

      <div className="mt-5 flex items-baseline justify-between gap-3 border-t pt-4">
        <span className="text-sm font-medium">
          {t("expensesSummaryCards.netIncome")}
        </span>
        <span
          className={cn(
            "text-xl font-bold tabular-nums",
            !summary.financeLoaded
              ? "text-muted-foreground"
              : net < 0
                ? "text-rose-600 dark:text-rose-400"
                : "text-emerald-600 dark:text-emerald-400",
          )}
        >
          {summary.financeLoaded ? money(net) : "—"}
        </span>
      </div>
    </div>
  );
}
