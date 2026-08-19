"use client";


import { useT } from "@/lib/i18n/provider";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  apiCreatePaymentPromise,
  apiUpdatePaymentPromise,
  type ApiActivePaymentPromise,
} from "@/lib/fees/api";
import { shortDate } from "@/lib/students/format";
import type { StudentFeeRow } from "@/lib/fees/types";
import { toast } from "@/lib/toast";

interface PromiseToPayDialogProps {
  open: boolean;
  student: StudentFeeRow | null;
  /** When set, the dialog edits this promise instead of creating a new one. */
  existing?: ApiActivePaymentPromise | null;
  onClose: () => void;
  onSuccess?: () => void;
}

function tomorrowIso(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function PromiseToPayDialog({
  open,
  student,
  existing,
  onClose,
  onSuccess,
}: PromiseToPayDialogProps) {
  const t = useT();
  const [date, setDate] = useState(tomorrowIso());
  const [note, setNote] = useState("");
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDate(existing ? existing.promisedDate.slice(0, 10) : tomorrowIso());
    setNote(existing?.note ?? "");
    setAmount(existing?.amount != null ? String(existing.amount) : "");
  }, [open, student?.studentId, existing]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!student) return;
    if (!date || !note.trim()) {
      toast(t("feesPromiseToPayDialog.dateAndNoteAreRequired"), "error");
      return;
    }
    setSubmitting(true);
    try {
      if (existing) {
        await apiUpdatePaymentPromise(existing.id, {
          promisedDate: date,
          note: note.trim(),
          amount: amount.trim() ? Number(amount) : null,
        });
        toast(t("feesPromiseToPayDialog.paymentPromiseUpdated"), "success");
      } else {
        await apiCreatePaymentPromise({
          studentId: student.studentId,
          promisedDate: date,
          note: note.trim(),
          amount: amount.trim() ? Number(amount) : undefined,
        });
        toast(t("feesPromiseToPayDialog.paymentPromiseRecorded"), "success");
      }
      onSuccess?.();
      onClose();
    } catch (err) {
      toast(
        err instanceof Error ? err.message : t("feesPromiseToPayDialog.failedToSavePromise"),
        "error",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResolve(status: "FULFILLED" | "CANCELLED") {
    if (!existing) return;
    setSubmitting(true);
    try {
      await apiUpdatePaymentPromise(existing.id, { status });
      toast(
        status === "FULFILLED"
          ? t("feesPromiseToPayDialog.markedAsPaid")
          : t("feesPromiseToPayDialog.promiseCancelled"),
        "success",
      );
      onSuccess?.();
      onClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : t("feesPromiseToPayDialog.failedToSavePromise"), "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={
        existing
          ? t("feesPromiseToPayDialog.editPromise")
          : t("feesPromiseToPayDialog.promiseToPay")
      }
      description={student ? `${student.fullName} · ${student.code}` : undefined}
      className="max-w-md"
      footer={
        <>
          {existing && (
            <>
              <Button
                type="button"
                variant="outline"
                className="me-auto text-rose-600 hover:text-rose-700"
                disabled={submitting}
                onClick={() => void handleResolve("CANCELLED")}
              >
                {t("feesPromiseToPayDialog.cancelPromise")}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={submitting}
                onClick={() => void handleResolve("FULFILLED")}
              >
                {t("feesPromiseToPayDialog.markAsPaid")}
              </Button>
            </>
          )}
          <Button type="button" variant="outline" onClick={onClose}>
            {t("feesPromiseToPayDialog.cancel")}
          </Button>
          <Button type="submit" form="promise-to-pay-form" disabled={submitting}>
            {submitting ? t("feesPromiseToPayDialog.saving") : t("feesPromiseToPayDialog.savePromise")}
          </Button>
        </>
      }
    >
      <form id="promise-to-pay-form" onSubmit={handleSubmit} className="space-y-4">
        {existing && (
          <p className="rounded-lg bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">
            {t("feesPromiseToPayDialog.committedOn")} {shortDate(existing.createdAt)}
          </p>
        )}
        <div>
          <Label>{t("feesPromiseToPayDialog.dateTheyWillPay")}</Label>
          <Input
            type="date"
            className="mt-1.5"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div>
          <Label>{t("feesPromiseToPayDialog.expectedAmountOptional")}</Label>
          <Input
            type="number"
            min={0}
            className="mt-1.5"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={t("feesPromiseToPayDialog.leaveBlankIfUnknown")}
          />
        </div>
        <div>
          <Label>{t("feesPromiseToPayDialog.note")}</Label>
          <Input
            className="mt-1.5"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t("feesPromiseToPayDialog.notePlaceholder")}
          />
        </div>
      </form>
    </Dialog>
  );
}
