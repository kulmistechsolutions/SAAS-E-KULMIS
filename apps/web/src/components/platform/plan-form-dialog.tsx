"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PlatformSubscriptionPlan } from "@/lib/platform/api";

export interface PlanFormValues {
  name: string;
  maxStudents: number | null;
  maxTeachers: number | null;
  durationDays: number;
  aiGradingMonthlyQuota: number | null;
  priceUsd: number | null;
  isActive?: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  plan?: PlatformSubscriptionPlan | null;
  onSubmit: (values: PlanFormValues) => Promise<void>;
}

function toStr(n: number | string | null | undefined): string {
  return n == null ? "" : String(n);
}

export function PlanFormDialog({ open, onClose, plan, onSubmit }: Props) {
  const [name, setName] = useState("");
  const [maxStudents, setMaxStudents] = useState("");
  const [maxTeachers, setMaxTeachers] = useState("");
  const [durationDays, setDurationDays] = useState("30");
  const [aiQuota, setAiQuota] = useState("");
  const [priceUsd, setPriceUsd] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(plan?.name ?? "");
    setMaxStudents(toStr(plan?.maxStudents));
    setMaxTeachers(toStr(plan?.maxTeachers));
    setDurationDays(toStr(plan?.durationDays ?? 30) || "30");
    setAiQuota(toStr(plan?.aiGradingMonthlyQuota));
    setPriceUsd(toStr(plan?.priceUsd));
    setIsActive(plan?.isActive ?? true);
    setError(null);
  }, [open, plan]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError("Plan name is required.");
    const duration = Number(durationDays);
    if (!Number.isFinite(duration) || duration <= 0) {
      return setError("Duration (days) must be a positive number.");
    }
    setSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        maxStudents: maxStudents.trim() === "" ? null : Number(maxStudents),
        maxTeachers: maxTeachers.trim() === "" ? null : Number(maxTeachers),
        durationDays: duration,
        aiGradingMonthlyQuota: aiQuota.trim() === "" ? null : Number(aiQuota),
        priceUsd: priceUsd.trim() === "" ? null : Number(priceUsd),
        isActive,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save plan.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={plan ? "Edit Plan" : "New Subscription Plan"}
      description="Leave student count or AI grading quota blank for unlimited."
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="plan-form" disabled={submitting}>
            {submitting ? "Saving…" : plan ? "Save Changes" : "Create Plan"}
          </Button>
        </>
      }
    >
      <form id="plan-form" onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div
            role="alert"
            className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-600 dark:text-rose-400"
          >
            {error}
          </div>
        )}
        <div>
          <Label>Plan Name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Basic, Pro, Enterprise…"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Max Students</Label>
            <Input
              type="number"
              min={1}
              value={maxStudents}
              onChange={(e) => setMaxStudents(e.target.value)}
              placeholder="Unlimited"
            />
          </div>
          <div>
            <Label>Max Teachers</Label>
            <Input
              type="number"
              min={1}
              value={maxTeachers}
              onChange={(e) => setMaxTeachers(e.target.value)}
              placeholder="Unlimited"
            />
          </div>
          <div>
            <Label>Duration (days)</Label>
            <Input
              type="number"
              min={1}
              value={durationDays}
              onChange={(e) => setDurationDays(e.target.value)}
            />
          </div>
          <div>
            <Label>AI Grading / month</Label>
            <Input
              type="number"
              min={0}
              value={aiQuota}
              onChange={(e) => setAiQuota(e.target.value)}
              placeholder="Unlimited"
            />
          </div>
          <div>
            <Label>Price (USD, optional)</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={priceUsd}
              onChange={(e) => setPriceUsd(e.target.value)}
              placeholder="Informational only"
            />
          </div>
        </div>
        <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-input bg-background px-3 py-3 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-input"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          <span>
            <span className="font-medium text-foreground">Plan is active</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Inactive plans cannot be assigned to schools.
            </span>
          </span>
        </label>
      </form>
    </Dialog>
  );
}
