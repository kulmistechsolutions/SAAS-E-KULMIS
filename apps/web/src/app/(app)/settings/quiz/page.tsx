"use client";

import { SettingsInput } from "@/components/settings/settings-field";
import { SettingsSaveBar } from "@/components/settings/settings-save-bar";
import { SettingsToggle } from "@/components/settings/settings-toggle";
import { useSettingsSection } from "@/components/settings/use-settings-section";

export default function QuizSettingsPage() {
  const { draft, update, dirty, cancel, resetToDefault, save, saving } = useSettingsSection("quiz");
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Online Quiz Settings</h1></div>
      <SettingsInput label="Maximum Attempts" type="number" value={draft.maxAttempts} onChange={(e) => update({ maxAttempts: Number(e.target.value) })} />
      <SettingsToggle label="Auto Submit" checked={draft.autoSubmit} onChange={(v) => update({ autoSubmit: v })} />
      <SettingsToggle label="Auto Save" checked={draft.autoSave} onChange={(v) => update({ autoSave: v })} />
      <SettingsToggle label="Show Results Immediately" checked={draft.showResultsImmediately} onChange={(v) => update({ showResultsImmediately: v })} />
      <SettingsToggle label="Question Randomization" checked={draft.questionRandomization} onChange={(v) => update({ questionRandomization: v })} />
      <SettingsSaveBar dirty={dirty} saving={saving} onSave={save} onCancel={cancel} onResetDefault={resetToDefault} />
    </div>
  );
}
