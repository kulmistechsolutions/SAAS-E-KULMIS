"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { useT } from "@/lib/i18n/provider";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { money, receiptDate } from "@/lib/fees/format";
import { reversePayment } from "@/lib/fees/store";
import { toast } from "@/lib/toast";
import type { FeePayment } from "@/lib/fees/types";

interface ReversePaymentDialogProps {
  payment: FeePayment | null;
  studentName?: string;
  onClose: () => void;
}

export function ReversePaymentDialog({
  payment,
  studentName,
  onClose,
}: ReversePaymentDialogProps) {
  const t = useT();
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  if (!payment) return null;

  const canSubmit = reason.trim().length >= 3 && !saving;

  const close = () => {
    setReason("");
    onClose();
  };

  const submit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    const res = await reversePayment(payment.id, reason.trim());
    setSaving(false);
    if (res.ok) {
      toast(t("feesReversePaymentDialog.reversedSuccess", { receipt: payment.receiptNo }), "success");
      close();
    } else {
      toast(res.error ?? t("feesReversePaymentDialog.reverseFailed"), "error");
    }
  };

  return (
    <Dialog
      open={!!payment}
      onClose={close}
      title={t("feesReversePaymentDialog.title")}
      description={t("feesReversePaymentDialog.description")}
      className="max-w-md"
      footer={
        <>
          <Button variant="outline" onClick={close} disabled={saving}>
            {t("feesReversePaymentDialog.cancel")}
          </Button>
          <Button
            variant="destructive"
            onClick={submit}
            disabled={!canSubmit}
          >
            {saving
              ? t("feesReversePaymentDialog.reversing")
              : t("feesReversePaymentDialog.confirmReverse")}
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-sm">
        <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{t("feesReversePaymentDialog.warning")}</p>
        </div>

        <dl className="grid gap-2 rounded-xl border bg-secondary/20 p-3">
          <Row label={t("feesReversePaymentDialog.receipt")} value={payment.receiptNo} />
          {studentName && (
            <Row label={t("feesReversePaymentDialog.student")} value={studentName} />
          )}
          <Row label={t("feesReversePaymentDialog.amount")} value={money(payment.amount)} />
          <Row label={t("feesReversePaymentDialog.date")} value={receiptDate(payment.collectedAt)} />
        </dl>

        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            {t("feesReversePaymentDialog.reasonLabel")}
          </label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t("feesReversePaymentDialog.reasonPlaceholder")}
            maxLength={300}
          />
        </div>
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
