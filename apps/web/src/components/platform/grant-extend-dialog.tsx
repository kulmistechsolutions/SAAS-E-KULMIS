"use client";


import { useT } from "@/lib/i18n/provider";
import { useEffect, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { PlatformSchoolSubscriptionRow } from "@/lib/platform/api";

type Resource = "STUDENT" | "TEACHER" | "AI_GRADING";

interface Props {
  open: boolean;
  onClose: () => void;
  row: PlatformSchoolSubscriptionRow | null;
  onSubmit: (resource: Resource, quantity: number) => Promise<void>;
}

export function GrantExtendDialog({ open, onClose, row, onSubmit }: Props) {
  const t = useT();
  const [resource, setResource] = useState<Resource>("STUDENT");
  const [quantity, setQuantity] = useState("10");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setResource("STUDENT");
    setQuantity("10");
    setError(null);
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const value = Number(quantity);
    if (!Number.isInteger(value) || value < 1) {
      return setError(t("platformGrantExtendDialog.enterAWholeNumberGreaterThan"));
    }
    setSubmitting(true);
    try {
      await onSubmit(resource, value);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to grant extend.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`${t("platformGrantExtendDialog.grantExtend")} — ${row?.school.name ?? ""}`}
      description={t("platformGrantExtendDialog.addsCapacityImmediatelyFreeOfCharge")}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            {t("platformGrantExtendDialog.cancel")}
          </Button>
          <Button type="submit" form="grant-extend-form" disabled={submitting}>
            {submitting ? t("platformGrantExtendDialog.granting") : t("platformGrantExtendDialog.grant")}
          </Button>
        </>
      }
    >
      <form id="grant-extend-form" onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div
            role="alert"
            className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-600 dark:text-rose-400"
          >
            {error}
          </div>
        )}
        <div>
          <Label>{t("platformGrantExtendDialog.resource")}</Label>
          <Select value={resource} onChange={(e) => setResource(e.target.value as Resource)}>
            <option value="STUDENT">{t("platformGrantExtendDialog.students")}</option>
            <option value="TEACHER">{t("platformGrantExtendDialog.teachers")}</option>
            <option value="AI_GRADING">{t("platformGrantExtendDialog.aiGradingCredits")}</option>
          </Select>
        </div>
        <div>
          <Label>{t("platformGrantExtendDialog.howManyMoreUnits")}</Label>
          <Input
            type="number"
            min={1}
            step={1}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {t("platformGrantExtendDialog.resetsToThePlansBaseCapacity")}
        </p>
      </form>
    </Dialog>
  );
}
