"use client";

import { useMemo } from "react";
import { useT } from "@/lib/i18n/provider";
import { Dialog } from "@/components/ui/dialog";
import { money, monthLabel } from "@/lib/fees/format";
import { listStudentFees, useFeesState } from "@/lib/fees/store";
import type { FeeDashboardSummary, StudentFeeState } from "@/lib/fees/types";

/**
 * The rows behind a number on the fee dashboard.
 *
 * Every card carried a "View details" link that did nothing — a button with
 * no handler on all eleven of them. A school could see that $684 was
 * outstanding this month and had no way to ask which families that was.
 *
 * The rows here are read through the same functions the cards are summed
 * from, so the list can never disagree with the figure that opened it, and
 * every list is scoped to the month chosen on the dashboard — a card for
 * September must not open August's families.
 */

export type FeeMetric = keyof FeeDashboardSummary;

const STUDENT_STATUS: Partial<Record<FeeMetric, StudentFeeState>> = {
  fullyPaidStudents: "PAID",
  partialPayments: "PARTIAL",
  advancePayments: "ADVANCE_MULTI",
  freeStudents: "FREE",
};

const TITLE: Record<FeeMetric, string> = {
  totalOutstanding: "Everyone who still owes",
  outstandingThisMonth: "Still owed for",
  collectedToday: "Collected today",
  collectedThisMonth: "Collected in",
  collectionPercentage: "Collection rate for",
  fullyPaidStudents: "Fully paid",
  partialPayments: "Part paid",
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

export function FeeMetricBreakdownDialog({
  metric,
  month,
  academicYear,
  onClose,
}: {
  metric: FeeMetric | null;
  month: string;
  academicYear: string;
  onClose: () => void;
}) {
  const t = useT();
  const fees = useFeesState();

  const students = useMemo(() => {
    if (!metric || PAYMENT_METRICS.includes(metric)) return [];
    const status = STUDENT_STATUS[metric];
    const rows = listStudentFees({ academicYear, monthKey: month, status });
    if (status) return rows;
    if (metric === "expectedMonthlyIncome") {
      // A waived student is never charged, so they are not part of what the
      // school expects to receive.
      return rows.filter((r) => !r.feeWaived && r.monthlyFee > 0);
    }
    // Both outstanding cards list the families money is still owed by.
    return rows
      .filter((r) => r.outstandingBalance > 0)
      .sort((a, b) => b.outstandingBalance - a.outstandingBalance);
    // `fees` is here on purpose: listStudentFees reads the store directly, so
    // the store's own version is what tells us the rows may have changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metric, month, academicYear, fees]);

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
  const nameOf = (studentId: string) =>
    listStudentFees({ academicYear, monthKey: month }).find(
      (r) => r.studentId === studentId,
    );

  const total = isPayments
    ? payments.reduce((s, p) => s + p.amount, 0)
    : metric === "expectedMonthlyIncome"
      ? students.reduce((s, r) => s + r.monthlyFee, 0)
      : students.reduce((s, r) => s + r.outstandingBalance, 0);

  const showsMoney =
    isPayments ||
    metric === "totalOutstanding" ||
    metric === "outstandingThisMonth" ||
    metric === "expectedMonthlyIncome";

  return (
    <Dialog
      open
      onClose={onClose}
      title={`${TITLE[metric]} ${monthLabel(month)}`}
      className="max-w-3xl"
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {isPayments ? payments.length : students.length}{" "}
          {isPayments ? t("feesMetricBreakdown.payments") : t("feesMetricBreakdown.students")}
          {showsMoney ? ` · ${money(total)}` : ""}
        </p>

        {(isPayments ? payments.length : students.length) === 0 ? (
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
                      <th className="p-2 text-start">{t("feesMetricBreakdown.parent")}</th>
                      <th className="p-2 text-end">
                        {metric === "expectedMonthlyIncome"
                          ? t("feesMetricBreakdown.monthlyFee")
                          : t("feesMetricBreakdown.outstanding")}
                      </th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {isPayments
                  ? payments.map((p) => (
                      <tr key={p.id} className="border-t">
                        <td className="p-2 font-mono text-xs">{p.receiptNo}</td>
                        <td className="p-2">
                          {nameOf(p.studentId)?.fullName ?? "—"}
                        </td>
                        <td className="p-2 text-end tabular-nums">
                          {money(p.amount)}
                        </td>
                        <td className="p-2">{p.collectedAt.slice(0, 10)}</td>
                      </tr>
                    ))
                  : students.map((r) => (
                      <tr key={r.studentId} className="border-t">
                        <td className="p-2">{r.fullName}</td>
                        <td className="p-2">
                          {r.className}
                          {r.section && r.section !== "—" ? ` — ${r.section}` : ""}
                        </td>
                        <td className="p-2 text-muted-foreground">{r.parentName}</td>
                        <td className="p-2 text-end tabular-nums">
                          {money(
                            metric === "expectedMonthlyIncome"
                              ? r.monthlyFee
                              : r.outstandingBalance,
                          )}
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
