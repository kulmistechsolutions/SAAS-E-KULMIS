"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  money,
  monthLabel,
  PAYMENT_METHODS,
  paymentMethodLabel,
} from "@/lib/salary/format";
import { getPayroll, paySalary } from "@/lib/salary/store";
import type { PaymentMethod, PayrollRow } from "@/lib/salary/types";
import { toast } from "@/lib/toast";

interface PaymentDialogProps {
  open: boolean;
  row: PayrollRow | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export function SalaryPaymentDialog({
  open,
  row,
  onClose,
  onSuccess,
}: PaymentDialogProps) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("BANK_TRANSFER");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const payroll = row ? getPayroll(row.payrollId) : null;

  useEffect(() => {
    if (!open || !row) return;
    setAmount(String(row.remainingBalance));
    setMethod("BANK_TRANSFER");
    setNotes("");
  }, [open, row]);

  async function handleSubmit(full = false) {
    if (!row || !payroll) return;
    const payAmount = full
      ? payroll.remainingBalance
      : Number(amount) || 0;
    setSubmitting(true);
    const res = await paySalary({
      payrollId: row.payrollId,
      amount: payAmount,
      paymentMethod: method,
      notes: notes || null,
    });
    setSubmitting(false);
    if (!res.ok) {
      toast(res.error ?? "Payment failed", "error");
      return;
    }
    toast(
      full
        ? `Full salary paid for ${row.employeeName}`
        : `Partial payment recorded — ${money(payAmount)}`,
      "success",
    );
    onSuccess?.();
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Pay Salary"
      description={
        row
          ? `${row.employeeName} (${row.employeeCode}) — ${monthLabel(row.payrollMonth)}`
          : undefined
      }
      className="max-w-md"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="outline"
            onClick={() => handleSubmit(false)}
            disabled={submitting || !row || row.status === "PAID"}
          >
            Partial Pay
          </Button>
          <Button
            onClick={() => handleSubmit(true)}
            disabled={submitting || !row || row.status === "PAID"}
          >
            {submitting ? "Processing…" : "Pay Full Amount"}
          </Button>
        </>
      }
    >
      {row && payroll && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 rounded-xl bg-secondary/50 p-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Net Salary</p>
              <p className="font-semibold tabular-nums">{money(row.netSalary)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Already Paid</p>
              <p className="font-semibold tabular-nums">{money(row.amountPaid)}</p>
            </div>
            <div className="col-span-2">
              <p className="text-xs text-muted-foreground">Remaining Balance</p>
              <p className="text-lg font-bold tabular-nums text-rose-600">
                {money(row.remainingBalance)}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pay-amount">Amount Paid</Label>
            <Input
              id="pay-amount"
              type="number"
              min={1}
              max={row.remainingBalance}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pay-method">Payment Method</Label>
            <Select
              id="pay-method"
              value={method}
              onChange={(e) => setMethod(e.target.value as PaymentMethod)}
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {paymentMethodLabel(m)}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pay-notes">Notes (optional)</Label>
            <Textarea
              id="pay-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Payment reference or remarks…"
            />
          </div>
        </div>
      )}
    </Dialog>
  );
}
