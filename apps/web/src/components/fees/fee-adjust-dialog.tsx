"use client";

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/provider";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { money } from "@/lib/fees/format";
import { apiAdjustCharge, type FeeAdjustmentType } from "@/lib/fees/api";
import { toast } from "@/lib/toast";

export interface AdjustTarget {
  feeChargeId: string;
  label: string;
  /** What the charge asks now. */
  amount: number;
  /** What is still owed on it — the most that can come off. */
  outstanding: number;
}

/**
 * Take an amount off one month, without touching the student's fee.
 *
 * A school that wanted to charge one family less had only the standing fee to
 * pull, which then followed the student into every later month. This keeps the
 * two apart: the fee stays what it is, and this month costs less, with the
 * reason recorded against the month rather than living in somebody's memory.
 */
export function FeeAdjustDialog({
  open,
  target,
  onClose,
  onDone,
}: {
  open: boolean;
  target: AdjustTarget | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useT();
  const [type, setType] = useState<FeeAdjustmentType>("DISCOUNT");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setType("DISCOUNT");
    setAmount("");
    setReason("");
  }, [open, target]);

  // A waiver clears whatever is left; a discount takes off what is typed.
  const takenOff =
    type === "WAIVER" ? (target?.outstanding ?? 0) : Number(amount) || 0;
  const remaining = Math.max(0, (target?.amount ?? 0) - takenOff);
  const valid =
    !!target &&
    reason.trim().length >= 3 &&
    takenOff > 0 &&
    takenOff <= target.outstanding;

  async function submit() {
    if (!target || !valid) return;
    setSaving(true);
    try {
      await apiAdjustCharge({
        feeChargeId: target.feeChargeId,
        type,
        ...(type === "WAIVER" ? {} : { amount: takenOff }),
        reason: reason.trim(),
      });
      toast(t("feesAdjust.saved"), "success");
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
      title={t("feesAdjust.title")}
      description={target?.label}
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
      {target && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 rounded-xl bg-secondary/50 p-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">{t("feesAdjust.charged")}</p>
              <p className="font-semibold tabular-nums">{money(target.amount)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("feesAdjust.stillOwed")}</p>
              <p className="font-semibold tabular-nums text-rose-600">
                {money(target.outstanding)}
              </p>
            </div>
          </div>

          <div>
            <Label required>{t("feesAdjust.type")}</Label>
            <Select
              className="mt-1.5"
              value={type}
              onChange={(e) => setType(e.target.value as FeeAdjustmentType)}
            >
              <option value="DISCOUNT">{t("feesAdjust.discount")}</option>
              <option value="WAIVER">{t("feesAdjust.waiver")}</option>
              <option value="ADJUSTMENT">{t("feesAdjust.adjustment")}</option>
            </Select>
          </div>

          {type !== "WAIVER" && (
            <div>
              <Label required>{t("feesAdjust.amountOff")}</Label>
              <Input
                className="mt-1.5"
                type="number"
                min={1}
                max={target.outstanding}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={`${t("feesAdjust.max")} ${target.outstanding}`}
              />
            </div>
          )}

          <div>
            <Label required>{t("feesAdjust.reason")}</Label>
            <Input
              className="mt-1.5"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("feesAdjust.reasonPlaceholder")}
              maxLength={300}
            />
            {/* Not optional: an adjustment nobody can explain later is the
                thing that made a discount indistinguishable from a mistake. */}
            <p className="mt-1 text-xs text-muted-foreground">
              {t("feesAdjust.reasonHelp")}
            </p>
          </div>

          {takenOff > 0 && (
            <p className="rounded-lg bg-secondary/60 p-3 text-sm">
              {t("feesAdjust.preview", {
                off: money(takenOff),
                left: money(remaining),
              })}
            </p>
          )}
        </div>
      )}
    </Dialog>
  );
}
