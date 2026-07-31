"use client";


import { useT } from "@/lib/i18n/provider";
import { useState } from "react";
import { SettingsInput } from "@/components/settings/settings-field";
import { SettingsSaveBar } from "@/components/settings/settings-save-bar";
import { SettingsToggle } from "@/components/settings/settings-toggle";
import { useSettingsSection } from "@/components/settings/use-settings-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiChangePassword } from "@/lib/teachers/api";
import { toast } from "@/lib/toast";

export default function SecuritySettingsPage() {
  const t = useT();
  const { draft, update, dirty, cancel, resetToDefault, save, saving } = useSettingsSection("security");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPw, setChangingPw] = useState(false);

  async function changePassword() {
    if (!newPassword || newPassword.length < 8) {
      toast(t("settingsSecurity.newPasswordMinLength"), "error");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast(t("auth.passwordsDoNotMatch"), "error");
      return;
    }
    setChangingPw(true);
    try {
      await apiChangePassword({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast(t("auth.passwordChanged"), "success");
    } catch {
      toast(t("settingsSecurity.changePasswordFailed"), "error");
    } finally {
      setChangingPw(false);
    }
  }

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">{t("settingsSecurity.securitySettings")}</h1></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <SettingsInput label={t("settingsSecurity.passwordMinimumLength")} type="number" value={draft.minPasswordLength} onChange={(e) => update({ minPasswordLength: Number(e.target.value) })} />
        <SettingsInput label={t("settingsSecurity.sessionTimeoutMinutes")} type="number" value={draft.sessionTimeoutMinutes} onChange={(e) => update({ sessionTimeoutMinutes: Number(e.target.value) })} />
        <SettingsInput label={t("settingsSecurity.loginAttemptLimit")} type="number" value={draft.loginAttemptLimit} onChange={(e) => update({ loginAttemptLimit: Number(e.target.value) })} />
        <SettingsInput label={t("settingsSecurity.ipRestrictionOptional")} value={draft.ipRestriction} onChange={(e) => update({ ipRestriction: e.target.value })} placeholder={t("settingsSecurity.eG19216810")} />
      </div>
      <SettingsToggle label={t("settingsSecurity.passwordComplexity")} checked={draft.requireComplexity} onChange={(v) => update({ requireComplexity: v })} />
      <SettingsToggle label={t("settingsSecurity.requireUppercase")} checked={draft.requireUppercase} onChange={(v) => update({ requireUppercase: v })} />
      <SettingsToggle label={t("settingsSecurity.requireNumber")} checked={draft.requireNumber} onChange={(v) => update({ requireNumber: v })} />
      <SettingsToggle label={t("settingsSecurity.twoFactorAuthenticationFuture")} checked={draft.twoFactorEnabled} onChange={(v) => update({ twoFactorEnabled: v })} />
      <SettingsSaveBar dirty={dirty} saving={saving} onSave={save} onCancel={cancel} onResetDefault={resetToDefault} />

      <div className="rounded-xl border bg-card p-6 space-y-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {t("settingsSecurity.changeMyPassword")}
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {t("settingsSecurity.changeMyPasswordHint")}
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="sec-current-pw">{t("auth.currentPassword")}</Label>
            <Input
              id="sec-current-pw"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="sec-new-pw">{t("auth.newPassword")}</Label>
            <Input
              id="sec-new-pw"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="sec-confirm-pw">{t("auth.confirmPassword")}</Label>
            <Input
              id="sec-confirm-pw"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1"
            />
          </div>
        </div>
        <Button variant="outline" onClick={() => void changePassword()} disabled={changingPw}>
          {changingPw ? t("settingsSecurity.updating") : t("settingsSecurity.updatePassword")}
        </Button>
      </div>
    </div>
  );
}
