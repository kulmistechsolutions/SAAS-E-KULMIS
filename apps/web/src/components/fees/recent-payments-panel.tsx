"use client";

import { useState } from "react";
import Link from "next/link";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { money, shortDate } from "@/lib/fees/format";
import type { RecentPaymentRow, StudentFeeRow } from "@/lib/fees/types";
import { PaymentTypeBadge, FeeStatusBadge } from "./fee-status-badge";
import { cn } from "@/lib/utils";

interface RecentPaymentsPanelProps {
  recent: RecentPaymentRow[];
  outstanding: StudentFeeRow[];
  onViewReceipt: (receiptNo: string) => void;
}

export function RecentPaymentsPanel({
  recent,
  outstanding,
  onViewReceipt,
}: RecentPaymentsPanelProps) {
  const [tab, setTab] = useState<"recent" | "outstanding">("recent");

  return (
    <div className="rounded-2xl border bg-card shadow-sm">
      <div className="flex border-b">
        {(
          [
            { id: "recent" as const, label: "Recent Payments" },
            { id: "outstanding" as const, label: "Outstanding Students" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "px-5 py-3.5 text-sm font-medium transition-colors",
              tab === t.id
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        {tab === "recent" ? (
          <table className="w-full min-w-[640px] text-sm">
            <thead className="sticky top-0 bg-secondary/80 text-left text-xs text-muted-foreground backdrop-blur">
              <tr>
                <th className="px-4 py-2.5 font-medium">Receipt No.</th>
                <th className="px-4 py-2.5 font-medium">Student Name</th>
                <th className="px-4 py-2.5 font-medium">Class-Section</th>
                <th className="px-4 py-2.5 font-medium">Amount</th>
                <th className="px-4 py-2.5 font-medium">Payment Type</th>
                <th className="px-4 py-2.5 font-medium">Collected By</th>
                <th className="px-4 py-2.5 font-medium">Date</th>
                <th className="px-4 py-2.5 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((r) => (
                <tr key={r.payment.id} className="border-t">
                  <td className="px-4 py-2.5 font-medium text-primary">
                    {r.payment.receiptNo}
                  </td>
                  <td className="px-4 py-2.5">{r.studentName}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {r.className} - {r.section}
                  </td>
                  <td className="px-4 py-2.5 tabular-nums font-medium">
                    {money(r.payment.amount)}
                  </td>
                  <td className="px-4 py-2.5">
                    <PaymentTypeBadge
                      type={r.payment.paymentType}
                      advanceMonths={r.payment.advanceMonths}
                    />
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {r.payment.collectedBy}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {shortDate(r.payment.collectedAt)}
                  </td>
                  <td className="px-4 py-2.5">
                    <button
                      type="button"
                      onClick={() => onViewReceipt(r.payment.receiptNo)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-primary transition-colors hover:bg-primary/10"
                      aria-label="View receipt"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="w-full min-w-[560px] text-sm">
            <thead className="sticky top-0 bg-secondary/80 text-left text-xs text-muted-foreground backdrop-blur">
              <tr>
                <th className="px-4 py-2.5 font-medium">Student ID</th>
                <th className="px-4 py-2.5 font-medium">Student Name</th>
                <th className="px-4 py-2.5 font-medium">Class-Section</th>
                <th className="px-4 py-2.5 font-medium">Outstanding</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {outstanding.map((r) => (
                <tr key={r.studentId} className="border-t">
                  <td className="px-4 py-2.5 font-mono text-xs">{r.code}</td>
                  <td className="px-4 py-2.5">{r.fullName}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {r.className} - {r.section}
                  </td>
                  <td className="px-4 py-2.5 tabular-nums font-medium text-rose-600">
                    {money(r.outstandingBalance)}
                  </td>
                  <td className="px-4 py-2.5">
                    <FeeStatusBadge
                      status={r.status}
                      advanceMonthsLeft={r.advanceMonthsLeft}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="border-t px-4 py-3">
        <Link
          href="/finance/history"
          className="inline-flex h-9 items-center rounded-lg border border-input bg-background px-4 text-sm font-medium transition-colors hover:bg-secondary"
        >
          View All Payments
        </Link>
      </div>
    </div>
  );
}
