"use client";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { SCHOOL } from "@/lib/students/constants";
import { getState as getStudentsState } from "@/lib/students/store";
import { money, monthLabel, paymentTypeLabel, receiptDate } from "@/lib/fees/format";
import { printReceipt } from "@/lib/fees/print";
import { outstandingBalance } from "@/lib/fees/store";
import type { FeePayment } from "@/lib/fees/types";

interface ReceiptDialogProps {
  payment: FeePayment | null;
  onClose: () => void;
}

export function ReceiptDialog({ payment, onClose }: ReceiptDialogProps) {
  if (!payment) return null;
  const student = getStudentsState().students.find((s) => s.id === payment.studentId);

  return (
    <Dialog
      open={!!payment}
      onClose={onClose}
      title={`Receipt ${payment.receiptNo}`}
      className="max-w-lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button onClick={() => printReceipt(payment)}>Print Receipt</Button>
        </>
      }
    >
      <div className="space-y-4 rounded-xl border bg-secondary/20 p-5 text-sm">
        <div className="flex items-center gap-3 border-b pb-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-lg font-bold text-white">
            EK
          </span>
          <div>
            <p className="font-semibold">{SCHOOL.name}</p>
            <p className="text-xs text-muted-foreground">Fee Receipt</p>
          </div>
        </div>
        <dl className="grid gap-2">
          <Row label="Student" value={student?.fullName ?? "—"} />
          <Row label="Student ID" value={student?.code ?? "—"} />
          <Row
            label="Class / Section"
            value={`${student?.className ?? "—"} — ${student?.section ?? "—"}`}
          />
          <Row
            label="Payment Type"
            value={paymentTypeLabel(payment.paymentType, payment.advanceMonths)}
          />
          <Row
            label="Month(s)"
            value={payment.monthKeys.map(monthLabel).join(", ") || "—"}
          />
          <Row label="Collected By" value={payment.collectedBy} />
          <Row label="Date" value={receiptDate(payment.collectedAt)} />
          <Row
            label="Outstanding"
            value={money(
              student ? outstandingBalance(student.id) : payment.outstandingAfter,
            )}
          />
        </dl>
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
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
