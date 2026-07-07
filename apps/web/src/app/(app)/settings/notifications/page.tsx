"use client";

import { SettingsSaveBar } from "@/components/settings/settings-save-bar";
import { SettingsToggle } from "@/components/settings/settings-toggle";
import { useSettingsSection } from "@/components/settings/use-settings-section";
import type { NotificationEventFlags } from "@/lib/settings/types";

const CHANNELS = [
  { key: "inApp" as const, label: "In-App Notifications" },
  { key: "email" as const, label: "Email Notifications" },
  { key: "sms" as const, label: "SMS Notifications (Future)" },
  { key: "whatsapp" as const, label: "WhatsApp Notifications (Future)" },
];

const EVENTS: { key: keyof NotificationEventFlags; label: string }[] = [
  { key: "newStudent", label: "New Student" },
  { key: "feeCollection", label: "Fee Collection" },
  { key: "examPublished", label: "Exam Published" },
  { key: "quizPublished", label: "Quiz Published" },
  { key: "attendanceAlert", label: "Attendance Alert" },
  { key: "resultPublished", label: "Result Published" },
];

export default function NotificationSettingsPage() {
  const { draft, update, dirty, cancel, resetToDefault, save, saving } =
    useSettingsSection("notifications");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Notification Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Enable channels and event triggers.</p>
      </div>
      <div className="space-y-2">
        <h2 className="font-semibold">Channels</h2>
        {CHANNELS.map((c) => (
          <SettingsToggle key={c.key} label={c.label} checked={draft[c.key]} onChange={(v) => update({ [c.key]: v })} />
        ))}
      </div>
      <div className="space-y-2">
        <h2 className="font-semibold">Events</h2>
        {EVENTS.map((e) => (
          <SettingsToggle
            key={e.key}
            label={e.label}
            checked={draft.events[e.key]}
            onChange={(v) => update({ events: { ...draft.events, [e.key]: v } })}
          />
        ))}
      </div>
      <SettingsSaveBar dirty={dirty} saving={saving} onSave={save} onCancel={cancel} onResetDefault={resetToDefault} />
    </div>
  );
}
