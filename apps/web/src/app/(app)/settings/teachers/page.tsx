"use client";


import { useT } from "@/lib/i18n/provider";
import { SettingsInput } from "@/components/settings/settings-field";
import { SettingsSaveBar } from "@/components/settings/settings-save-bar";
import { SettingsToggle } from "@/components/settings/settings-toggle";
import { useSettingsSection } from "@/components/settings/use-settings-section";

export default function TeacherSettingsPage() {
  const t = useT();
  const { draft, update, dirty, cancel, resetToDefault, save, saving } =
    useSettingsSection("teachers");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("settingsTeachers.teacherSettings")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("settingsTeachers.teacherIdsPortalAndShiftTimes")}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <SettingsInput label={t("settingsTeachers.teacherIdPrefix")} value={draft.idPrefix} onChange={(e) => update({ idPrefix: e.target.value.toUpperCase() })} />
        <SettingsInput label={t("settingsTeachers.defaultPassword")} value={draft.defaultPassword} onChange={(e) => update({ defaultPassword: e.target.value })} />
        <SettingsInput label={t("settingsTeachers.morningShiftStart")} type="time" value={draft.morningShiftStart} onChange={(e) => update({ morningShiftStart: e.target.value })} />
        <SettingsInput label={t("settingsTeachers.afternoonShiftStart")} type="time" value={draft.afternoonShiftStart} onChange={(e) => update({ afternoonShiftStart: e.target.value })} />
      </div>
      <SettingsToggle label={t("settingsTeachers.teacherPortalEnabled")} checked={draft.portalEnabled} onChange={(v) => update({ portalEnabled: v })} />
      <SettingsToggle
        label={t("settingsTeachers.grantViewStudentsByDefaultFor")}
        checked={draft.defaultViewStudents}
        onChange={(v) => update({ defaultViewStudents: v })}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <SettingsInput label={t("settingsTeachers.teacherProfileHeaderOptional")} value={draft.teacherHeader} onChange={(e) => update({ teacherHeader: e.target.value })} />
        <SettingsInput label={t("settingsTeachers.teacherProfileFooterOptional")} value={draft.teacherFooter} onChange={(e) => update({ teacherFooter: e.target.value })} />
      </div>
      <SettingsSaveBar dirty={dirty} saving={saving} onSave={save} onCancel={cancel} onResetDefault={resetToDefault} />
    </div>
  );
}
