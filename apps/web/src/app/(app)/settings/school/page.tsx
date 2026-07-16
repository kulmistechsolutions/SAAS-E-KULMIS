"use client";

import { useState } from "react";
import { SettingsInput, SettingsSelect, SettingsTextarea } from "@/components/settings/settings-field";
import { SettingsSaveBar } from "@/components/settings/settings-save-bar";
import { useSettingsSection } from "@/components/settings/use-settings-section";
import { readImageAsDataUrl } from "@/lib/settings/format";
import { removeSchoolLogo, uploadSchoolLogo } from "@/lib/settings/store";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";

export default function SchoolSettingsPage() {
  const { draft, update, dirty, cancel, resetToDefault, save, saving } =
    useSettingsSection("school");
  const [logoBusy, setLogoBusy] = useState(false);

  async function onLogoChange(file: File | null) {
    if (!file) return;
    setLogoBusy(true);
    try {
      const dataUrl = await readImageAsDataUrl(file);
      const comma = dataUrl.indexOf(",");
      const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
      const res = await uploadSchoolLogo(base64, file.type);
      if (!res.ok) {
        toast(res.error ?? "Upload failed", "error");
        return;
      }
      update({ logoDataUrl: res.logoUrl ?? null });
      toast("School logo updated.", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Upload failed", "error");
    } finally {
      setLogoBusy(false);
    }
  }

  async function onRemoveLogo() {
    setLogoBusy(true);
    try {
      const res = await removeSchoolLogo();
      if (!res.ok) {
        toast(res.error ?? "Failed to remove logo", "error");
        return;
      }
      update({ logoDataUrl: null });
      toast("School logo removed.", "success");
    } finally {
      setLogoBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">School Information</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          School identity shown on dashboards, login, reports, and portals.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl border bg-card p-5 lg:col-span-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <SettingsInput label="School Name" value={draft.name} onChange={(e) => update({ name: e.target.value })} />
            <SettingsInput label="School Motto" value={draft.motto} onChange={(e) => update({ motto: e.target.value })} />
            <SettingsInput label="Principal Name" value={draft.principalName} onChange={(e) => update({ principalName: e.target.value })} />
            <SettingsInput label="Phone" value={draft.phone} onChange={(e) => update({ phone: e.target.value })} />
            <SettingsInput label="Email" type="email" value={draft.email} onChange={(e) => update({ email: e.target.value })} />
            <SettingsInput label="Website" value={draft.website} onChange={(e) => update({ website: e.target.value })} />
            <SettingsInput label="Address" className="sm:col-span-2" value={draft.address} onChange={(e) => update({ address: e.target.value })} />
            <SettingsInput label="City" value={draft.city} onChange={(e) => update({ city: e.target.value })} />
            <SettingsInput label="Country" value={draft.country} onChange={(e) => update({ country: e.target.value })} />
            <SettingsInput label="Academic Year" value={draft.academicYear} onChange={(e) => update({ academicYear: e.target.value })} />
            <SettingsSelect label="Currency" value={draft.currency} onChange={(e) => update({ currency: e.target.value })}>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="SOS">SOS</option>
            </SettingsSelect>
            <SettingsInput label="Time Zone" value={draft.timezone} onChange={(e) => update({ timezone: e.target.value })} />
            <SettingsSelect label="Language" value={draft.language} onChange={(e) => update({ language: e.target.value })}>
              <option value="en">English</option>
              <option value="ar">Arabic</option>
              <option value="so">Somali</option>
            </SettingsSelect>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-5">
          <p className="text-sm font-medium">School Logo</p>
          <p className="mt-1 text-xs text-muted-foreground">Circle logo · PNG, JPG, WebP, SVG · max 2 MB</p>
          <div className="mt-4 flex flex-col items-center gap-4">
            <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-2 border-dashed bg-secondary/50">
              {draft.logoDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={draft.logoDataUrl} alt="School logo" className="h-full w-full object-contain p-1" />
              ) : (
                <span className="text-2xl font-bold text-primary">{draft.name.slice(0, 2).toUpperCase()}</span>
              )}
            </div>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              disabled={logoBusy}
              onChange={(e) => void onLogoChange(e.target.files?.[0] ?? null)}
            />
            {draft.logoDataUrl && (
              <Button variant="outline" className="h-8" disabled={logoBusy} onClick={() => void onRemoveLogo()}>
                {logoBusy ? "Working…" : "Remove logo"}
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-5">
        <p className="text-sm font-medium">Printed Documents</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Applies to every receipt, payslip, and report generated across the system.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <SettingsSelect
            label="Logo & Header Layout"
            value={draft.documentHeaderLayout}
            onChange={(e) => update({ documentHeaderLayout: e.target.value as "LEFT" | "CENTERED" })}
          >
            <option value="LEFT">Left-aligned (logo beside name)</option>
            <option value="CENTERED">Centered (logo above name)</option>
          </SettingsSelect>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <SettingsInput label="Report Header (optional)" value={draft.reportHeader} onChange={(e) => update({ reportHeader: e.target.value })} />
          <SettingsTextarea label="Report Footer (optional)" rows={2} value={draft.reportFooter} onChange={(e) => update({ reportFooter: e.target.value })} />
        </div>
      </div>

      <SettingsSaveBar dirty={dirty} saving={saving} onSave={save} onCancel={cancel} onResetDefault={resetToDefault} />
    </div>
  );
}
