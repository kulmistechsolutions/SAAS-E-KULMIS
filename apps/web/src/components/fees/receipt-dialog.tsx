"use client";


import { useState } from "react";
import { useT } from "@/lib/i18n/provider";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useSchoolBranding } from "@/lib/settings/use-school-branding";
import { getState as getStudentsState } from "@/lib/students/store";
import { money, monthLabel, paymentTypeLabel, receiptDate } from "@/lib/fees/format";
import { printReceipt } from "@/lib/fees/print";
import { outstandingBalance, recordReceiptPrint } from "@/lib/fees/store";
import type { FeePayment } from "@/lib/fees/types";
import { PaperPicker } from "@/components/print/paper-picker";
import type { PaperSize } from "@/lib/print/paper";

interface ReceiptDialogProps {
  payment: FeePayment | null;
  onClose: () => void;
}

export function ReceiptDialog({ payment, onClose }: ReceiptDialogProps) {
  const t = useT();
  const branding = useSchoolBranding();
  const [paper, setPaper] = useState<PaperSize>();
  if (!payment) return null;
  const student = getStudentsState().students.find((s) => s.id === payment.studentId);

  return (
    <Dialog
      open={!!payment}
      onClose={onClose}
      title={`${t("feesReceiptDialog.feeReceipt")} ${payment.receiptNo}`}
      className="max-w-lg"
      footer={
        <>
          {/* The size sits with the button that uses it, not in Settings —
              a desk switches between A5 slips and the roll printer during
              the same morning. */}
          <PaperPicker value={paper} onChange={setPaper} className="me-auto" />
          <Button variant="outline" onClick={onClose}>
            {t("feesReceiptDialog.close")}
          </Button>
          <Button
            onClick={() => {
              recordReceiptPrint(payment.id);
              printReceipt(payment, paper);
            }}
          >
            {t("feesReceiptDialog.printReceipt")}
          </Button>
        </>
      }
    >
      <div className="space-y-4 rounded-xl border bg-secondary/20 p-5 text-sm">
        <div className="flex items-center gap-3 border-b pb-4">
          {branding.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={branding.logoUrl}
              alt={branding.name}
              className="h-12 w-12 rounded-xl object-contain"
            />
          ) : (
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-lg font-bold text-white">
              {branding.name.slice(0, 2).toUpperCase()}
            </span>
          )}
          <div>
            <p className="font-semibold">{branding.name}</p>
            <p className="text-xs text-muted-foreground">{t("feesReceiptDialog.feeReceipt")}</p>
          </div>
        </div>
        <dl className="grid gap-2">
          <Row label={t("feesReceiptDialog.student")} value={student?.fullName ?? "—"} />
          <Row label={t("feesReceiptDialog.studentId")} value={student?.code ?? "—"} />
          <Row
            label={t("feesReceiptDialog.classSection")}
            value={`${student?.className ?? "—"} — ${student?.section ?? "—"}`}
          />
          <Row
            label={t("feesReceiptDialog.paymentType")}
            value={paymentTypeLabel(payment.paymentType, payment.advanceMonths)}
          />
          <Row
            label={t("feesReceiptDialog.monthS")}
            value={payment.monthKeys.map(monthLabel).join(", ") || "—"}
          />
          <Row label={t("feesReceiptDialog.collectedBy")} value={payment.collectedBy} />
          <Row label={t("feesReceiptDialog.date")} value={receiptDate(payment.collectedAt)} />
          <Row
            label={t("feesReceiptDialog.outstanding")}
            value={money(
              student ? outstandingBalance(student.id) : payment.outstandingAfter,
            )}
          />
        </dl>

        {/* What the money settled, itemised. The printed receipt has named
            each charge for a while; the copy the desk actually looks at said
            only "Partial Payment" and a dash, which is the one moment it
            matters — the family is standing there. */}
        {payment.lines && payment.lines.length > 0 && (
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-secondary/50 text-xs uppercase text-muted-foreground">
                  <th className="px-3 py-2 text-start font-medium">
                    {t("feesReceiptPrint.paidFor")}
                  </th>
                  <th className="px-3 py-2 text-end font-medium">
                    {t("feesReceiptPrint.amountCol")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {payment.lines.map((l, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="px-3 py-2">{l.label}</td>
                    <td className="px-3 py-2 text-end tabular-nums">{money(l.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-secondary/50 font-semibold">
                  <td className="px-3 py-2">{t("feesReceiptPrint.totalPaid")}</td>
                  <td className="px-3 py-2 text-end tabular-nums">{money(payment.amount)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        <p className="border-t pt-4 text-center text-2xl font-bold text-emerald-600">
          {money(payment.amount)}
        </p>
      </div>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-end font-medium">{value}</dd>
    </div>
  );
}
