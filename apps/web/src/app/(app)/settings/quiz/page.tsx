"use client";


import { useT } from "@/lib/i18n/provider";
import { SettingsInput } from "@/components/settings/settings-field";
import { SettingsSaveBar } from "@/components/settings/settings-save-bar";
import { SettingsToggle } from "@/components/settings/settings-toggle";
import { useSettingsSection } from "@/components/settings/use-settings-section";

export default function QuizSettingsPage() {
  const t = useT();
  const { draft, update, dirty, cancel, resetToDefault, save, saving } = useSettingsSection("quiz");
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">{t("settingsQuiz.onlineQuizSettings")}</h1></div>
      <SettingsInput label={t("settingsQuiz.maximumAttempts")} type="number" value={draft.maxAttempts} onChange={(e) => update({ maxAttempts: Number(e.target.value) })} />
      <SettingsToggle label={t("settingsQuiz.autoSubmit")} checked={draft.autoSubmit} onChange={(v) => update({ autoSubmit: v })} />
      <SettingsToggle label={t("settingsQuiz.autoSave")} checked={draft.autoSave} onChange={(v) => update({ autoSave: v })} />
      <SettingsToggle label={t("settingsQuiz.showResultsImmediately")} checked={draft.showResultsImmediately} onChange={(v) => update({ showResultsImmediately: v })} />
      <SettingsToggle label={t("settingsQuiz.questionRandomization")} checked={draft.questionRandomization} onChange={(v) => update({ questionRandomization: v })} />
      <SettingsSaveBar dirty={dirty} saving={saving} onSave={save} onCancel={cancel} onResetDefault={resetToDefault} />
    </div>
  );
}
