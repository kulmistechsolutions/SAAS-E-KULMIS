"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import {
  getSettings,
  updateSettings,
  usePromotionsState,
} from "@/lib/promotions/store";
import type { PromotionSettings } from "@/lib/promotions/types";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";

const RULES: { key: keyof PromotionSettings; label: string; desc: string }[] = [
  { key: "requirePublishedResults", label: "Require Published Final Results", desc: "Students must have published final results before promotion." },
  { key: "requireMinimumPass", label: "Require Minimum Pass Grade", desc: "Only students who passed (average ≥ 50) may be promoted." },
  { key: "requireNoOutstandingFees", label: "Require No Outstanding Fees", desc: "Students with unpaid balances cannot be promoted." },
  { key: "requireClearance", label: "Require Administrative Clearance", desc: "Blocked students (e.g. disciplinary holds) cannot be promoted." },
];

export default function PromotionSettingsPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  usePromotionsState();

  if (!mounted) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        Loading settings…
      </div>
    );
  }

  const settings = getSettings();

  function toggle(key: keyof PromotionSettings) {
    updateSettings({ [key]: !settings[key] });
    toast("Eligibility rules updated.", "success");
  }

  return (
    <div className="space-y-6">
      <Link href="/promotions" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
        <ArrowLeft className="h-4 w-4" /> Back to Promotions
      </Link>

      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <ShieldCheck className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-bold">Promotion Eligibility Rules</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Configure the requirements a student must meet to be promoted.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {RULES.map((rule) => {
          const on = settings[rule.key];
          return (
            <div key={rule.key} className="flex items-center justify-between gap-4 rounded-2xl border bg-card p-5 shadow-sm">
              <div>
                <p className="font-semibold">{rule.label}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{rule.desc}</p>
              </div>
              <button
                role="switch"
                aria-checked={on}
                onClick={() => toggle(rule.key)}
                className={cn(
                  "relative h-6 w-11 shrink-0 rounded-full transition-colors",
                  on ? "bg-primary" : "bg-secondary",
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
                    on ? "translate-x-[22px]" : "translate-x-0.5",
                  )}
                />
              </button>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        By default all rules are optional so any active student can be promoted. Enable rules to enforce stricter
        eligibility. Changes apply immediately to new promotions and are recorded in the audit log.
      </p>
    </div>
  );
}
