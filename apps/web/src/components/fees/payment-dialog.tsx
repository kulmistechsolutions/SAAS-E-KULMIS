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
  // The dropdown is built from what this student actually owes, not from a
  // fixed list: "Registration Fee" is only offered to a student who has one,
  // an exam fee appears under the name the school gave it, and "All" clears
  // everything outstanding in one receipt. Each option carries the charge ids
  // it settles, so the money lands on the debt the receipt will name.
  const [choice, setChoice] = useState("THIS_MONTH");
  const [amount, setAmount] = useState("");
  const [advanceMonths, setAdvanceMonths] = useState("1");
  const [submitting, setSubmitting] = useState(false);
  // Minted once per opening of this dialog for this student. A second click,
  // or a retry after the network stalls, carries the same key — so the server
  // recognises the repeat and returns the original receipt instead of
  // collecting the money again.
  const [attemptKey, setAttemptKey] = useState("");

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

  interface PayOption {
    id: string;
    label: string;
    /** Fixed total, or undefined for the ones the user types/picks. */
    total?: number;
    chargeIds?: string[];
    type: PaymentType;
  }

  const options = useMemo<PayOption[]>(() => {
    const list: PayOption[] = [];
    if (breakdown.thisMonth) {
      list.push({
        id: "THIS_MONTH",
        label: `${t("feesPaymentDialog.thisMonth")} — ${breakdown.thisMonth.label}`,
        total: breakdown.thisMonth.balance,
        chargeIds: [breakdown.thisMonth.key],
        type: "THIS_MONTH",
      });
    }
    // Each earlier month and each non-tuition charge stands on its own, so a
    // school can take exactly the one the family came to settle.
    for (const l of breakdown.arrears) {
      list.push({
        id: `C:${l.key}`,
        label: `${l.label} — ${t("feesPaymentDialog.arrears")}`,
        total: l.balance,
        chargeIds: [l.key],
        type: "PARTIAL",
      });
    }
    for (const l of breakdown.other) {
      list.push({
        id: `C:${l.key}`,
        label: l.label,
        total: l.balance,
        chargeIds: [l.key],
        type: "PARTIAL",
      });
    }
    // "All" settles the whole balance at once. It is deliberately not an
    // advance: paying ahead is a separate decision, and rolling it in here
    // would take next month's money from a parent clearing this month's.
    if (breakdown.total > 0 && list.length > 1) {
      list.push({
        id: "ALL",
        label: `${t("feesPaymentDialog.payAll")} — ${money(breakdown.total)}`,
        total: breakdown.total,
        chargeIds: [
          ...(breakdown.thisMonth ? [breakdown.thisMonth.key] : []),
          ...breakdown.arrears.map((l) => l.key),
          ...breakdown.other.map((l) => l.key),
        ],
        type: "PARTIAL",
      });
    }
    if (partialOk) {
      list.push({ id: "PARTIAL", label: t("feesPaymentDialog.partialPayment"), type: "PARTIAL" });
    }
    if (advanceOk) {
      list.push({ id: "ADVANCE", label: t("feesPaymentDialog.advancePayment"), type: "ADVANCE" });
    }
    return list;
  }, [breakdown, partialOk, advanceOk, t]);

  const selected = options.find((o) => o.id === choice) ?? options[0] ?? null;

  useEffect(() => {
    if (!open || !student) return;
    setChoice(options[0]?.id ?? "PARTIAL");
    setAmount("");
    setAdvanceMonths("1");
    setAttemptKey(
      `${student.studentId}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    );
    // Re-seeding on every options change would fight the user's own pick;
    // this runs when the dialog opens on a student, which is when it matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, student]);

  const previewAmount = useMemo(() => {
    if (!student || !selected) return 0;
    if (selected.total !== undefined) return selected.total;
    if (selected.id === "PARTIAL") return Number(amount) || 0;
    if (selected.id === "ADVANCE")
      return student.monthlyFee * (Number(advanceMonths) || 1);
    return 0;
  }, [selected, student, amount, advanceMonths]);

  async function handleSubmit() {
    if (!student) return;
    setSubmitting(true);
    const res = await collectPayment({
      studentId: student.studentId,
      paymentType: selected?.type ?? "PARTIAL",
      amount: selected?.id === "PARTIAL" ? Number(amount) : undefined,
      advanceMonths:
        selected?.id === "ADVANCE" ? Number(advanceMonths) : undefined,
      ...(selected?.chargeIds
        ? { chargeIds: selected.chargeIds, targetedAmount: selected.total }
        : {}),
      idempotencyKey: attemptKey || undefined,
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
              value={selected?.id ?? ""}
              onChange={(e) => setChoice(e.target.value)}
            >
              {options.length === 0 ? (
                <option value="">{t("feesPaymentDialog.nothingToPay")}</option>
              ) : (
                options.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))
              )}
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

          {selected?.id === "PARTIAL" && (
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

          {selected?.id === "ADVANCE" && (
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

          {selected?.chargeIds && (
            <p className="text-sm text-muted-foreground">
              {t("feesPaymentDialog.settlesInFull")}{" "}
              <span className="font-semibold text-foreground">
                {selected.label}
              </span>{" "}
              — <span className="font-semibold text-foreground">{money(previewAmount)}</span>
            </p>
          )}
        </div>
      )}
    </Dialog>
  );
}
