"use client";

import { SettingsInput, SettingsSelect } from "@/components/settings/settings-field";
import { SettingsSaveBar } from "@/components/settings/settings-save-bar";
import { SettingsToggle } from "@/components/settings/settings-toggle";
import { useSettingsSection } from "@/components/settings/use-settings-section";

export default function ParentSettingsPage() {
  const { draft, update, dirty, cancel, resetToDefault, save, saving } =
    useSettingsSection("parents");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Parent Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Parent IDs and portal configuration.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <SettingsInput label="Parent ID Prefix" value={draft.idPrefix} onChange={(e) => update({ idPrefix: e.target.value.toUpperCase() })} />
        <SettingsInput label="Default Password" value={draft.defaultPassword} onChange={(e) => update({ defaultPassword: e.target.value })} />
        <SettingsSelect label="Username Format" value={draft.usernameFormat} onChange={(e) => update({ usernameFormat: e.target.value as "FIRST_NAME" | "FIRST_NAME_CODE" })}>
          <option value="FIRST_NAME">First Name</option>
          <option value="FIRST_NAME_CODE">First Name + Code</option>
        </SettingsSelect>
      </div>
      <SettingsToggle label="Parent Portal Enabled" checked={draft.portalEnabled} onChange={(v) => update({ portalEnabled: v })} />
      <SettingsToggle label="Automatic Parent Account Creation" checked={draft.autoAccountCreation} onChange={(v) => update({ autoAccountCreation: v })} />
      <SettingsSaveBar dirty={dirty} saving={saving} onSave={save} onCancel={cancel} onResetDefault={resetToDefault} />
    </div>
  );
}
