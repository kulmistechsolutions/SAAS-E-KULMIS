"use client";

import { SettingsInput } from "@/components/settings/settings-field";
import { SettingsSaveBar } from "@/components/settings/settings-save-bar";
import { SettingsToggle } from "@/components/settings/settings-toggle";
import { useSettingsSection } from "@/components/settings/use-settings-section";

export default function SecuritySettingsPage() {
  const { draft, update, dirty, cancel, resetToDefault, save, saving } = useSettingsSection("security");
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Security Settings</h1></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <SettingsInput label="Password Minimum Length" type="number" value={draft.minPasswordLength} onChange={(e) => update({ minPasswordLength: Number(e.target.value) })} />
        <SettingsInput label="Session Timeout (minutes)" type="number" value={draft.sessionTimeoutMinutes} onChange={(e) => update({ sessionTimeoutMinutes: Number(e.target.value) })} />
        <SettingsInput label="Login Attempt Limit" type="number" value={draft.loginAttemptLimit} onChange={(e) => update({ loginAttemptLimit: Number(e.target.value) })} />
        <SettingsInput label="IP Restriction (optional)" value={draft.ipRestriction} onChange={(e) => update({ ipRestriction: e.target.value })} placeholder="e.g. 192.168.1.0/24" />
      </div>
      <SettingsToggle label="Password Complexity" checked={draft.requireComplexity} onChange={(v) => update({ requireComplexity: v })} />
      <SettingsToggle label="Require Uppercase" checked={draft.requireUppercase} onChange={(v) => update({ requireUppercase: v })} />
      <SettingsToggle label="Require Number" checked={draft.requireNumber} onChange={(v) => update({ requireNumber: v })} />
      <SettingsToggle label="Two-Factor Authentication (Future)" checked={draft.twoFactorEnabled} onChange={(v) => update({ twoFactorEnabled: v })} />
      <SettingsSaveBar dirty={dirty} saving={saving} onSave={save} onCancel={cancel} onResetDefault={resetToDefault} />
    </div>
  );
}
