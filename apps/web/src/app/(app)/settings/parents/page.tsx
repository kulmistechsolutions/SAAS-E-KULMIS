"use client";


import { useT } from "@/lib/i18n/provider";
import { SettingsInput, SettingsSelect } from "@/components/settings/settings-field";
import { SettingsSaveBar } from "@/components/settings/settings-save-bar";
import { SettingsToggle } from "@/components/settings/settings-toggle";
import { useSettingsSection } from "@/components/settings/use-settings-section";

export default function ParentSettingsPage() {
  const t = useT();
  const { draft, update, dirty, cancel, resetToDefault, save, saving } =
    useSettingsSection("parents");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("settingsParents.parentSettings")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("settingsParents.parentIdsAndPortalConfiguration")}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <SettingsInput label={t("settingsParents.parentIdPrefix")} value={draft.idPrefix} onChange={(e) => update({ idPrefix: e.target.value.toUpperCase() })} />
        <SettingsInput label={t("settingsParents.defaultPassword")} value={draft.defaultPassword} onChange={(e) => update({ defaultPassword: e.target.value })} />
        <SettingsSelect label={t("settingsParents.usernameFormat")} value={draft.usernameFormat} onChange={(e) => update({ usernameFormat: e.target.value as "FIRST_NAME" | "FIRST_NAME_CODE" })}>
          <option value="FIRST_NAME">{t("settingsParents.firstName")}</option>
          <option value="FIRST_NAME_CODE">{t("settingsParents.firstNameCode")}</option>
        </SettingsSelect>
      </div>
      <SettingsToggle label={t("settingsParents.parentPortalEnabled")} checked={draft.portalEnabled} onChange={(v) => update({ portalEnabled: v })} />
      <SettingsToggle label={t("settingsParents.automaticParentAccountCreation")} checked={draft.autoAccountCreation} onChange={(v) => update({ autoAccountCreation: v })} />
      <div className="grid gap-4 sm:grid-cols-2">
        <SettingsInput label={t("settingsParents.parentProfileHeaderOptional")} value={draft.parentHeader} onChange={(e) => update({ parentHeader: e.target.value })} />
        <SettingsInput label={t("settingsParents.parentProfileFooterOptional")} value={draft.parentFooter} onChange={(e) => update({ parentFooter: e.target.value })} />
      </div>
      <SettingsSaveBar dirty={dirty} saving={saving} onSave={save} onCancel={cancel} onResetDefault={resetToDefault} />
    </div>
  );
}
