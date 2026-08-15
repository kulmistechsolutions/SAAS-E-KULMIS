"use client";

import { GraduationCap, Phone, User, Wallet } from "lucide-react";
import { useStudentPortal } from "@/components/student-portal/portal-context";
import { money } from "@/lib/students/format";

export default function StudentPortalOverviewPage() {
  const { me } = useStudentPortal();

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-card p-6 shadow-sm">
        <h1 className="text-2xl font-bold tracking-tight">Welcome, {me.fullName.split(" ")[0]}</h1>
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
            <p className="text-xs text-muted-foreground">Class</p>
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
            <p className="text-xs text-muted-foreground">Monthly Fee</p>
            <p className="mt-0.5 text-base font-semibold">
              {me.feeWaived ? "Waived" : money(me.monthlyFee)}
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-2xl border bg-card p-4 shadow-sm">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400">
            <User className="h-4 w-4" />
          </span>
          <div>
            <p className="text-xs text-muted-foreground">Gender</p>
            <p className="mt-0.5 text-base font-semibold">{me.gender}</p>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-2xl border bg-card p-4 shadow-sm">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Phone className="h-4 w-4" />
          </span>
          <div>
            <p className="text-xs text-muted-foreground">Parent / Guardian</p>
            <p className="mt-0.5 text-base font-semibold">{me.parent.name}</p>
            <p className="text-xs text-muted-foreground">{me.parent.phone}</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-4 text-sm text-muted-foreground shadow-sm">
        Use the tabs above to view your exam results, quizzes, attendance history,
        and fee status.
      </div>
    </div>
  );
}
