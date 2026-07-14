"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  MessageSquare,
  RefreshCw,
  Send,
  Wallet,
  FileText,
  Bell,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  apiFeeReminders,
  apiSeedSmsTemplates,
  apiSendAudienceSms,
  apiSendSms,
  apiSmsBalance,
  apiSmsMessages,
  apiSmsSettings,
  apiSmsTemplates,
  type SmsBalance,
  type SmsCategory,
  type SmsMessage,
  type SmsTemplate,
} from "@/lib/sms/api";
import {
  classNamesForYear,
  ensureAcademicsLoaded,
  sectionNamesForClass,
  useAcademicsState,
} from "@/lib/academics/store";
import { activeAcademicYear } from "@/lib/academics/store";
import { toast } from "@/lib/toast";

const CATEGORIES: { value: SmsCategory; label: string }[] = [
  { value: "CUSTOM", label: "Custom" },
  { value: "FEE_REMINDER", label: "Fee reminder" },
  { value: "ANNOUNCEMENT", label: "Announcement" },
  { value: "EMERGENCY", label: "Emergency" },
  { value: "ATTENDANCE", label: "Attendance" },
  { value: "EXAM_ANNOUNCEMENT", label: "Exam announcement" },
  { value: "EXAM_RESULT", label: "Exam result" },
  { value: "ADMISSION", label: "Admission" },
  { value: "REGISTRATION", label: "Registration" },
  { value: "PAYMENT_CONFIRMATION", label: "Payment confirmation" },
];

type Tab = "send" | "templates" | "logs" | "settings";

