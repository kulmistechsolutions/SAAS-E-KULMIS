"use client";

import { useState } from "react";
import { SettingsInput } from "@/components/settings/settings-field";
import { SettingsSaveBar } from "@/components/settings/settings-save-bar";
import { SettingsToggle } from "@/components/settings/settings-toggle";
import { useSettingsSection } from "@/components/settings/use-settings-section";
import { createManualBackup, getSettings, restoreBackup, useSettingsState } from "@/lib/settings/store";
import { Button } from "@/components/ui/button";
import { dateTime } from "@/lib/users/format";
import { toast } from "@/lib/toast";

export default function BackupSettingsPage() {
  const { draft, update, dirty, cancel, resetToDefault, save, saving } = useSettingsSection("backup");
  useSettingsState();
  const [restoring, setRestoring] = useState(false);

  function manualBackup() {
    const r = createManualBackup();
    if (r.ok) toast("Backup created successfully.", "success");
  }

  function handleRestore(id: string) {
    if (!confirm("Restore this backup? Current settings will be overwritten.")) return;
    setRestoring(true);
    const r = restoreBackup(id);
    setRestoring(false);
    toast(r.ok ? "Backup restored." : r.error ?? "Restore failed", r.ok ? "success" : "error");
  }

  const backups = getSettings().backups;

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Backup Settings</h1></div>
      <SettingsToggle label="Automatic Daily Backup" checked={draft.dailyAuto} onChange={(v) => update({ dailyAuto: v })} />
      <SettingsToggle label="Weekly Backup" checked={draft.weeklyAuto} onChange={(v) => update({ weeklyAuto: v })} />
      <SettingsToggle label="Monthly Backup" checked={draft.monthlyAuto} onChange={(v) => update({ monthlyAuto: v })} />
      <div className="grid gap-4 sm:grid-cols-2">
        <SettingsInput label="Retention (days)" type="number" value={draft.retentionDays} onChange={(e) => update({ retentionDays: Number(e.target.value) })} />
        <SettingsInput label="Backup Location" value={draft.location} onChange={(e) => update({ location: e.target.value })} />
      </div>
      <Button onClick={manualBackup}>Create Manual Backup</Button>
      <div className="rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead><tr className="border-b bg-secondary/50 text-left"><th className="px-4 py-3">Label</th><th className="px-4 py-3">Created</th><th className="px-4 py-3">Action</th></tr></thead>
          <tbody>
            {backups.map((b) => (
              <tr key={b.id} className="border-b">
                <td className="px-4 py-3">{b.label}</td>
                <td className="px-4 py-3">{dateTime(b.createdAt)}</td>
                <td className="px-4 py-3"><Button variant="outline" className="h-8" disabled={restoring} onClick={() => handleRestore(b.id)}>Restore</Button></td>
              </tr>
            ))}
            {backups.length === 0 && <tr><td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">No backups yet.</td></tr>}
          </tbody>
        </table>
      </div>
      <SettingsSaveBar dirty={dirty} saving={saving} onSave={save} onCancel={cancel} onResetDefault={resetToDefault} />
    </div>
  );
}
