"use client";


import { useT } from "@/lib/i18n/provider";
import { SettingsInput } from "@/components/settings/settings-field";
import { SettingsSaveBar } from "@/components/settings/settings-save-bar";
import { SettingsToggle } from "@/components/settings/settings-toggle";
import { useSettingsSection } from "@/components/settings/use-settings-section";

export default function SalarySettingsPage() {
  const t = useT();
  const { draft, update, dirty, cancel, resetToDefault, save, saving } = useSettingsSection("salary");
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">{t("settingsSalary.salarySettings")}</h1></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <SettingsInput label={t("settingsSalary.payrollDay")} type="number" value={draft.payrollDay} onChange={(e) => update({ payrollDay: Number(e.target.value) })} />
        <SettingsInput label={t("settingsSalary.salaryCurrency")} value={draft.currency} onChange={(e) => update({ currency: e.target.value })} />
        <SettingsInput label={t("settingsSalary.payslipHeaderOptional")} value={draft.payslipHeader} onChange={(e) => update({ payslipHeader: e.target.value })} />
        <SettingsInput label={t("settingsSalary.payslipFooter")} value={draft.payslipFooter} onChange={(e) => update({ payslipFooter: e.target.value })} />
      </div>
      <SettingsToggle label={t("settingsSalary.allowPartialSalary")} checked={draft.allowPartialSalary} onChange={(v) => update({ allowPartialSalary: v })} />
      <SettingsSaveBar dirty={dirty} saving={saving} onSave={save} onCancel={cancel} onResetDefault={resetToDefault} />
    </div>
  );
}
