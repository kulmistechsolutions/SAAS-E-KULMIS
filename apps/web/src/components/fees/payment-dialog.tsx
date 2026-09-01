"use client";


import { useT } from "@/lib/i18n/provider";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { money } from "@/lib/fees/format";
import {
  canPayAdvance,
  canPayPartial,
  canPayThisMonth,
  collectPayment,
  getFeeBillingMode,
  getFeesState,
  outstandingBalance,
  outstandingBreakdown,
  studentCharges,
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
  const t = useT();
  const [type, setType] = useState<PaymentType>("THIS_MONTH");
  const [amount, setAmount] = useState("");
  const [advanceMonths, setAdvanceMonths] = useState("1");
  const [submitting, setSubmitting] = useState(false);

  const outstanding = student ? outstandingBalance(student.studentId) : 0;
  const breakdown = useMemo(
    () =>
      student
        ? outstandingBreakdown(student.studentId)
        : { thisMonth: null, arrears: [], other: [], total: 0 },
    [student],
  );

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
      if (getFeeBillingMode() === "ACADEMIC_YEAR") {
        const next = studentCharges(student.studentId)
          .filter((c) => c.status !== "INACTIVE" && c.balance > 0 && !c.advanceCovered)
          .sort((a, b) => a.monthKey.localeCompare(b.monthKey))[0];
        return next?.balance ?? 0;
      }
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
    const res = await collectPayment({
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
      title={t("feesPaymentDialog.collectPayment")}
      description={student ? `${student.fullName} (${student.code})` : undefined}
      className="max-w-md"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t("feesPaymentDialog.cancel")}
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
              <p className="text-xs text-muted-foreground">{t("feesPaymentDialog.monthlyFee")}</p>
              <p className="font-semibold tabular-nums">{money(student.monthlyFee)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("feesPaymentDialog.outstanding")}</p>
              <p className="font-semibold tabular-nums text-rose-600">
                {money(outstanding)}
              </p>
            </div>
          </div>

          <div>
            <Label required>{t("feesPaymentDialog.paymentType")}</Label>
            <Select
              className="mt-1.5"
              value={type}
              onChange={(e) => setType(e.target.value as PaymentType)}
            >
              <option value="THIS_MONTH" disabled={!thisMonthOk}>
                {t("feesPaymentDialog.thisMonth")} {!thisMonthOk ? "(unavailable)" : ""}
              </option>
              <option value="PARTIAL" disabled={!partialOk}>
                {t("feesPaymentDialog.partialPayment")} {!partialOk ? "(unavailable)" : ""}
              </option>
              <option value="ADVANCE" disabled={!advanceOk}>
                {t("feesPaymentDialog.advancePayment")} {!advanceOk ? "(unavailable)" : ""}
              </option>
            </Select>
          </div>

          {/* What is owed, split the way the desk thinks about it: this
              month's fee, what is still carried from earlier months, and
              anything that is not tuition. One lump under a heading reading
              "Month(s)" could not tell them apart, and named an admission fee
              as a month the family had supposedly not paid. */}
          {breakdown.total > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-900/50 dark:bg-amber-950/30">
              <dl className="space-y-1.5">
                {breakdown.thisMonth && (
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-amber-900 dark:text-amber-200">
                      {breakdown.thisMonth.label}
                      <span className="ms-1.5 text-xs text-muted-foreground">
                        {t("feesPaymentDialog.thisMonth")}
                      </span>
                    </dt>
                    <dd className="shrink-0 font-semibold tabular-nums text-amber-900 dark:text-amber-200">
                      {money(breakdown.thisMonth.balance)}
                    </dd>
                  </div>
                )}
                {breakdown.arrears.map((l) => (
                  <div key={l.key} className="flex items-center justify-between gap-3">
                    <dt className="text-amber-900 dark:text-amber-200">
                      {l.label}
                      <span className="ms-1.5 text-xs text-rose-600 dark:text-rose-400">
                        {t("feesPaymentDialog.arrears")}
                      </span>
                    </dt>
                    <dd className="shrink-0 font-semibold tabular-nums text-amber-900 dark:text-amber-200">
                      {money(l.balance)}
                    </dd>
                  </div>
                ))}
                {breakdown.other.map((l) => (
                  <div key={l.key} className="flex items-center justify-between gap-3">
                    <dt className="text-amber-900 dark:text-amber-200">{l.label}</dt>
                    <dd className="shrink-0 font-semibold tabular-nums text-amber-900 dark:text-amber-200">
                      {money(l.balance)}
                    </dd>
                  </div>
                ))}
                <div className="flex items-center justify-between gap-3 border-t border-amber-300/60 pt-1.5 dark:border-amber-800/60">
                  <dt className="font-medium text-amber-900 dark:text-amber-200">
                    {t("feesPaymentDialog.totalOwed")}
                  </dt>
                  <dd className="shrink-0 font-bold tabular-nums text-amber-900 dark:text-amber-100">
                    {money(breakdown.total)}
                  </dd>
                </div>
              </dl>
            </div>
          )}

          {type === "PARTIAL" && (
            <div className="space-y-3">
              <div>
                <Label required>{t("feesPaymentDialog.paymentAmount")}</Label>
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
              <Label required>{t("feesPaymentDialog.numberOfMonths")}</Label>
              <Select
                className="mt-1.5"
                value={advanceMonths}
                onChange={(e) => setAdvanceMonths(e.target.value)}
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={String(n)}>
                    {n} {t("feesPaymentDialog.month")}{n > 1 ? "s" : ""} — {money(student.monthlyFee * n)}
                  </option>
                ))}
              </Select>
            </div>
          )}

          {type === "THIS_MONTH" && thisMonthOk && (
            <p className="text-sm text-muted-foreground">
              {getFeeBillingMode() === "ACADEMIC_YEAR"
                ? "Pays the next unpaid month in full:"
                : "Pays the active month fee in full:"}{" "}
              <span className="font-semibold text-foreground">
                {money(previewAmount)}
              </span>
            </p>
          )}
        </div>
      )}
    </Dialog>
  );
}
