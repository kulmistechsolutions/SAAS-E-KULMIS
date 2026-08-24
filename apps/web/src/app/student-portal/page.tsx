"use client";

import { GraduationCap, Phone, User, Wallet } from "lucide-react";
import { useStudentPortal } from "@/components/student-portal/portal-context";
import { money } from "@/lib/students/format";
import { useT } from "@/lib/i18n/provider";

export default function StudentPortalOverviewPage() {
  const t = useT();
  const { me } = useStudentPortal();

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-card p-6 shadow-sm">
        <h1 className="text-2xl font-bold tracking-tight">
          {t("studentPortal.welcome")}, {me.fullName.split(" ")[0]}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          <span className="font-mono">{me.code}</span> · {me.class.name}
          {me.section ? ` · ${me.section.name}` : ""}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex items-start gap-3 rounded-2xl border bg-card p-4 shadow-sm">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <GraduationCap className="h-4 w-4" />
          </span>
          <div>
            <p className="text-xs text-muted-foreground">{t("studentPortal.class")}</p>
            <p className="mt-0.5 text-base font-semibold">
              {me.class.name}
              {me.section ? ` · ${me.section.name}` : ""}
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-2xl border bg-card p-4 shadow-sm">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <Wallet className="h-4 w-4" />
          </span>
          <div>
            <p className="text-xs text-muted-foreground">{t("studentPortal.monthlyFee")}</p>
            <p className="mt-0.5 text-base font-semibold">
              {me.feeWaived ? t("studentPortal.waived") : money(me.monthlyFee)}
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-2xl border bg-card p-4 shadow-sm">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400">
            <User className="h-4 w-4" />
          </span>
          <div>
            <p className="text-xs text-muted-foreground">{t("studentPortal.gender")}</p>
            <p className="mt-0.5 text-base font-semibold">{me.gender}</p>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-2xl border bg-card p-4 shadow-sm">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Phone className="h-4 w-4" />
          </span>
          <div>
            <p className="text-xs text-muted-foreground">{t("studentPortal.parentGuardian")}</p>
            <p className="mt-0.5 text-base font-semibold">{me.parent.name}</p>
            <p className="text-xs text-muted-foreground">{me.parent.phone}</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-4 text-sm text-muted-foreground shadow-sm">
        {t("studentPortal.useTheTabsAbove")}
      </div>
    </div>
  );
}
