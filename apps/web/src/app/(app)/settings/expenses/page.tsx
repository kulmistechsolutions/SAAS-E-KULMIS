"use client";


import { useT } from "@/lib/i18n/provider";
import { SettingsInput } from "@/components/settings/settings-field";
import { SettingsSaveBar } from "@/components/settings/settings-save-bar";
import { SettingsToggle } from "@/components/settings/settings-toggle";
import { useSettingsSection } from "@/components/settings/use-settings-section";

export default function ExpenseSettingsPage() {
  const t = useT();
  const { draft, update, dirty, cancel, resetToDefault, save, saving } = useSettingsSection("expenses");
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">{t("settingsExpenses.expenseSettings")}</h1></div>
      <SettingsInput label={t("settingsExpenses.defaultCategoriesCommaSeparated")} value={draft.defaultCategories.join(", ")} onChange={(e) => update({ defaultCategories: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />
      <SettingsInput label={t("settingsExpenses.attachmentSizeLimitMb")} type="number" value={draft.attachmentSizeLimitMb} onChange={(e) => update({ attachmentSizeLimitMb: Number(e.target.value) })} />
      <SettingsToggle label={t("settingsExpenses.expenseApprovalWorkflow")} checked={draft.approvalWorkflow} onChange={(v) => update({ approvalWorkflow: v })} />
      <div className="grid gap-4 sm:grid-cols-2">
        <SettingsInput label={t("settingsExpenses.expenseRecordHeaderOptional")} value={draft.expenseHeader} onChange={(e) => update({ expenseHeader: e.target.value })} />
        <SettingsInput label={t("settingsExpenses.expenseRecordFooterOptional")} value={draft.expenseFooter} onChange={(e) => update({ expenseFooter: e.target.value })} />
      </div>
      <SettingsSaveBar dirty={dirty} saving={saving} onSave={save} onCancel={cancel} onResetDefault={resetToDefault} />
    </div>
  );
}
