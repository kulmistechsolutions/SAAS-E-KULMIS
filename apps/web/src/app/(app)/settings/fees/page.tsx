"use client";

import { SettingsInput, SettingsSelect } from "@/components/settings/settings-field";
import { SettingsSaveBar } from "@/components/settings/settings-save-bar";
import { SettingsToggle } from "@/components/settings/settings-toggle";
import { useSettingsSection } from "@/components/settings/use-settings-section";

const MONTHS = [
  { v: 1, l: "January" },
  { v: 2, l: "February" },
  { v: 3, l: "March" },
  { v: 4, l: "April" },
  { v: 5, l: "May" },
  { v: 6, l: "June" },
  { v: 7, l: "July" },
  { v: 8, l: "August" },
  { v: 9, l: "September" },
  { v: 10, l: "October" },
  { v: 11, l: "November" },
  { v: 12, l: "December" },
];

export default function FeeSettingsPage() {
  const { draft, update, dirty, cancel, resetToDefault, save, saving } =
    useSettingsSection("fees");
  const isAnnual = draft.billingMode === "ACADEMIC_YEAR";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Fee Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose billing mode for the school. Only one mode applies per academic year.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <SettingsSelect
          label="Billing Mode"
          value={draft.billingMode}
          onChange={(e) =>
            update({ billingMode: e.target.value as "MONTHLY" | "ACADEMIC_YEAR" })
          }
        >
          <option value="MONTHLY">Monthly Billing</option>
          <option value="ACADEMIC_YEAR">Academic Year Billing</option>
        </SettingsSelect>
        <SettingsInput
          label={isAnnual ? "Month Setup Day (monthly mode only)" : "Month Setup Day"}
          type="number"
          min={1}
          max={28}
          value={draft.monthSetupDay}
          onChange={(e) => update({ monthSetupDay: Number(e.target.value) })}
        />
        {isAnnual && (
          <>
            <SettingsInput
              label="Academic Months"
              type="number"
              min={1}
              max={12}
              value={draft.academicMonths}
              onChange={(e) => update({ academicMonths: Number(e.target.value) })}
            />
            <SettingsSelect
              label="Billing Start Month"
              value={draft.billingStartMonth}
              onChange={(e) =>
                update({ billingStartMonth: Number(e.target.value) })
              }
            >
              {MONTHS.map((m) => (
                <option key={m.v} value={m.v}>
                  {m.l}
                </option>
              ))}
            </SettingsSelect>
            <SettingsSelect
              label="Billing End Month"
              value={draft.billingEndMonth}
              onChange={(e) => update({ billingEndMonth: Number(e.target.value) })}
            >
              {MONTHS.map((m) => (
                <option key={m.v} value={m.v}>
                  {m.l}
                </option>
              ))}
            </SettingsSelect>
          </>
        )}
        <SettingsInput
          label="Currency Symbol"
          value={draft.currencySymbol}
          onChange={(e) => update({ currencySymbol: e.target.value })}
        />
        <SettingsInput
          label="Receipt Prefix"
          value={draft.receiptPrefix}
          onChange={(e) => update({ receiptPrefix: e.target.value.toUpperCase() })}
        />
      </div>
      {isAnnual && (
        <p className="rounded-lg border border-blue-200 bg-blue-50/80 p-3 text-sm text-blue-900">
          Annual tuition = Monthly Fee × Academic Months. Activate the academic year
          under Finance → Academic Year Setup after saving these settings.
        </p>
      )}
      <SettingsToggle
        label="Monthly Fee System"
        checked={draft.monthlyFeeSystem}
        onChange={(v) => update({ monthlyFeeSystem: v })}
      />
      <SettingsToggle
        label="Allow Partial Payment"
        checked={draft.allowPartialPayment}
        onChange={(v) => update({ allowPartialPayment: v })}
      />
      <SettingsToggle
        label="Allow Advance Payment"
        checked={draft.allowAdvancePayment}
        onChange={(v) => update({ allowAdvancePayment: v })}
      />
      <SettingsToggle
        label="Carry Forward Balance"
        checked={draft.carryForward}
        onChange={(v) => update({ carryForward: v })}
      />
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
