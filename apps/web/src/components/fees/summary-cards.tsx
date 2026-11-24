import { useT, type TranslationKey } from "@/lib/i18n/provider";
import type { LucideIcon } from "lucide-react";
import {
  ArrowUpRight,
  Banknote,
  CircleDollarSign,
  FileQuestion,
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
  note: (
    s: FeeDashboardSummary,
    month: string,
    t: (k: TranslationKey) => string,
  ) => string;
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
    note: (s, m, t) =>
      `${s.totalActiveStudents} ${t("feesSummaryCards.students")} · ${monthLabel(m)}`,
    metric: "expectedMonthlyIncome",
  },
  {
    // What has been paid against THIS month's billing, so that the three
    // figures on this row are one arithmetic: expected - settled =
    // outstanding. The card used to show cash taken in the month, which is a
    // different question — a payment taken in September may settle August —
    // and the row therefore never added up. The cash figure is still here,
    // under the number, where it cannot be mistaken for the same thing.
    key: "collected",
    label: "feesSummaryCards.settledThisMonth",
    icon: Banknote,
    ring: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400",
    value: "text-emerald-600 dark:text-emerald-400",
    amount: (s) => money(s.settledThisMonth),
    note: (s, _m, t) =>
      `${money(s.collectedThisMonth)} ${t("feesSummaryCards.cashTaken")} · + ${money(s.collectedToday)} ${t("feesSummaryCards.today")}`,
    metric: "settledThisMonth",
  },
  {
    key: "outstanding",
    label: "feesSummaryCards.totalOutstandingNow",
    icon: CircleDollarSign,
    ring: "bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400",
    value: "text-rose-600 dark:text-rose-400",
    amount: (s) => money(s.outstandingThisMonth),
    note: (s, _m, t) =>
      `${s.unpaidStudents + s.partialPayments} ${t("feesSummaryCards.students")}`,
    metric: "outstandingThisMonth",
  },
  {
    key: "rate",
    label: "feesSummaryCards.collectionRate",
    icon: PieChart,
    ring: "bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400",
    value: "text-violet-600 dark:text-violet-400",
    // Settled against billed, which is what a collection rate means to a
    // school. Dividing cash taken by this month's billing mixed two bases and
    // gave a rate that disagreed with the outstanding figure beside it.
    amount: (s) =>
      s.expectedMonthlyIncome > 0
        ? `${((s.settledThisMonth / s.expectedMonthlyIncome) * 100).toFixed(2)}%`
        : "—",
    note: (s) =>
      `${money(s.settledThisMonth)} / ${money(s.expectedMonthlyIncome)}`,
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
    // On the roll, not free, and carrying no charge for the month. They were
    // counted in the total above and shown in none of these pills, so the row
    // did not add up — and the students nobody has billed, which is the list a
    // school most needs, were the ones it could not see.
    key: "unbilledStudents",
    label: "feesSummaryCards.notBilled",
    icon: FileQuestion,
    tone: "text-amber-600 dark:text-amber-400",
  },
  {
    key: "totalOutstanding",
    label: "feesSummaryCards.allMonthsOwed",
    icon: Handshake,
    tone: "text-slate-600 dark:text-slate-300",
  },
];

/** The soft wash behind each headline card, in its own colour. */
const TINT: Record<string, string> = {
  expected: "from-sky-500/10",
  collected: "from-emerald-500/10",
  outstanding: "from-rose-500/10",
  rate: "from-violet-500/10",
};

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
  const rate =
    summary.expectedMonthlyIncome > 0
      ? Math.min(100, (summary.settledThisMonth / summary.expectedMonthlyIncome) * 100)
      : 0;
  return (
    <div className="space-y-3">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {PRIMARY.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => onOpenDetails?.(c.metric)}
            className={cn(
              "group relative overflow-hidden rounded-2xl border bg-gradient-to-br to-card p-5 text-start shadow-sm transition hover:-translate-y-0.5 hover:shadow-md",
              TINT[c.key],
            )}
          >
            <div className="flex items-start gap-4">
              <span className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl", c.ring)}>
                <c.icon className="h-6 w-6" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-muted-foreground">{t(c.label)}</p>
                <p className={cn("mt-0.5 text-[1.7rem] font-bold leading-tight tabular-nums tracking-tight", c.value)}>
                  {c.amount(summary)}
                </p>
                <p className="mt-1 truncate text-xs tabular-nums text-muted-foreground">
                  {c.note(summary, month, t)}
                </p>
              </div>
            </div>
            {c.key === "rate" && (
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-violet-500/15">
                <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500" style={{ width: `${rate}%` }} />
              </div>
            )}
            <ArrowUpRight className="absolute end-3 top-3 h-4 w-4 text-muted-foreground opacity-0 transition group-hover:opacity-100 rtl:-scale-x-100" />
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
        {SECONDARY.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => onOpenDetails?.(c.key)}
            className="flex items-center gap-3 rounded-xl border bg-card px-3 py-3 text-start shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
          >
            <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/70", c.tone)}>
              <c.icon className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className={cn("block text-lg font-bold leading-none tabular-nums", c.tone)}>
                {c.key === "totalOutstanding"
                  ? money(summary[c.key] as number)
                  : (summary[c.key] as number).toLocaleString()}
              </span>
              <span className="mt-1 block truncate text-[11px] font-medium text-muted-foreground">
                {t(c.label)}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
