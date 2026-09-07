import { useT, type TranslationKey } from "@/lib/i18n/provider";
import type { LucideIcon } from "lucide-react";
import {
  ArrowUpRight,
  Banknote,
  CircleDollarSign,
  Gift,
  Handshake,
  PieChart,
  UserCheck,
  UserX,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { money, monthLabel } from "@/lib/fees/format";
import type { FeeDashboardSummary } from "@/lib/fees/types";

/**
 * What a school needs to know before it needs anything else.
 *
 * Eleven equal cards is not a summary — it is a list, and a school reading it
 * had to work out for itself which four numbers ran the month. Worse, two of
 * the eleven could not be reconciled from the screen: a collection rate of
 * 4.10% sat beside $465 collected and $7,005 expected, which is 6.64%, because
 * the rate was measuring a different thing (how much of *this month's own
 * billing* had settled, while some of the $465 cleared older months) and said
 * so nowhere.
 *
 * So the four that matter are large and carry their own arithmetic underneath
 * — every one of them can be checked against the card beside it — and the
 * counts that were competing with them for attention are a compact second row.
 */

type Primary = {
  key: string;
  label: TranslationKey;
  icon: LucideIcon;
  ring: string;
  value: string;
  amount: (s: FeeDashboardSummary) => string;
  /** The line that shows where the number came from. */
  note: (s: FeeDashboardSummary, month: string) => string;
  metric: keyof FeeDashboardSummary;
};

const PRIMARY: Primary[] = [
  {
    key: "expected",
    label: "feesSummaryCards.totalExpected",
    icon: Wallet,
    ring: "bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400",
    value: "text-sky-600 dark:text-sky-400",
    amount: (s) => money(s.expectedMonthlyIncome),
    note: (s, m) => `${s.totalActiveStudents} · ${monthLabel(m)}`,
    metric: "expectedMonthlyIncome",
  },
  {
    key: "collected",
    label: "feesSummaryCards.totalCollected",
    icon: Banknote,
    ring: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400",
    value: "text-emerald-600 dark:text-emerald-400",
    amount: (s) => money(s.collectedThisMonth),
    note: (s) => `+ ${money(s.collectedToday)}`,
    metric: "collectedThisMonth",
  },
  {
    key: "outstanding",
    label: "feesSummaryCards.totalOutstandingNow",
    icon: CircleDollarSign,
    ring: "bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400",
    value: "text-rose-600 dark:text-rose-400",
    amount: (s) => money(s.outstandingThisMonth),
    note: (s) => `${s.unpaidStudents + s.partialPayments}`,
    metric: "outstandingThisMonth",
  },
  {
    key: "rate",
    label: "feesSummaryCards.collectionRate",
    icon: PieChart,
    ring: "bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400",
    value: "text-violet-600 dark:text-violet-400",
    // Divided from the two cards beside it rather than taken from a separate
    // figure, so the three can never disagree on screen.
    amount: (s) =>
      s.expectedMonthlyIncome > 0
        ? `${((s.collectedThisMonth / s.expectedMonthlyIncome) * 100).toFixed(2)}%`
        : "—",
    note: (s) => `${money(s.collectedThisMonth)} / ${money(s.expectedMonthlyIncome)}`,
    metric: "collectionPercentage",
  },
];

const SECONDARY: {
  key: keyof FeeDashboardSummary;
  label: TranslationKey;
  icon: LucideIcon;
  tone: string;
}[] = [
  {
    key: "fullyPaidStudents",
    label: "feesSummaryCards.paid",
    icon: UserCheck,
    tone: "text-emerald-600 dark:text-emerald-400",
  },
  {
    key: "partialPayments",
    label: "feesSummaryCards.partial",
    icon: PieChart,
    tone: "text-amber-600 dark:text-amber-400",
  },
  {
    key: "unpaidStudents",
    label: "feesSummaryCards.unpaid",
    icon: UserX,
    tone: "text-rose-600 dark:text-rose-400",
  },
  {
    key: "freeStudents",
    label: "feesSummaryCards.free",
    icon: Gift,
    tone: "text-teal-600 dark:text-teal-400",
  },
  {
    key: "advancePayments",
    label: "feesSummaryCards.advance",
    icon: ArrowUpRight,
    tone: "text-purple-600 dark:text-purple-400",
  },
  {
    key: "totalOutstanding",
    label: "feesSummaryCards.allMonthsOwed",
    icon: Handshake,
    tone: "text-slate-600 dark:text-slate-300",
  },
];

export function FeeSummaryCards({
  summary,
  month,
  onOpenDetails,
}: {
  summary: FeeDashboardSummary;
  month: string;
  onOpenDetails?: (metric: keyof FeeDashboardSummary) => void;
}) {
  const t = useT();
  return (
    <div className="space-y-3">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {PRIMARY.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => onOpenDetails?.(c.metric)}
            className="group rounded-2xl border bg-card p-5 text-start shadow-sm transition hover:border-primary/40 hover:shadow-md"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t(c.label)}
              </p>
              <span
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                  c.ring,
                )}
              >
                <c.icon className="h-4 w-4" />
              </span>
            </div>
            <p
              className={cn(
                "mt-3 text-3xl font-bold tabular-nums tracking-tight",
                c.value,
              )}
            >
              {c.amount(summary)}
            </p>
            <p className="mt-1 text-xs tabular-nums text-muted-foreground">
              {c.note(summary, month)}
            </p>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {SECONDARY.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => onOpenDetails?.(c.key)}
            className="flex items-center gap-3 rounded-xl border bg-card px-3 py-2.5 text-start transition hover:border-primary/40 hover:shadow-sm"
          >
            <c.icon className={cn("h-4 w-4 shrink-0", c.tone)} />
            <span className="min-w-0">
              <span
                className={cn(
                  "block text-lg font-semibold leading-none tabular-nums",
                  c.tone,
                )}
              >
                {c.key === "totalOutstanding"
                  ? money(summary[c.key] as number)
                  : (summary[c.key] as number).toLocaleString()}
              </span>
              <span className="mt-1 block truncate text-[11px] text-muted-foreground">
                {t(c.label)}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
