"use client";


import { useT } from "@/lib/i18n/provider";
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

/** Today as YYYY-MM-DD in the browser's own calendar. */
function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Where the date field starts. A payroll month that is already over was paid
 * in that month — settled by hand and only now entered — so it opens on its
 * last day, keeping the money inside the month it belongs to. The current
 * month opens on today.
 */
function defaultPaidDate(payrollMonth: string): string {
  const today = todayKey();
  const [y, m] = payrollMonth.split("-").map(Number);
  if (!y || !m || payrollMonth >= today.slice(0, 7)) return today;
  const last = new Date(y, m, 0).getDate();
  return `${payrollMonth}-${String(last).padStart(2, "0")}`;
}

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
  const t = useT();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("BANK_TRANSFER");
  const [notes, setNotes] = useState("");
  const [paidDate, setPaidDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const payroll = row ? getPayroll(row.payrollId) : null;

  useEffect(() => {
    if (!open || !row) return;
    setAmount(String(row.remainingBalance));
    setMethod("BANK_TRANSFER");
    setNotes("");
    setPaidDate(defaultPaidDate(row.payrollMonth));
  }, [open, row]);

  async function handleSubmit(full = false) {
    if (!row || !payroll) return;
    const payAmount = full
      ? payroll.remainingBalance
      : Number(amount) || 0;
    if (paidDate && paidDate > todayKey()) {
      toast("The payment date cannot be in the future.", "error");
      return;
    }
    setSubmitting(true);
    const res = await paySalary({
      payrollId: row.payrollId,
      amount: payAmount,
      paymentMethod: method,
      notes: notes || null,
      // Today needs no date: the server stamps the real time of day.
      ...(paidDate && paidDate !== todayKey() ? { paidAt: paidDate } : {}),
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
      title={t("salaryPaymentDialog.paySalary")}
      description={
        row
          ? `${row.employeeName} (${row.employeeCode}) — ${monthLabel(row.payrollMonth)}`
          : undefined
      }
      className="max-w-md"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t("salaryPaymentDialog.cancel")}
          </Button>
          <Button
            variant="outline"
            onClick={() => handleSubmit(false)}
            disabled={submitting || !row || row.status === "PAID"}
          >
            {t("salaryPaymentDialog.partialPay")}
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
              <p className="text-xs text-muted-foreground">{t("salaryPaymentDialog.netSalary")}</p>
              <p className="font-semibold tabular-nums">{money(row.netSalary)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("salaryPaymentDialog.alreadyPaid")}</p>
              <p className="font-semibold tabular-nums">{money(row.amountPaid)}</p>
            </div>
            <div className="col-span-2">
              <p className="text-xs text-muted-foreground">{t("salaryPaymentDialog.remainingBalance")}</p>
              <p className="text-lg font-bold tabular-nums text-rose-600">
                {money(row.remainingBalance)}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pay-amount">{t("salaryPaymentDialog.amountPaid")}</Label>
            <Input
              id="pay-amount"
              type="number"
              step="0.01"
              min={0.01}
              max={row.remainingBalance}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pay-date">Payment date</Label>
            <Input
              id="pay-date"
              type="date"
              max={todayKey()}
              value={paidDate}
              onChange={(e) => setPaidDate(e.target.value)}
            />
            {row.payrollMonth < todayKey().slice(0, 7) && (
              <p className="text-xs text-muted-foreground">
                {monthLabel(row.payrollMonth)} is a past month. The payment is
                recorded on this date and counted in {monthLabel(row.payrollMonth)},
                not in the current month.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="pay-method">{t("salaryPaymentDialog.paymentMethod")}</Label>
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
            <Label htmlFor="pay-notes">{t("salaryPaymentDialog.notesOptional")}</Label>
            <Textarea
              id="pay-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("salaryPaymentDialog.paymentReferenceOrRemarks")}
            />
          </div>
        </div>
      )}
    </Dialog>
  );
}
