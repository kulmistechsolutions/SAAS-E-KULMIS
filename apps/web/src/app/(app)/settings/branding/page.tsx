"use client";


import { useT } from "@/lib/i18n/provider";
import { SettingsInput } from "@/components/settings/settings-field";
import { SettingsSaveBar } from "@/components/settings/settings-save-bar";
import { useSettingsSection } from "@/components/settings/use-settings-section";
import { readImageAsDataUrl } from "@/lib/settings/format";
import { toast } from "@/lib/toast";

export default function BrandingSettingsPage() {
  const t = useT();
  const { draft, update, dirty, cancel, resetToDefault, save, saving } =
    useSettingsSection("branding");

  async function onImage(
    key: "faviconDataUrl" | "loginBackgroundDataUrl",
    file: File | null,
  ) {
    if (!file) return;
    try {
      const dataUrl = await readImageAsDataUrl(file);
      update({ [key]: dataUrl });
    } catch (e) {
      toast(e instanceof Error ? e.message : "Upload failed", "error");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("settingsBranding.branding")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("settingsBranding.colorsAndLoginAppearanceUpdateAcross")}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {(
          [
            ["primaryColor", "Primary Color"],
            ["secondaryColor", "Secondary Color"],
            ["accentColor", "Accent Color"],
          ] as const
        ).map(([key, label]) => (
          <div key={key} className="rounded-xl border bg-card p-4">
            <label className="text-sm font-medium">{label}</label>
            <div className="mt-2 flex items-center gap-3">
              <input
                type="color"
                value={draft[key]}
                onChange={(e) => update({ [key]: e.target.value })}
                className="h-10 w-14 cursor-pointer rounded border"
              />
              <input
                value={draft[key]}
                onChange={(e) => update({ [key]: e.target.value })}
                className="flex-1 rounded-md border px-2 py-1.5 text-sm"
              />
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <SettingsInput label={t("settingsBranding.loginPageTitle")} value={draft.loginTitle} onChange={(e) => update({ loginTitle: e.target.value })} />
        <SettingsInput label={t("settingsBranding.footerText")} value={draft.footerText} onChange={(e) => update({ footerText: e.target.value })} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm font-medium">{t("settingsBranding.favicon")}</p>
          <input type="file" accept="image/*" className="mt-2 text-sm" onChange={(e) => onImage("faviconDataUrl", e.target.files?.[0] ?? null)} />
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm font-medium">{t("settingsBranding.loginBackground")}</p>
          <input type="file" accept="image/*" className="mt-2 text-sm" onChange={(e) => onImage("loginBackgroundDataUrl", e.target.files?.[0] ?? null)} />
        </div>
      </div>

      <div
        className="rounded-xl border p-6"
        style={{
          background: draft.loginBackgroundDataUrl
            ? `url(${draft.loginBackgroundDataUrl}) center/cover`
            : `linear-gradient(135deg, ${draft.primaryColor}22, ${draft.secondaryColor}22)`,
        }}
      >
        <p className="text-lg font-bold" style={{ color: draft.primaryColor }}>
          {draft.loginTitle} {t("settingsBranding.preview")}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">{draft.footerText}</p>
      </div>

      <SettingsSaveBar dirty={dirty} saving={saving} onSave={save} onCancel={cancel} onResetDefault={resetToDefault} />
    </div>
  );
}
