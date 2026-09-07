"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n/provider";
import { Dialog } from "@/components/ui/dialog";
import { money, monthLabel } from "@/lib/fees/format";
import { apiAllPositions, type StudentPosition } from "@/lib/fees/api";
import { listStudentFees, useFeesState } from "@/lib/fees/store";
import type { FeeDashboardSummary } from "@/lib/fees/types";

/**
 * The rows behind a number on the fee dashboard.
 *
 * Read from `/fees/positions` — the same engine, the same charge lines, that
 * the card itself was summed from. It used to add up the browser's roster
 * instead, and the two sources disagreed on screen: the Expected card read
 * $7,005 while the list it opened totalled $6,935, because a month priced by
 * hand (a discount, an agreement, a mid-month start) is not the student's
 * standing fee. A drill-down that cannot reproduce the figure that opened it
 * is worse than no drill-down: it makes a school doubt both numbers.
 *
 * So nothing here recomputes. Each row is one student's line for the chosen
 * month, and the total is those lines added — the card's own definition
 * rather than a second opinion about it.
 */

export type FeeMetric = keyof FeeDashboardSummary;

const TITLE: Record<FeeMetric, string> = {
  totalOutstanding: "Owed across every month",
  outstandingThisMonth: "Still owed for",
  collectedToday: "Collected today",
  collectedThisMonth: "Collected in",
  collectionPercentage: "Collection rate for",
  fullyPaidStudents: "Fully paid",
  partialPayments: "Part paid",
  unpaidStudents: "Nothing paid yet",
  advancePayments: "Paid ahead",
  freeStudents: "Free students",
  expectedMonthlyIncome: "Expected for",
  netFeeCollection: "Net collection for",
  totalActiveStudents: "Active students",
};

/** Cards whose detail is a list of payments rather than of students. */
const PAYMENT_METRICS: FeeMetric[] = [
  "collectedToday",
  "collectedThisMonth",
  "netFeeCollection",
];

/** The engine's own word for a student, per card. */
const BY_STATE: Partial<Record<FeeMetric, StudentPosition["state"]>> = {
  fullyPaidStudents: "PAID",
  partialPayments: "PARTIAL",
  unpaidStudents: "UNPAID",
  advancePayments: "ADVANCE",
  freeStudents: "FREE",
};

/** One student's numbers for the month on screen. */
interface Row {
  key: string;
  name: string;
  className: string;
  expected: number;
  paid: number;
  outstanding: number;
}

