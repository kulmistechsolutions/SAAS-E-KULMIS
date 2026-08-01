"use client";


import { useT } from "@/lib/i18n/provider";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { money } from "@/lib/fees/format";
import { collectFamilyPayment } from "@/lib/fees/store";
import type { FamilyFeeRow } from "@/lib/fees/types";
import { toast } from "@/lib/toast";

interface FamilyPaymentDialogProps {
  open: boolean;
  family: FamilyFeeRow | null;
  onClose: () => void;
  onSuccess: (result: {
    parentName: string;
    totalApplied: number;
    unallocated: number;
    receipts: { studentId: string; studentName: string; receiptNumber: string; amountApplied: number }[];
  }) => void;
}

/**
 * One payment applied across every outstanding charge for every active
 * sibling under this parent, oldest first — regardless of which child each
 * charge belongs to. A separate receipt lands on each child's own ledger,
 * but the parent only has to type one amount, once.
 */
export function FamilyPaymentDialog({
  open,
  family,
  onClose,
  onSuccess,
}: FamilyPaymentDialogProps) {
  const t = useT();
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open && family) setAmount(String(family.totalOutstanding || ""));
  }, [open, family]);

  async function handleSubmit() {
    if (!family) return;
    setSubmitting(true);
    const res = await collectFamilyPayment({
      parentId: family.parentId,
      amount: Number(amount),
    });
    setSubmitting(false);
    if (!res.ok || !res.result) {
      toast(res.error ?? "Payment failed", "error");
      return;
    }
    toast(
      `${money(res.result.totalApplied)} applied across ${res.result.receipts.length} student(s).`,
      "success",
    );
    onSuccess(res.result);
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("feesFamilyPaymentDialog.collectForFamily")}
      description={family ? `${family.parentName} (${family.parentCode})` : undefined}
      className="max-w-md"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t("feesPaymentDialog.cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !family || !Number(amount)}>
            {submitting ? "Processing…" : `Pay ${money(Number(amount) || 0)}`}
          </Button>
        </>
      }
    >
      {family && (
        <div className="space-y-4">
          <div className="rounded-xl bg-secondary/50 p-3 text-sm">
            <p className="text-xs text-muted-foreground">
              {t("feesFamilyPaymentDialog.totalOutstandingForThisFamily")}
            </p>
            <p className="font-semibold tabular-nums text-rose-600">
              {money(family.totalOutstanding)}
            </p>
          </div>

          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-secondary/60 text-start text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">{t("feesFamilyPaymentDialog.student")}</th>
                  <th className="px-3 py-2 font-medium">{t("feesFamilyPaymentDialog.class")}</th>
                  <th className="px-3 py-2 text-end font-medium">
                    {t("feesFamilyPaymentDialog.outstanding")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {family.children.map((c) => (
                  <tr key={c.studentId} className="border-t">
                    <td className="px-3 py-2">{c.fullName}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {c.className}
                      {c.section !== "—" ? ` — ${c.section}` : ""}
                    </td>
                    <td className="px-3 py-2 text-end tabular-nums">
                      {money(c.outstandingBalance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <Label required>{t("feesFamilyPaymentDialog.amountToCollect")}</Label>
            <Input
              className="mt-1.5"
              type="number"
              min={1}
              max={family.totalOutstanding}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {t("feesFamilyPaymentDialog.appliedOldestFirstAcrossEveryChild")}
            </p>
          </div>
        </div>
      )}
    </Dialog>
  );
}
