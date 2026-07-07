"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { SettingsSummaryCards } from "@/components/settings/summary-cards";
import { getSettings, settingsDashboard, useSettingsState } from "@/lib/settings/store";
import { dateTime } from "@/lib/users/format";

export default function SettingsDashboardPage() {
  const [mounted, setMounted] = useState(false);
  const settings = useSettingsState();

  useEffect(() => setMounted(true), []);

  const summary = useMemo(() => (mounted ? settingsDashboard() : null), [mounted, settings]);
  const audit = useMemo(() => (mounted ? getSettings().audit.slice(0, 8) : []), [mounted, settings]);

  if (!mounted || !summary) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        Loading settings…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">System Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Central configuration hub for school identity, academics, finance, security, and more.
        </p>
      </div>

      <SettingsSummaryCards summary={summary} />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border bg-card p-5 lg:col-span-2">
          <h2 className="font-semibold">Quick Status</h2>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border p-3">
              <dt className="text-xs text-muted-foreground">Parent Portal</dt>
              <dd className="font-medium">{summary.parentPortalEnabled ? "Enabled" : "Disabled"}</dd>
            </div>
            <div className="rounded-lg border p-3">
              <dt className="text-xs text-muted-foreground">Student Portal</dt>
              <dd className="font-medium">{summary.studentPortalEnabled ? "Enabled" : "Disabled"}</dd>
            </div>
            <div className="rounded-lg border p-3">
              <dt className="text-xs text-muted-foreground">License</dt>
              <dd className="font-medium">{summary.licenseActive ? "Active" : "Inactive"}</dd>
            </div>
            <div className="rounded-lg border p-3">
              <dt className="text-xs text-muted-foreground">Last Backup</dt>
              <dd className="font-medium">
                {summary.lastBackupAt ? dateTime(summary.lastBackupAt) : "Never"}
              </dd>
            </div>
          </dl>
        </div>
        <div className="rounded-xl border bg-card p-5">
          <h2 className="font-semibold">Recent Audit</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {audit.map((a) => (
              <li key={a.id} className="border-b pb-2 last:border-0">
                <p className="font-medium">{a.action.replace(/_/g, " ")}</p>
                <p className="text-xs text-muted-foreground">{dateTime(a.at)}</p>
              </li>
            ))}
            {audit.length === 0 && (
              <li className="text-muted-foreground">No audit entries yet.</li>
            )}
          </ul>
          <Link href="/settings/system" className="mt-3 inline-block text-sm text-primary hover:underline">
            View system info →
          </Link>
        </div>
      </div>
    </div>
  );
}
