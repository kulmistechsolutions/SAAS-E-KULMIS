"use client";


import { useT } from "@/lib/i18n/provider";
import { useMemo, useState } from "react";
import { Eye, Printer } from "lucide-react";
import { Pagination } from "@/components/ui/pagination";
import { PaymentTypeBadge } from "@/components/fees/fee-status-badge";
import { ReceiptDialog } from "@/components/fees/receipt-dialog";
import { money, shortDate } from "@/lib/fees/format";
import { printReceipt } from "@/lib/fees/print";
import { getPayment, useFeesState } from "@/lib/fees/store";
import { getState as getStudentsState } from "@/lib/students/store";
import { useHydrated } from "@/lib/use-hydrated";


export default function ReceiptsPage() {
  const t = useT();
  const mounted = useHydrated();
  const fees = useFeesState();
  const [page, setPage] = useState(1);
  // How many rows at once. A list of thirteen pages is thirteen clicks
  // to read, and reading all of it is usually why it was opened.
  const [pageSize, setPageSize] = useState(15);
  const [receiptNo, setReceiptNo] = useState<string | null>(null);

  const students = getStudentsState().students;
  const payments = fees.payments;
  const pageCount = Math.max(1, Math.ceil(payments.length / pageSize));
  const rows = payments.slice((page - 1) * pageSize, page * pageSize);
  const receipt = receiptNo ? getPayment(receiptNo) ?? null : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("financeReceipts.receipts")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("financeReceipts.viewPrintAndDownloadPaymentReceipts")}
        </p>
      </div>

      {mounted && (
        <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead className="sticky top-0 bg-secondary text-start text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">{t("financeReceipts.receiptNo")}</th>
                  <th className="px-4 py-2.5 font-medium">{t("financeReceipts.student")}</th>
                  <th className="px-4 py-2.5 font-medium">{t("financeReceipts.amount")}</th>
                  <th className="px-4 py-2.5 font-medium">{t("financeReceipts.type")}</th>
                  <th className="px-4 py-2.5 font-medium">{t("financeReceipts.date")}</th>
                  <th className="px-4 py-2.5 font-medium">{t("financeReceipts.actions")}</th>
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
              pageSize={pageSize}
              onPageSizeChange={(n) => {
                setPageSize(n);
                setPage(1);
              }}
              onPageChange={setPage}
            />
          </div>
        </div>
      )}

      <ReceiptDialog payment={receipt} onClose={() => setReceiptNo(null)} />
    </div>
  );
}