export default function SchoolSmsPage() {
  const academics = useAcademicsState();
  const year = activeAcademicYear();
  const classes = useMemo(() => classNamesForYear(year), [year, academics.classes]);

  const [tab, setTab] = useState<Tab>("send");
  const [balance, setBalance] = useState<SmsBalance | null>(null);
  const [templates, setTemplates] = useState<SmsTemplate[]>([]);
  const [messages, setMessages] = useState<SmsMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const [audience, setAudience] = useState<
    "ALL_PARENTS" | "CLASS" | "SECTION" | "TEACHERS" | "OUTSTANDING" | "CUSTOM"
  >("ALL_PARENTS");
  const [className, setClassName] = useState("");
  const [section, setSection] = useState("");
  const [category, setCategory] = useState<SmsCategory>("ANNOUNCEMENT");
  const [body, setBody] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [customPhone, setCustomPhone] = useState("");
  const [customName, setCustomName] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");

  const [senderName, setSenderName] = useState("");
  const [smsEnabled, setSmsEnabled] = useState(true);

  const sections = useMemo(
    () => (className ? sectionNamesForClass(className, year) : []),
    [className, year, academics.sections],
  );

  const classId = useMemo(() => {
    const c = academics.classes.find(
      (x) => x.name === className && (!year || x.academicYear === year),
    );
    return c?.id;
  }, [academics.classes, className, year]);

  const sectionId = useMemo(() => {
    if (!classId || !section) return undefined;
    return academics.sections.find(
      (s) => s.classId === classId && s.name === section,
    )?.id;
  }, [academics.sections, classId, section]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await ensureAcademicsLoaded();
      const [b, t, m] = await Promise.all([
        apiSmsBalance(),
        apiSmsTemplates().catch(() => [] as SmsTemplate[]),
        apiSmsMessages(),
      ]);
      setBalance(b);
      setTemplates(t);
      setMessages(m);
      setSenderName(b.school.smsSenderName ?? b.school.name);
      setSmsEnabled(b.school.smsEnabled);
      if (t.length === 0) {
        const seeded = await apiSeedSmsTemplates();
        setTemplates(seeded);
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to load SMS", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!templateId) return;
    const tpl = templates.find((t) => t.id === templateId);
    if (tpl) {
      setBody(tpl.body);
      setCategory(tpl.category);
    }
  }, [templateId, templates]);

  async function handleSend() {
    setSending(true);
    try {
      const scheduleIso = scheduledAt
        ? new Date(scheduledAt).toISOString()
        : null;
      if (audience === "CUSTOM") {
        if (!customPhone.trim() || !body.trim()) {
          toast("Phone and message are required", "error");
          return;
        }
        const res = await apiSendSms({
          category,
          body,
          templateId: templateId || undefined,
          recipients: [
            { phone: customPhone.trim(), name: customName || undefined, type: "OTHER" },
          ],
          scheduledAt: scheduleIso,
        });
        toast(
          `Sent ${res.sent}, failed ${res.failed}, queued ${res.queued} (${res.creditsUsed} credits)`,
          res.failed ? "error" : "success",
        );
      } else {
        const res = await apiSendAudienceSms({
          category,
          body,
          audience,
          classId: classId ?? null,
          sectionId: sectionId ?? null,
          scheduledAt: scheduleIso,
          campaignName: `${category} ${new Date().toLocaleDateString()}`,
        });
        toast(
          `Sent ${res.sent}, failed ${res.failed}, queued ${res.queued} (${res.creditsUsed} credits)`,
          res.failed && !res.sent ? "error" : "success",
        );
      }
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Send failed", "error");
    } finally {
      setSending(false);
    }
  }

  async function handleFeeReminders() {
    setSending(true);
    try {
      const res = await apiFeeReminders(body || undefined);
      toast(
        `Fee reminders: sent ${res.sent}, failed ${res.failed} (${res.creditsUsed} credits)`,
        "success",
      );
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Fee reminders failed", "error");
    } finally {
      setSending(false);
    }
  }

  async function saveSettings() {
    try {
      await apiSmsSettings({
        smsSenderName: senderName || null,
        smsEnabled,
      });
      toast("SMS settings saved", "success");
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Save failed", "error");
    }
  }

  const tabs: { id: Tab; label: string; icon: typeof Send }[] = [
    { id: "send", label: "Send SMS", icon: Send },
    { id: "templates", label: "Templates", icon: FileText },
    { id: "logs", label: "Logs", icon: Bell },
    { id: "settings", label: "Settings", icon: Wallet },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <MessageSquare className="h-6 w-6 text-primary" />
            SMS
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Send announcements, fee reminders, and notifications via Hormuud SMS.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/sms/packages"
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md border bg-background px-3 text-sm font-medium hover:bg-accent"
          >
            Buy packages
          </Link>
          <Button variant="outline" onClick={() => void load()}>
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">Credits remaining</p>
          <p className="mt-1 text-3xl font-bold">
            {loading ? "…" : (balance?.creditsRemaining ?? 0)}
          </p>
        </div>
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">Hormuud SMS</p>
          <p
            className={`mt-1 text-lg font-semibold ${
              balance?.provider?.connected ? "text-emerald-600" : "text-amber-600"
            }`}
          >
            {loading
              ? "…"
              : balance?.provider?.connected
                ? "Connected"
                : balance?.provider?.status ?? "Not ready"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {balance?.provider?.message ?? "Loading provider status…"}
          </p>
        </div>
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">Sender name</p>
          <p className="mt-1 truncate text-lg font-semibold">
            {balance?.school.smsSenderName || balance?.school.name || "—"}
          </p>
        </div>
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">School SMS</p>
          <p className="mt-1 text-lg font-semibold">
            {balance?.school.smsEnabled ? "Enabled" : "Disabled"}
          </p>
        </div>
      </div>

      {!loading && balance && !balance.provider.canSend && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">SMS sending is not available yet</p>
          <p className="mt-1">{balance.provider.message}</p>
          {!balance.provider.connected && (
            <p className="mt-1 text-xs">
              The platform administrator must connect Hormuud SMS under Platform → SMS
              Settings. Then purchase an SMS package for your school.
            </p>
          )}
          {balance.provider.connected && balance.creditsRemaining === 0 && (
            <p className="mt-2">
              <Link href="/sms/packages" className="font-medium underline">
                Buy SMS credits
              </Link>
            </p>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm ${
              tab === t.id
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:bg-secondary/80"
            }`}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "send" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm">
            <div>
              <Label>Audience</Label>
              <Select
                className="mt-1.5"
                value={audience}
                onChange={(e) =>
                  setAudience(e.target.value as typeof audience)
                }
              >
                <option value="ALL_PARENTS">All parents</option>
                <option value="CLASS">Class</option>
                <option value="SECTION">Section</option>
                <option value="OUTSTANDING">Outstanding fees</option>
                <option value="TEACHERS">Teachers</option>
                <option value="CUSTOM">Custom number</option>
              </Select>
            </div>
            {(audience === "CLASS" || audience === "SECTION" || audience === "OUTSTANDING") && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Class</Label>
                  <Select
                    className="mt-1.5"
                    value={className}
                    onChange={(e) => {
                      setClassName(e.target.value);
                      setSection("");
                    }}
                  >
                    <option value="">Select…</option>
                    {classes.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Select>
                </div>
                {(audience === "SECTION" || audience === "OUTSTANDING") && (
                  <div>
                    <Label>Section</Label>
                    <Select
                      className="mt-1.5"
                      value={section}
                      onChange={(e) => setSection(e.target.value)}
                    >
                      <option value="">All</option>
                      {sections.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </Select>
                  </div>
                )}
              </div>
            )}
            {audience === "CUSTOM" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Phone</Label>
                  <Input
                    className="mt-1.5"
                    value={customPhone}
                    onChange={(e) => setCustomPhone(e.target.value)}
                    placeholder="+25261…"
                  />
                </div>
                <div>
                  <Label>Name</Label>
                  <Input
                    className="mt-1.5"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                  />
                </div>
              </div>
            )}
            <div>
              <Label>Category</Label>
              <Select
                className="mt-1.5"
                value={category}
                onChange={(e) => setCategory(e.target.value as SmsCategory)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Template (optional)</Label>
              <Select
                className="mt-1.5"
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
              >
                <option value="">None — write custom message</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Message</Label>
              <Textarea
                className="mt-1.5 min-h-[120px]"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Use {{Parent Name}}, {{Student Name}}, {{School Name}}, {{Outstanding Balance}}…"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Variables: {"{{Parent Name}}"}, {"{{Student Name}}"}, {"{{Class}}"},{" "}
                {"{{Outstanding Balance}}"}, {"{{School Name}}"}, {"{{Academic Year}}"}
              </p>
            </div>
            <div>
              <Label>Schedule (optional)</Label>
              <Input
                type="datetime-local"
                className="mt-1.5"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => void handleSend()}
                disabled={
                  sending ||
                  !body.trim() ||
                  !balance?.provider.canSend ||
                  (balance?.creditsRemaining ?? 0) <= 0
                }
              >
                <Send className="mr-2 h-4 w-4" />
                {sending ? "Sending…" : "Send SMS"}
              </Button>
              <Button
                variant="outline"
                onClick={() => void handleFeeReminders()}
                disabled={sending}
              >
                Run fee reminders
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <h2 className="font-semibold">Active packages</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {(balance?.purchases ?? [])
                .filter((p) => p.status === "ACTIVE")
                .map((p) => (
                  <li key={p.id} className="rounded-lg border px-3 py-2">
                    <p className="font-medium">{p.package.name}</p>
                    <p className="text-muted-foreground">
                      {p.creditsRemaining} / {p.creditsTotal} credits remaining
                    </p>
                  </li>
                ))}
              {(balance?.purchases ?? []).filter((p) => p.status === "ACTIVE")
                .length === 0 && (
                <p className="text-muted-foreground">
                  No active SMS package. Ask the platform administrator to assign one.
                </p>
              )}
            </ul>
            <h2 className="mt-6 font-semibold">Delivery stats</h2>
            <ul className="mt-2 space-y-1 text-sm">
              {(balance?.deliveryStats ?? []).map((s) => (
                <li key={s.status} className="flex justify-between">
                  <span>{s.status}</span>
                  <span className="font-mono">
                    {s.count} ({s.credits} cr)
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {tab === "templates" && (
        <div className="rounded-2xl border bg-card shadow-sm">
          <ul className="divide-y">
            {templates.map((t) => (
              <li key={t.id} className="px-5 py-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{t.name}</p>
                  <span className="text-xs text-muted-foreground">{t.category}</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{t.body}</p>
              </li>
            ))}
            {templates.length === 0 && (
              <li className="px-5 py-8 text-center text-muted-foreground">
                No templates. Click Refresh to seed defaults.
              </li>
            )}
          </ul>
        </div>
      )}

      {tab === "logs" && (
        <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Recipient</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Credits</th>
                <th className="px-4 py-3">When</th>
              </tr>
            </thead>
            <tbody>
              {messages.map((m) => (
                <tr key={m.id} className="border-t">
                  <td className="px-4 py-2">
                    <p>{m.recipientName ?? "—"}</p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {m.recipientPhone}
                    </p>
                    <p className="mt-0.5 max-w-xs truncate text-xs text-muted-foreground">
                      {m.body}
                    </p>
                  </td>
                  <td className="px-4 py-2 text-xs">{m.category}</td>
                  <td className="px-4 py-2">
                    <span
                      className={
                        m.status === "SENT" || m.status === "DELIVERED"
                          ? "text-emerald-600"
                          : m.status === "FAILED"
                            ? "text-rose-600"
                            : "text-amber-600"
                      }
                    >
                      {m.status}
                    </span>
                    {m.error && (
                      <p className="max-w-[180px] truncate text-xs text-rose-500">
                        {m.error}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-2 font-mono">{m.creditsUsed}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">
                    {new Date(m.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
              {messages.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    No SMS logs yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "settings" && (
        <div className="max-w-md space-y-4 rounded-2xl border bg-card p-5 shadow-sm">
          <div>
            <Label>Sender name (shown to recipients)</Label>
            <Input
              className="mt-1.5"
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
              maxLength={20}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Max 20 characters. Defaults to school name.
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={smsEnabled}
              onChange={(e) => setSmsEnabled(e.target.checked)}
            />
            Enable SMS for this school
          </label>
          <Button onClick={() => void saveSettings()}>Save settings</Button>
        </div>
      )}
    </div>
  );
}
