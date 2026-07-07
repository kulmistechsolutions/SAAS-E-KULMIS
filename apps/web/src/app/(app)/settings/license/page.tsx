"use client";

import { SettingsInput } from "@/components/settings/settings-field";
import { SettingsSaveBar } from "@/components/settings/settings-save-bar";
import { SettingsToggle } from "@/components/settings/settings-toggle";
import { useSettingsSection } from "@/components/settings/use-settings-section";
import { shortDate } from "@/lib/students/format";

export default function LicenseSettingsPage() {
  const { draft, update, dirty, cancel, resetToDefault, save, saving } = useSettingsSection("license");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">License</h1>
        <p className="mt-1 text-sm text-muted-foreground">Optional license information (Super Administrator).</p>
      </div>
      <SettingsInput label="License Key" value={draft.licenseKey} onChange={(e) => update({ licenseKey: e.target.value })} />
      <SettingsInput label="Expiration Date" type="date" value={draft.expiresAt.slice(0, 10)} onChange={(e) => update({ expiresAt: new Date(e.target.value).toISOString() })} />
      <SettingsToggle label="Activation Status" checked={draft.active} onChange={(v) => update({ active: v })} />
      <div className="rounded-lg border bg-secondary/30 p-4 text-sm">
        <p>Status: <strong>{draft.active ? "Active" : "Inactive"}</strong></p>
        <p className="mt-1 text-muted-foreground">Expires: {shortDate(draft.expiresAt)}</p>
      </div>
      <SettingsSaveBar dirty={dirty} saving={saving} onSave={save} onCancel={cancel} onResetDefault={resetToDefault} />
    </div>
  );
}
