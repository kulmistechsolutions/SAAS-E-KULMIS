"use client";


import { useT } from "@/lib/i18n/provider";
import { SettingsInput, SettingsSelect, SettingsTextarea } from "@/components/settings/settings-field";
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
  const t = useT();
  const { draft, update, dirty, cancel, resetToDefault, save, saving } =
    useSettingsSection("fees");
  const isAnnual = draft.billingMode === "ACADEMIC_YEAR";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("settingsFees.feeSettings")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("settingsFees.chooseBillingModeForTheSchool")}
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <SettingsSelect
          label={t("settingsFees.billingMode")}
          value={draft.billingMode}
          onChange={(e) =>
            update({ billingMode: e.target.value as "MONTHLY" | "ACADEMIC_YEAR" })
          }
        >
          <option value="MONTHLY">{t("settingsFees.monthlyBilling")}</option>
          <option value="ACADEMIC_YEAR">{t("settingsFees.academicYearBilling")}</option>
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
              label={t("settingsFees.academicMonths")}
              type="number"
              min={1}
              max={12}
              value={draft.academicMonths}
              onChange={(e) => update({ academicMonths: Number(e.target.value) })}
            />
            <SettingsSelect
              label={t("settingsFees.billingStartMonth")}
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
              label={t("settingsFees.billingEndMonth")}
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
          label={t("settingsFees.currencySymbol")}
          value={draft.currencySymbol}
          onChange={(e) => update({ currencySymbol: e.target.value })}
        />
        <SettingsInput
          label={t("settingsFees.receiptPrefix")}
          value={draft.receiptPrefix}
          onChange={(e) => update({ receiptPrefix: e.target.value.toUpperCase() })}
        />
        <SettingsInput
          label={t("settingsFees.registrationFee")}
          type="number"
          min={0}
          value={draft.registrationFeeAmount}
          onChange={(e) => update({ registrationFeeAmount: Number(e.target.value) })}
        />
      </div>
      <p className="text-xs text-muted-foreground">{t("settingsFees.registrationFeeHint")}</p>
      {isAnnual && (
        <p className="rounded-lg border border-blue-200 bg-blue-50/80 p-3 text-sm text-blue-900">
          {t("settingsFees.annualTuitionMonthlyFeeAcademicMonths")}
        </p>
      )}
      <SettingsToggle
        label={t("settingsFees.monthlyFeeSystem")}
        checked={draft.monthlyFeeSystem}
        onChange={(v) => update({ monthlyFeeSystem: v })}
      />
      <SettingsToggle
        label={t("settingsFees.allowPartialPayment")}
        checked={draft.allowPartialPayment}
        onChange={(v) => update({ allowPartialPayment: v })}
      />
      <SettingsToggle
        label={t("settingsFees.allowAdvancePayment")}
        checked={draft.allowAdvancePayment}
        onChange={(v) => update({ allowAdvancePayment: v })}
      />
      <SettingsToggle
        label={t("settingsFees.carryForwardBalance")}
        checked={draft.carryForward}
        onChange={(v) => update({ carryForward: v })}
      />
      <div className="rounded-xl border bg-card p-5">
        <p className="text-sm font-medium">{t("settingsFees.feeReceiptHeaderAmpFooter")}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t("settingsFees.shownOnEveryPrintedFeeReceipt")}</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <SettingsInput label={t("settingsFees.receiptHeaderOptional")} value={draft.receiptHeader} onChange={(e) => update({ receiptHeader: e.target.value })} />
          <SettingsTextarea label={t("settingsFees.receiptFooter")} rows={2} value={draft.receiptFooter} onChange={(e) => update({ receiptFooter: e.target.value })} />
        </div>
      </div>
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
