"use client";

import { SettingsInput } from "@/components/settings/settings-field";
import { SettingsSaveBar } from "@/components/settings/settings-save-bar";
import { SettingsToggle } from "@/components/settings/settings-toggle";
import { useSettingsSection } from "@/components/settings/use-settings-section";

export default function TeacherSettingsPage() {
  const { draft, update, dirty, cancel, resetToDefault, save, saving } =
    useSettingsSection("teachers");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Teacher Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Teacher IDs, portal, and shift times.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <SettingsInput label="Teacher ID Prefix" value={draft.idPrefix} onChange={(e) => update({ idPrefix: e.target.value.toUpperCase() })} />
        <SettingsInput label="Default Password" value={draft.defaultPassword} onChange={(e) => update({ defaultPassword: e.target.value })} />
        <SettingsInput label="Morning Shift Start" type="time" value={draft.morningShiftStart} onChange={(e) => update({ morningShiftStart: e.target.value })} />
        <SettingsInput label="Afternoon Shift Start" type="time" value={draft.afternoonShiftStart} onChange={(e) => update({ afternoonShiftStart: e.target.value })} />
      </div>
      <SettingsToggle label="Teacher Portal Enabled" checked={draft.portalEnabled} onChange={(v) => update({ portalEnabled: v })} />
      <SettingsToggle
        label="Grant View Students by default for new teachers"
        checked={draft.defaultViewStudents}
        onChange={(v) => update({ defaultViewStudents: v })}
      />
      <SettingsSaveBar dirty={dirty} saving={saving} onSave={save} onCancel={cancel} onResetDefault={resetToDefault} />
    </div>
  );
}
