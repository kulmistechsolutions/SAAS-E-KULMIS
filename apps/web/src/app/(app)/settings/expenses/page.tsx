"use client";

import { SettingsInput } from "@/components/settings/settings-field";
import { SettingsSaveBar } from "@/components/settings/settings-save-bar";
import { SettingsToggle } from "@/components/settings/settings-toggle";
import { useSettingsSection } from "@/components/settings/use-settings-section";

export default function ExpenseSettingsPage() {
  const { draft, update, dirty, cancel, resetToDefault, save, saving } = useSettingsSection("expenses");
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Expense Settings</h1></div>
      <SettingsInput label="Default Categories (comma-separated)" value={draft.defaultCategories.join(", ")} onChange={(e) => update({ defaultCategories: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />
      <SettingsInput label="Attachment Size Limit (MB)" type="number" value={draft.attachmentSizeLimitMb} onChange={(e) => update({ attachmentSizeLimitMb: Number(e.target.value) })} />
      <SettingsToggle label="Expense Approval Workflow" checked={draft.approvalWorkflow} onChange={(v) => update({ approvalWorkflow: v })} />
      <SettingsSaveBar dirty={dirty} saving={saving} onSave={save} onCancel={cancel} onResetDefault={resetToDefault} />
    </div>
  );
}
