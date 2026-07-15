"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type {
  PlatformSchoolSubscriptionRow,
  PlatformSubscriptionPlan,
} from "@/lib/platform/api";

interface Props {
  open: boolean;
  onClose: () => void;
  row: PlatformSchoolSubscriptionRow | null;
  plans: PlatformSubscriptionPlan[];
  onSubmit: (planId: string) => Promise<void>;
}

export function AssignSubscriptionDialog({
  open,
  onClose,
  row,
  plans,
  onSubmit,
}: Props) {
  const [planId, setPlanId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setPlanId(row?.subscription?.plan.id ?? plans[0]?.id ?? "");
    setError(null);
  }, [open, row, plans]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!planId) return setError("Choose a plan.");
    setSubmitting(true);
    try {
      await onSubmit(planId);
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
      description="Starts today; renewing resets the AI grading counter and extends the end date by the plan's duration."
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
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
          <Label>Plan</Label>
          <Select value={planId} onChange={(e) => setPlanId(e.target.value)}>
            <option value="" disabled>
              Select a plan
            </option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {p.maxStudents ?? "∞"} students, {p.durationDays}d,{" "}
                {p.aiGradingMonthlyQuota ?? "∞"} AI/mo
              </option>
            ))}
          </Select>
          {plans.length === 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              No plans yet — create one first.
            </p>
          )}
        </div>
      </form>
    </Dialog>
  );
}
