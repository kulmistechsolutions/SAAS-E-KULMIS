"use client";

import { useStudentPortalAuth } from "@/lib/student-portal/use-student-portal-auth";
import { money } from "@/lib/students/format";

export default function StudentPortalOverviewPage() {
  const { me } = useStudentPortalAuth();
  if (!me) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Welcome, {me.fullName}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{me.code}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Class</p>
          <p className="mt-1 text-lg font-semibold">
            {me.class.name}
            {me.section ? ` · ${me.section.name}` : ""}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Monthly Fee</p>
          <p className="mt-1 text-lg font-semibold">
            {me.feeWaived ? "Waived" : money(me.monthlyFee)}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Gender</p>
          <p className="mt-1 text-lg font-semibold">{me.gender}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Parent / Guardian</p>
          <p className="mt-1 text-lg font-semibold">{me.parent.name}</p>
          <p className="text-xs text-muted-foreground">{me.parent.phone}</p>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
        Use the tabs above to view your exam results, attendance history, and fee
        status.
      </div>
    </div>
  );
}
