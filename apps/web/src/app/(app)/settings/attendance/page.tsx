"use client";


import { useT } from "@/lib/i18n/provider";
import { SettingsInput, SettingsSelect } from "@/components/settings/settings-field";
import { SettingsSaveBar } from "@/components/settings/settings-save-bar";
import { SettingsToggle } from "@/components/settings/settings-toggle";
import { useSettingsSection } from "@/components/settings/use-settings-section";

export default function AttendanceSettingsPage() {
  const t = useT();
  const { draft, update, dirty, cancel, resetToDefault, save, saving } = useSettingsSection("attendance");
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">{t("settingsAttendance.attendanceSettings")}</h1></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <SettingsInput label={t("settingsAttendance.attendanceStartTime")} type="time" value={draft.startTime} onChange={(e) => update({ startTime: e.target.value })} />
        <SettingsInput label={t("settingsAttendance.attendanceEndTime")} type="time" value={draft.endTime} onChange={(e) => update({ endTime: e.target.value })} />
        <SettingsInput label={t("settingsAttendance.lateTime")} type="time" value={draft.lateTime} onChange={(e) => update({ lateTime: e.target.value })} />
        <SettingsInput label={t("settingsAttendance.attendanceLockTime")} type="time" value={draft.lockTime} onChange={(e) => update({ lockTime: e.target.value })} />
      </div>
      <SettingsToggle label={t("settingsAttendance.excusedAttendance")} checked={draft.excusedEnabled} onChange={(v) => update({ excusedEnabled: v })} />

      {/* Two officers can be assigned one register deliberately, so overwriting
          stays allowed by default — this is for schools that would rather the
          first save stand. Administrators are never restricted by it. */}
      <div className="max-w-md">
        <SettingsSelect
          label={t("settingsAttendance.officerEdits")}
          value={draft.officerEdits ?? "ALWAYS"}
          onChange={(e) =>
            update({
              officerEdits: e.target.value as "ALWAYS" | "OWN" | "NEVER",
            })
          }
        >
          <option value="ALWAYS">{t("settingsAttendance.officerEditsAlways")}</option>
          <option value="OWN">{t("settingsAttendance.officerEditsOwn")}</option>
          <option value="NEVER">{t("settingsAttendance.officerEditsNever")}</option>
        </SettingsSelect>
        <p className="mt-1.5 text-xs text-muted-foreground">
          {t("settingsAttendance.officerEditsHelp")}
        </p>
      </div>

      <SettingsSaveBar dirty={dirty} saving={saving} onSave={save} onCancel={cancel} onResetDefault={resetToDefault} />
    </div>
  );
}
