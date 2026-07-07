"use client";

import { SettingsInput, SettingsSelect } from "@/components/settings/settings-field";
import { SettingsSaveBar } from "@/components/settings/settings-save-bar";
import { SettingsToggle } from "@/components/settings/settings-toggle";
import { useSettingsSection } from "@/components/settings/use-settings-section";

export default function FeeSettingsPage() {
  const { draft, update, dirty, cancel, resetToDefault, save, saving } = useSettingsSection("fees");
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Fee Settings</h1><p className="mt-1 text-sm text-muted-foreground">Billing, payments, and receipts.</p></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <SettingsSelect label="Billing Mode" value={draft.billingMode} onChange={(e) => update({ billingMode: e.target.value as "MONTHLY" | "TERM" | "ANNUAL" })}>
          <option value="MONTHLY">Monthly</option><option value="TERM">Term</option><option value="ANNUAL">Annual</option>
        </SettingsSelect>
        <SettingsInput label="Month Setup Day" type="number" value={draft.monthSetupDay} onChange={(e) => update({ monthSetupDay: Number(e.target.value) })} />
        <SettingsInput label="Currency Symbol" value={draft.currencySymbol} onChange={(e) => update({ currencySymbol: e.target.value })} />
        <SettingsInput label="Receipt Prefix" value={draft.receiptPrefix} onChange={(e) => update({ receiptPrefix: e.target.value.toUpperCase() })} />
      </div>
      <SettingsToggle label="Monthly Fee System" checked={draft.monthlyFeeSystem} onChange={(v) => update({ monthlyFeeSystem: v })} />
      <SettingsToggle label="Allow Partial Payment" checked={draft.allowPartialPayment} onChange={(v) => update({ allowPartialPayment: v })} />
      <SettingsToggle label="Allow Advance Payment" checked={draft.allowAdvancePayment} onChange={(v) => update({ allowAdvancePayment: v })} />
      <SettingsToggle label="Carry Forward Balance" checked={draft.carryForward} onChange={(v) => update({ carryForward: v })} />
      <SettingsSaveBar dirty={dirty} saving={saving} onSave={save} onCancel={cancel} onResetDefault={resetToDefault} />
    </div>
  );
}
