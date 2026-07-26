"use client";


import { useT } from "@/lib/i18n/provider";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { SettingsInput } from "@/components/settings/settings-field";
import { SettingsSaveBar } from "@/components/settings/settings-save-bar";
import { SettingsToggle } from "@/components/settings/settings-toggle";
import { useSettingsSection } from "@/components/settings/use-settings-section";
import { useIsSchoolSuperAdmin } from "@/lib/users/super-admin";
import { shortDate } from "@/lib/students/format";

export default function LicenseSettingsPage() {
  const t = useT();
  const router = useRouter();
  const isSuper = useIsSchoolSuperAdmin();
  const { draft, update, dirty, cancel, resetToDefault, save, saving } = useSettingsSection("license");

  useEffect(() => {
    if (!isSuper) router.replace("/settings");
  }, [isSuper, router]);

  if (!isSuper) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("settingsLicense.license")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("settingsLicense.optionalLicenseInformationSuperAdministrator")}</p>
      </div>
      <SettingsInput label={t("settingsLicense.licenseKey")} value={draft.licenseKey} onChange={(e) => update({ licenseKey: e.target.value })} />
      <SettingsInput label={t("settingsLicense.expirationDate")} type="date" value={draft.expiresAt.slice(0, 10)} onChange={(e) => update({ expiresAt: new Date(e.target.value).toISOString() })} />
      <SettingsToggle label={t("settingsLicense.activationStatus")} checked={draft.active} onChange={(v) => update({ active: v })} />
      <div className="rounded-lg border bg-secondary/30 p-4 text-sm">
        <p>{t("settingsLicense.status")} <strong>{draft.active ? "Active" : "Inactive"}</strong></p>
        <p className="mt-1 text-muted-foreground">{t("settingsLicense.expires")} {shortDate(draft.expiresAt)}</p>
      </div>
      <SettingsSaveBar dirty={dirty} saving={saving} onSave={save} onCancel={cancel} onResetDefault={resetToDefault} />
    </div>
  );
}
