"use client";

import { useEffect, useState } from "react";
import { apiStudentPortalFees } from "@/lib/student-portal/api";
import { money } from "@/lib/students/format";
import { Badge } from "@/components/ui/badge";

const MONTH_NAMES = [
  "", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

interface FeeCharge {
  id: string;
  year: number;
  month: number;
  amount: number;
  paidAmount: number;
  status: string;
  kind: string;
  label: string | null;
}

interface FeePayment {
  id: string;
  receiptNumber: string;
  amount: number;
  status: string;
  isReversal: boolean;
  paidAt: string;
}

interface FeesResponse {
  charges: FeeCharge[];
  payments: FeePayment[];
  outstanding: number;
  summary: {
    monthlyFee: number;
    totalAcademicFee: number;
    amountPaid: number;
    outstandingBalance: number;
    paidMonths: number;
    unpaidMonths: number;
    progressPercent: number;
  };
}

const STATUS_TONE: Record<string, "success" | "danger" | "warning" | "muted"> = {
  PAID: "success",
  UNPAID: "danger",
  PARTIAL: "warning",
  INACTIVE: "muted",
};

export default function StudentPortalFeesPage() {
  const [fees, setFees] = useState<FeesResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    void (apiStudentPortalFees() as Promise<FeesResponse>)
      .then(setFees)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="text-muted-foreground">Loading fee information…</p>;
  }

  if (!fees) {
    return <p className="text-muted-foreground">No fee information available.</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Fee Information</h1>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Monthly Fee", value: money(fees.summary.monthlyFee) },
          { label: "Outstanding", value: money(fees.summary.outstandingBalance) },
          { label: "Paid Months", value: String(fees.summary.paidMonths) },
          { label: "Unpaid Months", value: String(fees.summary.unpaidMonths) },
        ].map((c) => (
          <div key={c.label} className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">{c.label}</p>
            <p className="mt-1 text-xl font-bold">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-secondary/50 text-start">
              <th className="px-4 py-3">Month</th>
              <th className="px-4 py-3">Charge</th>
              <th className="px-4 py-3">Paid</th>
              <th className="px-4 py-3">Balance</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {fees.charges.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  No charges yet.
                </td>
              </tr>
            ) : (
              fees.charges.map((c) => (
                <tr key={c.id} className="border-b last:border-0">
                  <td className="px-4 py-3">
                    {c.kind === "MONTHLY" ? `${MONTH_NAMES[c.month]} ${c.year}` : (c.label ?? c.kind)}
                  </td>
                  <td className="px-4 py-3">{money(c.amount)}</td>
                  <td className="px-4 py-3">{money(c.paidAmount)}</td>
                  <td className="px-4 py-3">{money(Math.max(0, c.amount - c.paidAmount))}</td>
                  <td className="px-4 py-3">
                    <Badge tone={STATUS_TONE[c.status] ?? "muted"}>{c.status}</Badge>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {fees.payments.length > 0 && (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <div className="border-b bg-secondary/50 px-4 py-3 text-sm font-medium">
            Payment Transactions
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-secondary/30 text-start">
                <th className="px-4 py-3">Receipt No</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {fees.payments.map((p) => (
                <tr key={p.id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-medium">{p.receiptNumber}</td>
                  <td className="px-4 py-3">{money(p.amount)}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(p.paidAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    {p.isReversal ? (
                      <Badge tone="danger">Reversal</Badge>
                    ) : p.status === "REVERSED" ? (
                      <Badge tone="muted">Reversed</Badge>
                    ) : (
                      <Badge tone="success">Paid</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
