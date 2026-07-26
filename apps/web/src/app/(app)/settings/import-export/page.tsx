"use client";


import { useT } from "@/lib/i18n/provider";
import { useRef } from "react";
import { exportSettingsJson, importSettingsJson, resetSettingsToDefault } from "@/lib/settings/store";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";

export default function ImportExportSettingsPage() {
  const t = useT();
  const fileRef = useRef<HTMLInputElement>(null);

  function download() {
    const json = exportSettingsJson();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ekulmis-settings-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast("Configuration exported.", "success");
  }

  function importFile(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = importSettingsJson(String(reader.result));
      toast(result.ok ? "Configuration imported." : result.error ?? "Import failed", result.ok ? "success" : "error");
    };
    reader.readAsText(file);
  }

  function resetAll() {
    if (!confirm("Reset ALL settings to factory defaults?")) return;
    resetSettingsToDefault();
    toast("Settings reset to defaults.", "success");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("settingsImportExport.importExport")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("settingsImportExport.backupAndRestoreSystemConfiguration")}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border bg-card p-5">
          <h2 className="font-semibold">{t("settingsImportExport.exportConfiguration")}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{t("settingsImportExport.downloadSchoolInfoBrandingAcademicFee")}</p>
          <Button className="mt-4" onClick={download}>{t("settingsImportExport.exportJson")}</Button>
        </div>
        <div className="rounded-xl border bg-card p-5">
          <h2 className="font-semibold">{t("settingsImportExport.importConfiguration")}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{t("settingsImportExport.uploadAPreviouslyExportedSettingsFile")}</p>
          <input ref={fileRef} type="file" accept="application/json,.json" className="mt-4 text-sm" onChange={(e) => importFile(e.target.files?.[0] ?? null)} />
        </div>
      </div>
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5">
        <h2 className="font-semibold text-destructive">{t("settingsImportExport.resetToDefault")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t("settingsImportExport.restoreAllSettingsToFactoryDefaults")}</p>
        <Button variant="destructive" className="mt-4" onClick={resetAll}>{t("settingsImportExport.resetAllSettings")}</Button>
      </div>
    </div>
  );
}
