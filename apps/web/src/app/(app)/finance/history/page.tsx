"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Eye, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { PaymentTypeBadge } from "@/components/fees/fee-status-badge";
import { ReceiptDialog } from "@/components/fees/receipt-dialog";
import { money, shortDate } from "@/lib/fees/format";
import { exportPaymentsCsv, printReceipt } from "@/lib/fees/print";
import { getPayment, useFeesState } from "@/lib/fees/store";
import { getState as getStudentsState } from "@/lib/students/store";

const PAGE_SIZE = 15;

export default function FeeHistoryPage() {
  const [mounted, setMounted] = useState(false);
  const fees = useFeesState();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [receiptNo, setReceiptNo] = useState<string | null>(null);
  useEffect(() => setMounted(true), []);

  const students = getStudentsState().students;
  const filtered = useMemo(() => {
    if (!mounted) return [];
    const q = search.trim().toLowerCase();
    return fees.payments.filter((p) => {
      if (!q) return true;
      const st = students.find((s) => s.id === p.studentId);
      return (
        p.receiptNo.toLowerCase().includes(q) ||
        st?.fullName.toLowerCase().includes(q) ||
        st?.code.toLowerCase().includes(q)
      );
    });
  }, [mounted, fees.payments, search, students]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const receipt = receiptNo ? getPayment(receiptNo) ?? null : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Fee History</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            All recorded payments with receipts.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="h-9"
            onClick={() => exportPaymentsCsv(fees.payments)}
          >
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      <Input
        placeholder="Search receipt, student name or ID…"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
        className="max-w-md"
      />

      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-sm">
            <thead className="sticky top-0 bg-secondary text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Receipt No.</th>
                <th className="px-4 py-2.5 font-medium">Student</th>
                <th className="px-4 py-2.5 font-medium">Class-Section</th>
                <th className="px-4 py-2.5 font-medium">Amount</th>
                <th className="px-4 py-2.5 font-medium">Type</th>
                <th className="px-4 py-2.5 font-medium">Collected By</th>
                <th className="px-4 py-2.5 font-medium">Date</th>
                <th className="px-4 py-2.5 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const st = students.find((s) => s.id === p.studentId);
                return (
                  <tr key={p.id} className="border-t">
                    <td className="px-4 py-2.5 font-medium text-primary">{p.receiptNo}</td>
                    <td className="px-4 py-2.5">{st?.fullName ?? "—"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {st?.className} - {st?.section}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums font-medium">{money(p.amount)}</td>
                    <td className="px-4 py-2.5">
                      <PaymentTypeBadge type={p.paymentType} advanceMonths={p.advanceMonths} />
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{p.collectedBy}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{shortDate(p.collectedAt)}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => setReceiptNo(p.receiptNo)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-primary hover:bg-primary/10"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => printReceipt(p)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary"
                        >
                          <Printer className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="border-t px-4 py-3">
          <Pagination
            page={page}
            pageCount={pageCount}
            total={filtered.length}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        </div>
      </div>

      <ReceiptDialog payment={receipt} onClose={() => setReceiptNo(null)} />
    </div>
  );
}
