"use client";

import { SettingsInput } from "@/components/settings/settings-field";
import { SettingsSaveBar } from "@/components/settings/settings-save-bar";
import { useSettingsSection } from "@/components/settings/use-settings-section";
import { sendTestEmail } from "@/lib/settings/store";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";

export default function EmailSettingsPage() {
  const { draft, update, dirty, cancel, resetToDefault, save, saving } = useSettingsSection("email");

  function testEmail() {
    const result = sendTestEmail();
    toast(result.message, result.ok ? "success" : "error");
  }

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Email / SMTP Settings</h1></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <SettingsInput label="SMTP Host" value={draft.smtpHost} onChange={(e) => update({ smtpHost: e.target.value })} />
        <SettingsInput label="SMTP Port" type="number" value={draft.smtpPort} onChange={(e) => update({ smtpPort: Number(e.target.value) })} />
        <SettingsInput label="SMTP Username" value={draft.smtpUsername} onChange={(e) => update({ smtpUsername: e.target.value })} />
        <SettingsInput label="SMTP Password" type="password" value={draft.smtpPassword} onChange={(e) => update({ smtpPassword: e.target.value })} />
        <SettingsInput label="Sender Name" value={draft.senderName} onChange={(e) => update({ senderName: e.target.value })} />
        <SettingsInput label="Sender Email" type="email" value={draft.senderEmail} onChange={(e) => update({ senderEmail: e.target.value })} />
      </div>
      <Button onClick={testEmail}>Send Test Email</Button>
      <SettingsSaveBar dirty={dirty} saving={saving} onSave={save} onCancel={cancel} onResetDefault={resetToDefault} />
    </div>
  );
}
