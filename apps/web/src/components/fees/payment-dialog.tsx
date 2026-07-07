"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { money, monthLabel } from "@/lib/fees/format";
import {
  canPayAdvance,
  canPayPartial,
  canPayThisMonth,
  collectPayment,
  getFeesState,
  outstandingBalance,
  partialOutstandingMonths,
} from "@/lib/fees/store";
import type { FeePayment, PaymentType, StudentFeeRow } from "@/lib/fees/types";
import { toast } from "@/lib/toast";

interface PaymentDialogProps {
  open: boolean;
  student: StudentFeeRow | null;
  onClose: () => void;
  onSuccess: (payment: FeePayment) => void;
}

export function PaymentDialog({
  open,
  student,
  onClose,
  onSuccess,
}: PaymentDialogProps) {
  const [type, setType] = useState<PaymentType>("THIS_MONTH");
  const [amount, setAmount] = useState("");
  const [advanceMonths, setAdvanceMonths] = useState("1");
  const [submitting, setSubmitting] = useState(false);

  const outstanding = student ? outstandingBalance(student.studentId) : 0;
  const outstandingMonths = student
    ? partialOutstandingMonths(student.studentId).map(monthLabel)
    : [];

  const thisMonthOk = student ? canPayThisMonth(student.studentId) : false;
  const partialOk = student ? canPayPartial(student.studentId) : false;
  const advanceOk = student ? canPayAdvance(student.studentId) : false;

  useEffect(() => {
    if (!open || !student) return;
    if (thisMonthOk) setType("THIS_MONTH");
    else if (partialOk) setType("PARTIAL");
    else if (advanceOk) setType("ADVANCE");
    setAmount("");
    setAdvanceMonths("1");
  }, [open, student, thisMonthOk, partialOk, advanceOk]);

  const previewAmount = useMemo(() => {
    if (!student) return 0;
    if (type === "THIS_MONTH") {
      const s = getFeesState();
      const charge = s.charges.find(
        (c) =>
          c.studentId === student.studentId &&
          c.monthKey === s.activeMonthKey &&
          !c.advanceCovered,
      );
      return charge?.balance ?? 0;
    }
    if (type === "PARTIAL") return Number(amount) || 0;
    if (type === "ADVANCE")
      return student.monthlyFee * (Number(advanceMonths) || 1);
    return 0;
  }, [type, student, amount, advanceMonths]);

  async function handleSubmit() {
    if (!student) return;
    setSubmitting(true);
    const res = collectPayment({
      studentId: student.studentId,
      paymentType: type,
      amount: type === "PARTIAL" ? Number(amount) : undefined,
      advanceMonths: type === "ADVANCE" ? Number(advanceMonths) : undefined,
    });
    setSubmitting(false);
    if (!res.ok) {
      toast(res.error ?? "Payment failed", "error");
      return;
    }
    toast(`Payment recorded — ${res.payment?.receiptNo}`, "success");
    if (res.payment) onSuccess(res.payment);
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Collect Payment"
      description={student ? `${student.fullName} (${student.code})` : undefined}
      className="max-w-md"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !student}>
            {submitting ? "Processing…" : `Pay ${money(previewAmount)}`}
          </Button>
        </>
      }
    >
      {student && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 rounded-xl bg-secondary/50 p-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Monthly Fee</p>
              <p className="font-semibold tabular-nums">{money(student.monthlyFee)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Outstanding</p>
              <p className="font-semibold tabular-nums text-rose-600">
                {money(outstanding)}
              </p>
            </div>
          </div>

          <div>
            <Label required>Payment Type</Label>
            <Select
              className="mt-1.5"
              value={type}
              onChange={(e) => setType(e.target.value as PaymentType)}
            >
              <option value="THIS_MONTH" disabled={!thisMonthOk}>
                This Month {!thisMonthOk ? "(unavailable)" : ""}
              </option>
              <option value="PARTIAL" disabled={!partialOk}>
                Partial Payment {!partialOk ? "(unavailable)" : ""}
              </option>
              <option value="ADVANCE" disabled={!advanceOk}>
                Advance Payment {!advanceOk ? "(unavailable)" : ""}
              </option>
            </Select>
          </div>

          {type === "PARTIAL" && (
            <div className="space-y-3">
              {outstandingMonths.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-900/50 dark:bg-amber-950/30">
                  <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
                    Outstanding Month(s)
                  </p>
                  <p className="mt-1 text-amber-900 dark:text-amber-200">
                    {outstandingMonths.join(", ")}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Remaining balance: {money(outstanding)}
                  </p>
                </div>
              )}
              <div>
                <Label required>Payment Amount</Label>
                <Input
                  className="mt-1.5"
                  type="number"
                  min={1}
                  max={outstanding}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={`Max ${outstanding}`}
                />
              </div>
            </div>
          )}

          {type === "ADVANCE" && (
            <div>
              <Label required>Number of Months</Label>
              <Select
                className="mt-1.5"
                value={advanceMonths}
                onChange={(e) => setAdvanceMonths(e.target.value)}
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={String(n)}>
                    {n} month{n > 1 ? "s" : ""} — {money(student.monthlyFee * n)}
                  </option>
                ))}
              </Select>
            </div>
          )}

          {type === "THIS_MONTH" && thisMonthOk && (
            <p className="text-sm text-muted-foreground">
              Pays the active month fee in full:{" "}
              <span className="font-semibold text-foreground">
                {money(student.outstandingBalance)}
              </span>
            </p>
          )}
        </div>
      )}
    </Dialog>
  );
}
