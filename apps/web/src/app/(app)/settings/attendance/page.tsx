"use client";

import { SettingsInput } from "@/components/settings/settings-field";
import { SettingsSaveBar } from "@/components/settings/settings-save-bar";
import { SettingsToggle } from "@/components/settings/settings-toggle";
import { useSettingsSection } from "@/components/settings/use-settings-section";

export default function AttendanceSettingsPage() {
  const { draft, update, dirty, cancel, resetToDefault, save, saving } = useSettingsSection("attendance");
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Attendance Settings</h1></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <SettingsInput label="Attendance Start Time" type="time" value={draft.startTime} onChange={(e) => update({ startTime: e.target.value })} />
        <SettingsInput label="Attendance End Time" type="time" value={draft.endTime} onChange={(e) => update({ endTime: e.target.value })} />
        <SettingsInput label="Late Time" type="time" value={draft.lateTime} onChange={(e) => update({ lateTime: e.target.value })} />
        <SettingsInput label="Attendance Lock Time" type="time" value={draft.lockTime} onChange={(e) => update({ lockTime: e.target.value })} />
      </div>
      <SettingsToggle label="Excused Attendance" checked={draft.excusedEnabled} onChange={(v) => update({ excusedEnabled: v })} />
      <SettingsSaveBar dirty={dirty} saving={saving} onSave={save} onCancel={cancel} onResetDefault={resetToDefault} />
    </div>
  );
}
