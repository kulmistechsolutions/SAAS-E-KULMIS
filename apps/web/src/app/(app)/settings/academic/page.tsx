"use client";


import { useT } from "@/lib/i18n/provider";
import Link from "next/link";
import { SettingsInput, SettingsSelect } from "@/components/settings/settings-field";
import { SettingsSaveBar } from "@/components/settings/settings-save-bar";
import { SettingsToggle } from "@/components/settings/settings-toggle";
import { useSettingsSection } from "@/components/settings/use-settings-section";
import { AcademicYearSelect } from "@/components/academics/academic-year-select";
import {
  activeAcademicYear,
  classNamesForYear,
  setActiveAcademicYear,
  useAcademicsState,
} from "@/lib/academics/store";
import { toast } from "@/lib/toast";

export default function AcademicSettingsPage() {
  const t = useT();
  const { draft, update, dirty, cancel, resetToDefault, save, saving } =
    useSettingsSection("academic");
  const academics = useAcademicsState();
  const classes = classNamesForYear(activeAcademicYear());

  async function handleSave() {
    const selected = draft.activeAcademicYear;
    const yearId = academics.academicYears.find((y) => y.name === selected)?.id;
    if (yearId && selected !== activeAcademicYear()) {
      const res = await setActiveAcademicYear(yearId);
      if (!res.ok) {
        toast(res.error ?? "Failed to set active year", "error");
        return;
      }
    }
    await save();
    toast("Academic settings saved", "success");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("settingsAcademic.academicSettings")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("settingsAcademic.academicYearGradingAndPromotionRules")}{" "}
          <Link href="/academics/years" className="text-primary underline">
            {t("settingsAcademic.manageYearsInAcademics")}
          </Link>
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium">{t("settingsAcademic.activeAcademicYear")}</label>
          <AcademicYearSelect
            value={draft.activeAcademicYear || activeAcademicYear()}
            onChange={(y) => update({ activeAcademicYear: y })}
          />
        </div>
        <SettingsInput label={t("settingsAcademic.schoolLevel")} value={draft.schoolLevel} onChange={(e) => update({ schoolLevel: e.target.value })} />
        <SettingsInput label={t("settingsAcademic.passingPercentage")} type="number" value={draft.passingPercentage} onChange={(e) => update({ passingPercentage: Number(e.target.value) })} />
        <SettingsInput label={t("settingsAcademic.gradeScale")} value={draft.gradeScale} onChange={(e) => update({ gradeScale: e.target.value })} />
        <SettingsSelect label={t("settingsAcademic.defaultAttendanceStatus")} value={draft.defaultAttendanceStatus} onChange={(e) => update({ defaultAttendanceStatus: e.target.value as "PRESENT" | "ABSENT" })}>
          <option value="PRESENT">{t("settingsAcademic.present")}</option>
          <option value="ABSENT">{t("settingsAcademic.absent")}</option>
        </SettingsSelect>
        <SettingsSelect label={t("settingsAcademic.graduationClass")} value={draft.graduationClass} onChange={(e) => update({ graduationClass: e.target.value })}>
          {classes.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </SettingsSelect>
      </div>

      <SettingsToggle label={t("settingsAcademic.autoPromoteEligibleStudents")} description={t("settingsAcademic.automaticallyPromoteStudentsWhoMeetAll")} checked={draft.autoPromote} onChange={(v) => update({ autoPromote: v })} />

      <SettingsSaveBar dirty={dirty} saving={saving} onSave={handleSave} onCancel={cancel} onResetDefault={resetToDefault} />
    </div>
  );
}
