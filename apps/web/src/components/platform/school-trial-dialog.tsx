"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setPlatformSchoolTrial } from "@/lib/platform/api";
import { toast } from "@/lib/toast";

/** Whole days from now until `iso`; negative once it has passed. */
export function trialDaysLeft(iso: string | null): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.ceil(ms / 86_400_000);
}

/** Compact trial state for the schools table. */
export function TrialCell({ trialEndsAt }: { trialEndsAt: string | null }) {
  const left = trialDaysLeft(trialEndsAt);
  if (left == null) {
    return <span className="text-xs text-slate-500">—</span>;
  }
  if (left <= 0) {
    return (
      <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-xs font-medium text-rose-300">
        Expired
      </span>
    );
  }
  const tone =
    left <= 2
      ? "bg-amber-500/15 text-amber-300"
      : "bg-emerald-500/15 text-emerald-300";
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}>
      {left}d left
    </span>
  );
}

interface Props {
  school: { id: string; name: string; trialEndsAt: string | null };
  onClose: () => void;
  onSaved: () => void;
}

/**
 * Grant, extend or end a school's free trial. Days always count from now, so
 * this works the same whether the trial is running or already lapsed.
 */
export function SchoolTrialDialog({ school, onClose, onSaved }: Props) {
  const [days, setDays] = useState("7");
  const [saving, setSaving] = useState(false);
  const left = trialDaysLeft(school.trialEndsAt);

  async function save() {
    const n = Number(days);
    if (!Number.isInteger(n) || n < 0 || n > 365) {
      toast("Enter a whole number of days between 0 and 365", "error");
      return;
    }
    setSaving(true);
    try {
      await setPlatformSchoolTrial(school.id, n);
      toast(
        n === 0
          ? `Trial ended for ${school.name}`
          : `${school.name} now has ${n} trial day(s)`,
        "success",
      );
      onSaved();
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to update trial", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Free trial — ${school.name}`}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save trial"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {left == null
            ? "This school has no trial. Without one it cannot sign in until a plan is assigned."
            : left <= 0
              ? "The trial has ended — staff cannot sign in until you extend it or assign a plan."
              : `Trial ends in ${left} day(s).`}
        </p>
        <div>
          <Label>Trial length (days from today)</Label>
          <Input
            type="number"
            min={0}
            max={365}
            value={days}
            onChange={(e) => setDays(e.target.value)}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Counts from today, so it also works to extend a lapsed trial. 0 ends
            the trial immediately.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Only the trial deadline changes — no school data is touched.
        </p>
      </div>
    </Dialog>
  );
}