export function FeeMetricBreakdownDialog({
  metric,
  month,
  academicYear,
  classId,
  sectionId,
  onClose,
}: {
  metric: FeeMetric | null;
  month: string;
  academicYear: string;
  /** The dashboard's own narrowing, so the list matches the card. */
  classId?: string;
  sectionId?: string;
  onClose: () => void;
}) {
  const t = useT();
  const fees = useFeesState();
  const [positions, setPositions] = useState<StudentPosition[] | null>(null);
  const [failed, setFailed] = useState(false);

  // Fetched when a card is opened rather than held on the page: it is every
  // charge of every student, which is far more than a summary screen should
  // load before anyone has asked for it.
  useEffect(() => {
    if (!metric || PAYMENT_METRICS.includes(metric)) return;
    let alive = true;
    setPositions(null);
    setFailed(false);
    apiAllPositions({ classId, sectionId })
      .then((rows) => alive && setPositions(rows))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [metric, classId, sectionId]);

  const rows = useMemo<Row[]>(() => {
    if (!metric || !positions || PAYMENT_METRICS.includes(metric)) return [];

    // Every line for the month, not the first one. A student can carry more
    // than one charge in a month — an exam fee, an admission fee beside the
    // tuition — and taking only the first put the dialog $80 below the card it
    // opened from: 127 students, 143 lines.
    const monthTotals = (p: StudentPosition) =>
      p.lines
        .filter((l) => l.monthKey === month && l.status !== "INACTIVE")
        .reduce(
          (acc, l) => ({
            expected: acc.expected + l.expected,
            paid: acc.paid + l.paid,
            outstanding: acc.outstanding + l.outstanding,
          }),
          { expected: 0, paid: 0, outstanding: 0 },
        );

    const state = BY_STATE[metric];
    const wanted = state ? positions.filter((p) => p.state === state) : positions;
    // A card about one month reports that month; the all-months card reports
    // the student's whole position.
    const whole = metric === "totalOutstanding";

    return wanted
      .map((p) => {
        const m = monthTotals(p);
        return {
          key: p.studentId,
          name: p.fullName,
          className: [p.className, p.section].filter(Boolean).join(" - ") || "—",
          expected: whole ? p.expected : m.expected,
          paid: whole ? p.paid : m.paid,
          outstanding: whole ? p.outstanding : m.outstanding,
        };
      })
      .filter((r) => {
        if (metric === "expectedMonthlyIncome") return r.expected > 0;
        if (metric === "totalOutstanding" || metric === "outstandingThisMonth") {
          return r.outstanding > 0;
        }
        return true;
      })
      .sort((a, b) =>
        metric === "expectedMonthlyIncome"
          ? b.expected - a.expected
          : b.outstanding - a.outstanding || a.name.localeCompare(b.name),
      );
  }, [metric, month, positions]);

  const payments = useMemo(() => {
    if (!metric || !PAYMENT_METRICS.includes(metric)) return [];
    const today = new Date().toISOString().slice(0, 10);
    return fees.payments
      .filter((p) =>
        metric === "collectedToday"
          ? p.collectedAt.slice(0, 10) === today
          : p.collectedAt.slice(0, 7) === month.slice(0, 7),
      )
      .sort(
        (a, b) =>
          new Date(b.collectedAt).getTime() - new Date(a.collectedAt).getTime(),
      );
  }, [metric, month, fees]);

  if (!metric) return null;

  const isPayments = PAYMENT_METRICS.includes(metric);
  const loading = !isPayments && positions === null && !failed;

  const total = isPayments
    ? payments.reduce((s, p) => s + p.amount, 0)
    : metric === "expectedMonthlyIncome"
      ? rows.reduce((s, r) => s + r.expected, 0)
      : rows.reduce((s, r) => s + r.outstanding, 0);

  const showsMoney =
    isPayments ||
    metric === "totalOutstanding" ||
    metric === "outstandingThisMonth" ||
    metric === "expectedMonthlyIncome";

  const count = isPayments ? payments.length : rows.length;

  // A payment carries the student's id, not their name; the roster is where
  // the name lives and is already loaded for the page behind this dialog.
  const nameOf = (studentId: string) =>
    listStudentFees({ academicYear, monthKey: month }).find(
      (r) => r.studentId === studentId,
    )?.fullName ?? studentId;

  return (
    <Dialog
      open
      onClose={onClose}
      title={`${TITLE[metric]} ${monthLabel(month)}`}
      className="max-w-3xl"
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {loading
            ? t("feesMetricBreakdown.loading")
            : `${count} ${
                isPayments
                  ? t("feesMetricBreakdown.payments")
                  : t("feesMetricBreakdown.students")
              }${showsMoney ? ` · ${money(total)}` : ""}`}
        </p>

        {failed ? (
          <p className="rounded-lg border border-amber-300/60 bg-amber-50 p-6 text-center text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
            {t("feesMetricBreakdown.couldNotLoad")}
          </p>
        ) : loading ? (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-9 animate-pulse rounded bg-secondary/60" />
            ))}
          </div>
        ) : count === 0 ? (
          <p className="rounded-lg border bg-secondary/30 p-6 text-center text-sm text-muted-foreground">
            {t("feesMetricBreakdown.nothingToShow")}
          </p>
        ) : (
          <div className="max-h-[60vh] overflow-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-secondary/60 text-xs uppercase text-muted-foreground">
                <tr>
                  {isPayments ? (
                    <>
                      <th className="p-2 text-start">{t("feesMetricBreakdown.receipt")}</th>
                      <th className="p-2 text-start">{t("feesMetricBreakdown.student")}</th>
                      <th className="p-2 text-end">{t("feesMetricBreakdown.amount")}</th>
                      <th className="p-2 text-start">{t("feesMetricBreakdown.date")}</th>
                    </>
                  ) : (
                    <>
                      <th className="p-2 text-start">{t("feesMetricBreakdown.student")}</th>
                      <th className="p-2 text-start">{t("feesMetricBreakdown.classLabel")}</th>
                      <th className="p-2 text-end">{t("feesMetricBreakdown.expected")}</th>
                      <th className="p-2 text-end">{t("feesMetricBreakdown.paid")}</th>
                      <th className="p-2 text-end">{t("feesMetricBreakdown.balance")}</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y">
                {isPayments
                  ? payments.map((p) => (
                      <tr key={p.id}>
                        <td className="p-2 font-medium">{p.receiptNo}</td>
                        <td className="p-2">{nameOf(p.studentId)}</td>
                        <td className="p-2 text-end tabular-nums">{money(p.amount)}</td>
                        <td className="p-2 text-muted-foreground">
                          {p.collectedAt.slice(0, 10)}
                        </td>
                      </tr>
                    ))
                  : rows.map((r) => (
                      <tr key={r.key}>
                        <td className="p-2 font-medium">
                          {/* The row is the answer to "which families"; the
                              link is the answer to "why this much". */}
                          <Link
                            href={`/finance/students/${r.key}`}
                            className="text-primary hover:underline"
                            onClick={onClose}
                          >
                            {r.name}
                          </Link>
                        </td>
                        <td className="p-2 text-muted-foreground">{r.className}</td>
                        <td className="p-2 text-end tabular-nums">{money(r.expected)}</td>
                        <td className="p-2 text-end tabular-nums">{money(r.paid)}</td>
                        <td className="p-2 text-end font-medium tabular-nums">
                          {money(r.outstanding)}
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Dialog>
  );
}
