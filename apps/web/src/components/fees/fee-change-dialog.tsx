"use client";

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/provider";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { money } from "@/lib/fees/format";
import { apiChangeMonthlyFee, type FeeChangeScope } from "@/lib/fees/api";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

const SCOPES: { id: FeeChangeScope; label: string; help: string }[] = [
  {
    id: "CURRENT_AND_FUTURE",
    label: "feesAdjust.scopeCURRENT_AND_FUTURE",
    help: "feesAdjust.scopeCurrentAndFutureHelp",
  },
  {
    id: "CURRENT_MONTH",
    label: "feesAdjust.scopeCURRENT_MONTH",
    help: "feesAdjust.scopeCurrentHelp",
  },
  {
    id: "FUTURE_MONTHS",
    label: "feesAdjust.scopeFUTURE_MONTHS",
    help: "feesAdjust.scopeFutureHelp",
  },
  {
    id: "ALL_UNPAID",
    label: "feesAdjust.scopeALL_UNPAID",
    help: "feesAdjust.scopeAllUnpaidHelp",
  },
];

/**
 * Change a student's monthly fee, and say how far the change reaches.
 *
 * Changing the fee from the student form gave no way to express intent, so
 * the system had to guess — and either guess is wrong somewhere. "From now
 * on" and "fix the month we are collecting too" are different decisions, and
 * a school making one should not silently get the other.
 */
export function FeeChangeDialog({
  open,
  studentId,
  studentName,
  currentFee,
  onClose,
  onDone,
}: {
  open: boolean;
  studentId: string | null;
  studentName?: string;
  currentFee: number;
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useT();
  const [fee, setFee] = useState("");
  const [scope, setScope] = useState<FeeChangeScope>("CURRENT_AND_FUTURE");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFee(String(currentFee));
    setScope("CURRENT_AND_FUTURE");
    setReason("");
  }, [open, currentFee]);

  const newFee = Number(fee);
  const valid =
    !!studentId &&
    Number.isFinite(newFee) &&
    newFee >= 0 &&
    newFee !== currentFee;

  async function submit() {
    if (!studentId || !valid) return;
    setSaving(true);
    try {
      const res = await apiChangeMonthlyFee({
        studentId,
        newFee,
        scope,
        ...(reason.trim() ? { reason: reason.trim() } : {}),
      });
      toast(
        t("feesAdjust.feeChanged", { count: res.chargesUpdated }),
        "success",
      );
      onDone();
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : t("feesAdjust.failed"), "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("feesAdjust.changeFeeTitle")}
      description={studentName}
      className="max-w-md"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t("feesAdjust.cancel")}
          </Button>
          <Button onClick={() => void submit()} disabled={!valid || saving}>
            {saving ? t("feesAdjust.saving") : t("feesAdjust.apply")}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-xl bg-secondary/50 p-3 text-sm">
          <p className="text-xs text-muted-foreground">
            {t("feesAdjust.currentFee")}
          </p>
          <p className="font-semibold tabular-nums">{money(currentFee)}</p>
        </div>

        <div>
          <Label required>{t("feesAdjust.newFee")}</Label>
          <Input
            className="mt-1.5"
            type="number"
            min={0}
            value={fee}
            onChange={(e) => setFee(e.target.value)}
          />
        </div>

        <div>
          <Label required>{t("feesAdjust.scopeLabel")}</Label>
          <div className="mt-1.5 space-y-2">
            {SCOPES.map((sc) => (
              <button
                key={sc.id}
                type="button"
                onClick={() => setScope(sc.id)}
                className={cn(
                  "w-full rounded-lg border p-3 text-start text-sm transition",
                  scope === sc.id
                    ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                    : "hover:bg-secondary",
                )}
              >
                <span className="block font-medium">{t(sc.label as never)}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {t(sc.help as never)}
                </span>
              </button>
            ))}
          </div>
          {/* Months already settled are never touched, whichever scope is
              picked — a fee changed in October has no business rewriting
              September. Said here so nobody has to wonder. */}
          <p className="mt-2 text-xs text-muted-foreground">
            {t("feesAdjust.paidMonthsSafe")}
          </p>
        </div>

        <div>
          <Label>{t("feesAdjust.reason")}</Label>
          <Input
            className="mt-1.5"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t("feesAdjust.feeReasonPlaceholder")}
            maxLength={300}
          />
        </div>
      </div>
    </Dialog>
  );
}
