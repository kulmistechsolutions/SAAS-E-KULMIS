"use client";


import { useT } from "@/lib/i18n/provider";
import { SettingsInput } from "@/components/settings/settings-field";
import { SettingsSaveBar } from "@/components/settings/settings-save-bar";
import { SettingsToggle } from "@/components/settings/settings-toggle";
import { useSettingsSection } from "@/components/settings/use-settings-section";

export default function StudentSettingsPage() {
  const t = useT();
  const { draft, update, dirty, cancel, resetToDefault, save, saving } =
    useSettingsSection("students");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("settingsStudents.studentSettings")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("settingsStudents.studentIdFormatAndPortalAccess")}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <SettingsInput label={t("settingsStudents.studentIdPrefix")} value={draft.idPrefix} onChange={(e) => update({ idPrefix: e.target.value.toUpperCase() })} />
        <SettingsInput label={t("settingsStudents.startingNumber")} type="number" value={draft.startingNumber} onChange={(e) => update({ startingNumber: Number(e.target.value) })} />
        <SettingsInput label={t("settingsStudents.idLengthPadding")} type="number" value={draft.idLength} onChange={(e) => update({ idLength: Number(e.target.value) })} />
        <div className="flex items-end text-sm text-muted-foreground">
          {t("settingsStudents.example")} {draft.idPrefix}{String(draft.startingNumber).padStart(draft.idLength, "0")}
        </div>
      </div>
      <SettingsToggle label={t("settingsStudents.allowStudentPortalLogin")} checked={draft.portalLoginEnabled} onChange={(v) => update({ portalLoginEnabled: v })} />
      <SettingsToggle label={t("settingsStudents.requireStudentPhone")} checked={draft.requirePhone} onChange={(v) => update({ requirePhone: v })} />
      <SettingsToggle label={t("settingsStudents.allowStudentPhotoUpload")} checked={draft.allowPhotoUpload} onChange={(v) => update({ allowPhotoUpload: v })} />
      <div className="grid gap-4 sm:grid-cols-2">
        <SettingsInput label={t("settingsStudents.studentProfileHeaderOptional")} value={draft.studentHeader} onChange={(e) => update({ studentHeader: e.target.value })} />
        <SettingsInput label={t("settingsStudents.studentProfileFooterOptional")} value={draft.studentFooter} onChange={(e) => update({ studentFooter: e.target.value })} />
      </div>
      <SettingsSaveBar dirty={dirty} saving={saving} onSave={save} onCancel={cancel} onResetDefault={resetToDefault} />
    </div>
  );
}
