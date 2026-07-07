"use client";

import { useMemo, useState } from "react";
import { Download, Printer, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePortal } from "@/components/parent-portal/portal-context";
import { logPortalAudit, studentPayments } from "@/lib/parent-portal/store";
import { printFeeReceipt } from "@/lib/parent-portal/print";
import { money, shortDate } from "@/lib/students/format";
import { Badge } from "@/components/ui/badge";

export default function ParentPaymentsPage() {
  const { parent, selectedChild } = usePortal();
  const [search, setSearch] = useState("");

  const payments = useMemo(
    () => (selectedChild ? studentPayments(selectedChild.id) : []),
    [selectedChild],
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return payments;
    const q = search.toLowerCase();
    return payments.filter((p) => p.receiptNo.toLowerCase().includes(q));
  }, [payments, search]);

  function handleReceipt(payment: (typeof payments)[0]) {
    if (!selectedChild) return;
    logPortalAudit(parent.id, "RECEIPT_DOWNLOADED", selectedChild.id, payment.receiptNo);
    printFeeReceipt(payment, selectedChild.fullName);
  }

  if (!selectedChild) {
    return <p className="text-muted-foreground">Select a child to view payment history.</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Payment History</h1>
        <p className="mt-1 text-sm text-muted-foreground">{selectedChild.fullName}</p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search receipt number…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-secondary/50 text-left">
              <th className="px-4 py-3">Month(s)</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Receipt</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className="border-b">
                <td className="px-4 py-3">{p.monthKeys.join(", ")}</td>
                <td className="px-4 py-3 font-medium">{money(p.amount)}</td>
                <td className="px-4 py-3">
                  <Badge tone="success">{p.paymentType.replace(/_/g, " ")}</Badge>
                </td>
                <td className="px-4 py-3 font-mono text-xs">{p.receiptNo}</td>
                <td className="px-4 py-3">{shortDate(p.collectedAt)}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <Button onClick={() => handleReceipt(p)}>
                      <Printer className="h-4 w-4" />
                    </Button>
                    <Button onClick={() => handleReceipt(p)}>
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  No payments found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
