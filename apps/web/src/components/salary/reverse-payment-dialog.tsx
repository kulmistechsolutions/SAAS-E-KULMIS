"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { useT } from "@/lib/i18n/provider";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { formatMoney } from "@/lib/settings/currency";
import { reverseSalaryPayment } from "@/lib/salary/store";
import { toast } from "@/lib/toast";
import type { SalaryPayment } from "@/lib/salary/types";

interface ReverseSalaryPaymentDialogProps {
  payment: SalaryPayment | null;
  employeeName?: string;
  onClose: () => void;
}

function money(n: number) {
  return formatMoney(n, { decimals: 0 });
}

export function ReverseSalaryPaymentDialog({
  payment,
  employeeName,
  onClose,
}: ReverseSalaryPaymentDialogProps) {
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
    const res = await reverseSalaryPayment(payment.id, reason.trim());
    setSaving(false);
    if (res.ok) {
      toast(t("salaryReversePaymentDialog.reversedSuccess"), "success");
      close();
    } else {
      toast(res.error ?? t("salaryReversePaymentDialog.reverseFailed"), "error");
    }
  };

  return (
    <Dialog
      open={!!payment}
      onClose={close}
      title={t("salaryReversePaymentDialog.title")}
      description={t("salaryReversePaymentDialog.description")}
      className="max-w-md"
      footer={
        <>
          <Button variant="outline" onClick={close} disabled={saving}>
            {t("salaryReversePaymentDialog.cancel")}
          </Button>
          <Button variant="destructive" onClick={submit} disabled={!canSubmit}>
            {saving
              ? t("salaryReversePaymentDialog.reversing")
              : t("salaryReversePaymentDialog.confirmReverse")}
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-sm">
        <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{t("salaryReversePaymentDialog.warning")}</p>
        </div>

        <dl className="grid gap-2 rounded-xl border bg-secondary/20 p-3">
          {employeeName && (
            <Row label={t("salaryReversePaymentDialog.employee")} value={employeeName} />
          )}
          <Row label={t("salaryReversePaymentDialog.amount")} value={money(payment.amount)} />
          <Row
            label={t("salaryReversePaymentDialog.date")}
            value={new Date(payment.paidAt).toLocaleDateString()}
          />
        </dl>

        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            {t("salaryReversePaymentDialog.reasonLabel")}
          </label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t("salaryReversePaymentDialog.reasonPlaceholder")}
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
