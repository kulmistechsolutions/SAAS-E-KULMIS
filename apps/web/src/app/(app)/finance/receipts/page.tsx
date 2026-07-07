"use client";

import { useEffect, useMemo, useState } from "react";
import { Eye, Printer } from "lucide-react";
import { Pagination } from "@/components/ui/pagination";
import { PaymentTypeBadge } from "@/components/fees/fee-status-badge";
import { ReceiptDialog } from "@/components/fees/receipt-dialog";
import { money, shortDate } from "@/lib/fees/format";
import { printReceipt } from "@/lib/fees/print";
import { getPayment, useFeesState } from "@/lib/fees/store";
import { getState as getStudentsState } from "@/lib/students/store";

const PAGE_SIZE = 15;

export default function ReceiptsPage() {
  const [mounted, setMounted] = useState(false);
  const fees = useFeesState();
  const [page, setPage] = useState(1);
  const [receiptNo, setReceiptNo] = useState<string | null>(null);
  useEffect(() => setMounted(true), []);

  const students = getStudentsState().students;
  const payments = fees.payments;
  const pageCount = Math.max(1, Math.ceil(payments.length / PAGE_SIZE));
  const rows = payments.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const receipt = receiptNo ? getPayment(receiptNo) ?? null : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Receipts</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          View, print, and download payment receipts.
        </p>
      </div>

      {mounted && (
        <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead className="sticky top-0 bg-secondary text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Receipt No.</th>
                  <th className="px-4 py-2.5 font-medium">Student</th>
                  <th className="px-4 py-2.5 font-medium">Amount</th>
                  <th className="px-4 py-2.5 font-medium">Type</th>
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
                      <td className="px-4 py-2.5 tabular-nums font-medium">{money(p.amount)}</td>
                      <td className="px-4 py-2.5">
                        <PaymentTypeBadge type={p.paymentType} advanceMonths={p.advanceMonths} />
                      </td>
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
              total={payments.length}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          </div>
        </div>
      )}

      <ReceiptDialog payment={receipt} onClose={() => setReceiptNo(null)} />
    </div>
  );
}
