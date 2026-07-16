"use client";

import { SettingsInput } from "@/components/settings/settings-field";
import { SettingsSaveBar } from "@/components/settings/settings-save-bar";
import { SettingsToggle } from "@/components/settings/settings-toggle";
import { useSettingsSection } from "@/components/settings/use-settings-section";

export default function StudentSettingsPage() {
  const { draft, update, dirty, cancel, resetToDefault, save, saving } =
    useSettingsSection("students");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Student Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Student ID format and portal access.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <SettingsInput label="Student ID Prefix" value={draft.idPrefix} onChange={(e) => update({ idPrefix: e.target.value.toUpperCase() })} />
        <SettingsInput label="Starting Number" type="number" value={draft.startingNumber} onChange={(e) => update({ startingNumber: Number(e.target.value) })} />
        <SettingsInput label="ID Length (padding)" type="number" value={draft.idLength} onChange={(e) => update({ idLength: Number(e.target.value) })} />
        <div className="flex items-end text-sm text-muted-foreground">
          Example: {draft.idPrefix}{String(draft.startingNumber).padStart(draft.idLength, "0")}
        </div>
      </div>
      <SettingsToggle label="Allow Student Portal Login" checked={draft.portalLoginEnabled} onChange={(v) => update({ portalLoginEnabled: v })} />
      <SettingsToggle label="Require Student Phone" checked={draft.requirePhone} onChange={(v) => update({ requirePhone: v })} />
      <SettingsToggle label="Allow Student Photo Upload" checked={draft.allowPhotoUpload} onChange={(v) => update({ allowPhotoUpload: v })} />
      <div className="grid gap-4 sm:grid-cols-2">
        <SettingsInput label="Student Profile Header (optional)" value={draft.studentHeader} onChange={(e) => update({ studentHeader: e.target.value })} />
        <SettingsInput label="Student Profile Footer (optional)" value={draft.studentFooter} onChange={(e) => update({ studentFooter: e.target.value })} />
      </div>
      <SettingsSaveBar dirty={dirty} saving={saving} onSave={save} onCancel={cancel} onResetDefault={resetToDefault} />
    </div>
  );
}
