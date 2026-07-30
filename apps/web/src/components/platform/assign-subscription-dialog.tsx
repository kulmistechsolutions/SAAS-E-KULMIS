"use client";


import { useT } from "@/lib/i18n/provider";
import { useEffect, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type {
  PlatformSchoolSubscriptionRow,
  PlatformSubscriptionPlan,
} from "@/lib/platform/api";

type CustomDuration = { unit: "DAYS" | "MONTHS"; value: number };

interface Props {
  open: boolean;
  onClose: () => void;
  row: PlatformSchoolSubscriptionRow | null;
  plans: PlatformSubscriptionPlan[];
  onSubmit: (planId: string, customDuration?: CustomDuration) => Promise<void>;
}

export function AssignSubscriptionDialog({
  open,
  onClose,
  row,
  plans,
  onSubmit,
}: Props) {
  const t = useT();
  const [planId, setPlanId] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [durationValue, setDurationValue] = useState("30");
  const [durationUnit, setDurationUnit] = useState<"DAYS" | "MONTHS">("DAYS");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setPlanId(row?.subscription?.plan.id ?? plans[0]?.id ?? "");
    setUseCustom(false);
    setDurationValue("30");
    setDurationUnit("DAYS");
    setError(null);
  }, [open, row, plans]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!planId) return setError(t("platformAssignSubscriptionDialog.selectAPlan"));

    let customDuration: CustomDuration | undefined;
    if (useCustom) {
      const value = Number(durationValue);
      if (!Number.isInteger(value) || value < 1) {
        return setError(t("platformAssignSubscriptionDialog.enterAWholeNumberOf"));
      }
      customDuration = { unit: durationUnit, value };
    }

    setSubmitting(true);
    try {
      await onSubmit(planId, customDuration);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to assign plan.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Assign Plan — ${row?.school.name ?? ""}`}
      description={t("platformAssignSubscriptionDialog.startsTodayRenewingResetsTheAi")}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            {t("platformAssignSubscriptionDialog.cancel")}
          </Button>
          <Button type="submit" form="assign-subscription-form" disabled={submitting}>
            {submitting ? "Assigning…" : "Assign / Renew"}
          </Button>
        </>
      }
    >
      <form id="assign-subscription-form" onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div
            role="alert"
            className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-600 dark:text-rose-400"
          >
            {error}
          </div>
        )}
        <div>
          <Label>{t("platformAssignSubscriptionDialog.plan")}</Label>
          <Select value={planId} onChange={(e) => setPlanId(e.target.value)}>
            <option value="" disabled>
              {t("platformAssignSubscriptionDialog.selectAPlan")}
            </option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {p.maxStudents ?? "∞"} {t("platformAssignSubscriptionDialog.students")} {p.durationDays}{t("platformAssignSubscriptionDialog.d")}{" "}
                {p.aiGradingMonthlyQuota ?? "∞"} {t("platformAssignSubscriptionDialog.aiMo")}
              </option>
            ))}
          </Select>
          {plans.length === 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              {t("platformAssignSubscriptionDialog.noPlansYetCreateOneFirst")}
            </p>
          )}
        </div>

        {/*
          The plan itself always keeps its own durationDays — this only
          overrides how long *this school's* assignment runs, e.g. a school
          that negotiated 45 days instead of the plan's normal 30.
        */}
        <div className="rounded-lg border p-3">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={useCustom}
              onChange={(e) => setUseCustom(e.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            {t("platformAssignSubscriptionDialog.useACustomLength")}
          </label>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("platformAssignSubscriptionDialog.overridesJustThisAssignmentThe")}
          </p>
          {useCustom && (
            <div className="mt-3 flex items-center gap-2">
              <Input
                type="number"
                min={1}
                step={1}
                value={durationValue}
                onChange={(e) => setDurationValue(e.target.value)}
                className="w-24"
              />
              <Select
                value={durationUnit}
                onChange={(e) => setDurationUnit(e.target.value as "DAYS" | "MONTHS")}
              >
                <option value="DAYS">{t("platformAssignSubscriptionDialog.days")}</option>
                <option value="MONTHS">{t("platformAssignSubscriptionDialog.months")}</option>
              </Select>
            </div>
          )}
        </div>
      </form>
    </Dialog>
  );
}
