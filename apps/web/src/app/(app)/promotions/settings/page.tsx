"use client";


import { useT, type TranslationKey } from "@/lib/i18n/provider";
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

const RULES: { key: keyof PromotionSettings; label: TranslationKey; desc: string }[] = [
  { key: "requirePublishedResults", label: "promotionsSettings.requirePublishedFinalResults", desc: "Students must have published final results before promotion." },
  { key: "requireMinimumPass", label: "promotionsSettings.requireMinimumPassGrade", desc: "Only students who passed (average ≥ 50) may be promoted." },
  { key: "requireNoOutstandingFees", label: "promotionsSettings.requireNoOutstandingFees", desc: "Students with unpaid balances cannot be promoted." },
  { key: "requireClearance", label: "promotionsSettings.requireAdministrativeClearance", desc: "Blocked students (e.g. disciplinary holds) cannot be promoted." },
];

export default function PromotionSettingsPage() {
  const t = useT();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  usePromotionsState();

  if (!mounted) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        {t("promotionsSettings.loadingSettings")}
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
        <ArrowLeft className="h-4 w-4" /> {t("promotionsSettings.backToPromotions")}
      </Link>

      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <ShieldCheck className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-bold">{t("promotionsSettings.promotionEligibilityRules")}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {t("promotionsSettings.configureTheRequirementsAStudentMust")}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {RULES.map((rule) => {
          const on = settings[rule.key];
          return (
            <div key={rule.key} className="flex items-center justify-between gap-4 rounded-2xl border bg-card p-5 shadow-sm">
              <div>
                <p className="font-semibold">{t(rule.label)}</p>
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
        {t("promotionsSettings.byDefaultAllRulesAreOptional")}
      </p>
    </div>
  );
}
