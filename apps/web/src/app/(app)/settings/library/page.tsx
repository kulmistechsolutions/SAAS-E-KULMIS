"use client";

import { useT } from "@/lib/i18n/provider";
import { SettingsSaveBar } from "@/components/settings/settings-save-bar";
import { SettingsToggle } from "@/components/settings/settings-toggle";
import { useSettingsSection } from "@/components/settings/use-settings-section";

/**
 * How this school's books read.
 *
 * The watermark was hard-coded on: every page a student opened carried their
 * name, id and the date tiled across it. It exists so a leaked page can be
 * traced back, which is a real reason — but it is the school's call, not the
 * platform's, and a student reads through that stamp for an hour at a time.
 *
 * On stays the default. A school has to decide to take it off, and the page
 * says plainly what it is giving up when it does.
 */
export default function LibrarySettingsPage() {
  const t = useT();
  const { draft, update, dirty, cancel, resetToDefault, save, saving } =
    useSettingsSection("library");

  const on = draft.studentWatermark !== false;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("settingsLibrary.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("settingsLibrary.description")}
        </p>
      </div>

      <SettingsToggle
        label={t("settingsLibrary.studentWatermark")}
        checked={on}
        onChange={(v) => update({ studentWatermark: v })}
      />
      <p className="-mt-3 text-xs text-muted-foreground">
        {on
          ? t("settingsLibrary.watermarkOnHelp")
          : t("settingsLibrary.watermarkOffHelp")}
      </p>

      {on && (
        <div className="max-w-md rounded-xl border bg-card p-4">
          <label className="mb-2 block text-sm font-medium">
            {t("settingsLibrary.opacity")}
          </label>
          <input
            type="range"
            min={4}
            max={30}
            step={1}
            value={Math.round((draft.watermarkOpacity ?? 0.1) * 100)}
            onChange={(e) =>
              update({ watermarkOpacity: Number(e.target.value) / 100 })
            }
            className="w-full accent-primary"
          />
          <div className="mt-1 flex justify-between text-xs text-muted-foreground">
            <span>{t("settingsLibrary.opacityFaint")}</span>
            <span className="font-medium tabular-nums">
              {Math.round((draft.watermarkOpacity ?? 0.1) * 100)}%
            </span>
            <span>{t("settingsLibrary.opacityStrong")}</span>
          </div>

          {/* What it will look like, rather than a number to guess at. */}
          <div className="relative mt-4 overflow-hidden rounded-lg border bg-white p-4 text-slate-800">
            <p className="text-xs leading-relaxed">
              {t("settingsLibrary.previewBody")}
            </p>
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 flex items-center justify-center -rotate-[30deg] whitespace-nowrap text-sm font-medium text-black"
              style={{ opacity: draft.watermarkOpacity ?? 0.1 }}
            >
              {t("settingsLibrary.previewStamp")}
            </span>
          </div>
        </div>
      )}

      <SettingsSaveBar
        dirty={dirty}
        saving={saving}
        onSave={save}
        onCancel={cancel}
        onResetDefault={resetToDefault}
      />
    </div>
  );
}
