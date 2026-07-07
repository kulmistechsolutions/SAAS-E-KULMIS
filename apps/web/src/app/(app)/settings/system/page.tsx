"use client";

import { useEffect } from "react";
import { getSettings, refreshServerTime, systemStorageUsageMb, useSettingsState } from "@/lib/settings/store";
import { dateTime } from "@/lib/users/format";
import { Button } from "@/components/ui/button";

export default function SystemInfoPage() {
  const settings = useSettingsState();

  useEffect(() => {
    refreshServerTime();
  }, []);

  const s = getSettings();
  const storage = systemStorageUsageMb();

  const rows = [
    ["System Name", s.system.systemName],
    ["Version", s.system.version],
    ["Build Number", s.system.buildNumber],
    ["Installation Date", dateTime(s.system.installationDate)],
    ["Database Type", s.system.databaseType],
    ["Server Time", dateTime(s.system.serverTime)],
    ["Storage Usage", `${storage} MB (localStorage demo)`],
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">System Information</h1>
          <p className="mt-1 text-sm text-muted-foreground">Read-only system metadata.</p>
        </div>
        <Button variant="outline" className="h-9" onClick={() => refreshServerTime()}>Refresh</Button>
      </div>
      <dl className="grid gap-3 sm:grid-cols-2">
        {rows.map(([k, v]) => (
          <div key={k} className="rounded-xl border bg-card p-4">
            <dt className="text-xs text-muted-foreground">{k}</dt>
            <dd className="mt-1 font-medium">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="rounded-xl border bg-card p-5">
        <h2 className="font-semibold">Settings Audit Log</h2>
        <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto text-sm">
          {s.audit.slice(0, 20).map((a) => (
            <li key={a.id} className="flex justify-between border-b pb-2">
              <span>{a.action.replace(/_/g, " ")} · {a.user}</span>
              <span className="text-muted-foreground">{dateTime(a.at)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
