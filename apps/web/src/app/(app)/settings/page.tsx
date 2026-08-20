"use client";


import { useT } from "@/lib/i18n/provider";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { SettingsSummaryCards } from "@/components/settings/summary-cards";
import { getSettings, settingsDashboard, useSettingsState } from "@/lib/settings/store";
import { dateTime } from "@/lib/users/format";

export default function SettingsDashboardPage() {
  const t = useT();
  const [mounted, setMounted] = useState(false);
  const settings = useSettingsState();

  useEffect(() => setMounted(true), []);

  const summary = useMemo(() => (mounted ? settingsDashboard() : null), [mounted, settings]);
  const audit = useMemo(() => (mounted ? getSettings().audit.slice(0, 8) : []), [mounted, settings]);

  if (!mounted || !summary) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        {t("settings.loadingSettings")}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("settings.systemSettings")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("settings.centralConfigurationHubForSchoolIdentity")}
        </p>
      </div>

      <SettingsSummaryCards summary={summary} />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border bg-card p-5 lg:col-span-2">
          <h2 className="font-semibold">{t("settings.quickStatus")}</h2>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border p-3">
              <dt className="text-xs text-muted-foreground">{t("settings.parentPortal")}</dt>
              <dd className="font-medium">{summary.parentPortalEnabled ? "Enabled" : "Disabled"}</dd>
            </div>
            <div className="rounded-lg border p-3">
              <dt className="text-xs text-muted-foreground">{t("settings.studentPortal")}</dt>
              <dd className="font-medium">{summary.studentPortalEnabled ? "Enabled" : "Disabled"}</dd>
            </div>
          </dl>
        </div>
        <div className="rounded-xl border bg-card p-5">
          <h2 className="font-semibold">{t("settings.recentAudit")}</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {audit.map((a) => (
              <li key={a.id} className="border-b pb-2 last:border-0">
                <p className="font-medium">{a.action.replace(/_/g, " ")}</p>
                <p className="text-xs text-muted-foreground">{dateTime(a.at)}</p>
              </li>
            ))}
            {audit.length === 0 && (
              <li className="text-muted-foreground">{t("settings.noAuditEntriesYet")}</li>
            )}
          </ul>
          <Link href="/settings/system" className="mt-3 inline-block text-sm text-primary hover:underline">
            {t("settings.viewSystemInfo")}
          </Link>
        </div>
      </div>
    </div>
  );
}
