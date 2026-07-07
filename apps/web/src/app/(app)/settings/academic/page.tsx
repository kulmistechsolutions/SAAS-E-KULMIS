"use client";

import { SettingsInput, SettingsSelect } from "@/components/settings/settings-field";
import { SettingsSaveBar } from "@/components/settings/settings-save-bar";
import { SettingsToggle } from "@/components/settings/settings-toggle";
import { useSettingsSection } from "@/components/settings/use-settings-section";
import { CLASSES } from "@/lib/students/constants";

export default function AcademicSettingsPage() {
  const { draft, update, dirty, cancel, resetToDefault, save, saving } =
    useSettingsSection("academic");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Academic Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Academic year, grading, and promotion rules.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <SettingsInput label="Active Academic Year" value={draft.activeAcademicYear} onChange={(e) => update({ activeAcademicYear: e.target.value })} />
        <SettingsInput label="School Level" value={draft.schoolLevel} onChange={(e) => update({ schoolLevel: e.target.value })} />
        <SettingsInput label="Passing Percentage" type="number" value={draft.passingPercentage} onChange={(e) => update({ passingPercentage: Number(e.target.value) })} />
        <SettingsInput label="Grade Scale" value={draft.gradeScale} onChange={(e) => update({ gradeScale: e.target.value })} />
        <SettingsSelect label="Default Attendance Status" value={draft.defaultAttendanceStatus} onChange={(e) => update({ defaultAttendanceStatus: e.target.value as "PRESENT" | "ABSENT" })}>
          <option value="PRESENT">Present</option>
          <option value="ABSENT">Absent</option>
        </SettingsSelect>
        <SettingsSelect label="Graduation Class" value={draft.graduationClass} onChange={(e) => update({ graduationClass: e.target.value })}>
          {CLASSES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </SettingsSelect>
      </div>

      <SettingsToggle label="Auto-promote eligible students" description="Automatically promote students who meet all requirements at year end." checked={draft.autoPromote} onChange={(v) => update({ autoPromote: v })} />

      <SettingsSaveBar dirty={dirty} saving={saving} onSave={save} onCancel={cancel} onResetDefault={resetToDefault} />
    </div>
  );
}
