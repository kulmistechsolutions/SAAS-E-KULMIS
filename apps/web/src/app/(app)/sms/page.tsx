"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  MessageSquare,
  RefreshCw,
  Send,
  Wallet,
  FileText,
  Bell,
  Users,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RecipientPickerDialog } from "@/components/sms/recipient-picker";
import { TemplateManager } from "@/components/sms/template-manager";
import { CATEGORIES } from "@/components/sms/categories";
import { VariablePicker, VariableWarning } from "@/components/sms/variables";
import {
  apiFeeReminders,
  apiPreviewAudience,
  apiSeedSmsTemplates,
  apiSendAudienceSms,
  apiSendSms,
  apiSmsBalance,
  apiSmsMessages,
  apiSmsSettings,
  apiSmsTemplates,
  type SmsAudience,
  type SmsAudienceRecipient,
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

type Tab = "send" | "custom" | "templates" | "logs" | "settings";

const AUDIENCES: { value: SmsAudience; label: string; hint: string }[] = [
  { value: "ALL_PARENTS", label: "All parents", hint: "Every active student's parent" },
  { value: "CLASS", label: "A class", hint: "Choose a class" },
  { value: "SECTION", label: "A section", hint: "Choose a class and section" },
  { value: "OUTSTANDING", label: "Outstanding fees", hint: "Parents who owe a balance" },
  { value: "TEACHERS", label: "Teachers", hint: "Every active teacher" },
];

/**
 * `datetime-local` inputs speak local time, so build the value by hand —
 * toISOString() would hand the browser a UTC string and shift the clock.
 */
function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

/** Parse "phone" or "phone, name" per line/comma/semicolon into recipients. */
function parseBulkNumbers(raw: string): { phone: string; name?: string }[] {
  const out: { phone: string; name?: string }[] = [];
  const seen = new Set<string>();
  for (const line of raw.split(/[\n;]+/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parts = trimmed.split(",").map((p) => p.trim());
    const phone = parts[0]?.replace(/[^\d+]/g, "");
    if (!phone || phone.length < 6) continue;
    if (seen.has(phone)) continue;
    seen.add(phone);
    out.push({ phone, name: parts[1] || undefined });
  }
  return out;
}

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

  // ── Audience send ──────────────────────────────────────────────────────
  const [audience, setAudience] = useState<SmsAudience>("ALL_PARENTS");
  const [className, setClassName] = useState("");
  const [section, setSection] = useState("");
  const [category, setCategory] = useState<SmsCategory>("ANNOUNCEMENT");
  const [body, setBody] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const [recipients, setRecipients] = useState<SmsAudienceRecipient[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [previewLoading, setPreviewLoading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  // ── Custom bulk send ───────────────────────────────────────────────────
  const [bulkNumbers, setBulkNumbers] = useState("");
  const [bulkCategory, setBulkCategory] = useState<SmsCategory>("CUSTOM");
  const [bulkBody, setBulkBody] = useState("");
  const [bulkScheduledAt, setBulkScheduledAt] = useState("");
  const bulkRecipients = useMemo(() => parseBulkNumbers(bulkNumbers), [bulkNumbers]);

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

  // Resolve who would receive the message whenever the audience changes.
  const loadPreview = useCallback(async () => {
    setPreviewLoading(true);
    try {
      const usesClass =
        audience === "CLASS" || audience === "SECTION" || audience === "OUTSTANDING";
      const usesSection = audience === "SECTION" || audience === "OUTSTANDING";
      const list = await apiPreviewAudience({
        audience,
        classId: usesClass ? classId ?? null : null,
        sectionId: usesSection ? sectionId ?? null : null,
      });
      setRecipients(list);
      setSelected(new Set(list.map((r) => r.recordId)));
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not load recipients", "error");
      setRecipients([]);
      setSelected(new Set());
    } finally {
      setPreviewLoading(false);
    }
  }, [audience, classId, sectionId]);

  useEffect(() => {
    if (tab !== "send") return;
    void loadPreview();
  }, [tab, loadPreview]);

  function toggleRecipient(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllRecipients(checked: boolean) {
    setSelected(checked ? new Set(recipients.map((r) => r.recordId)) : new Set());
  }

  async function handleSend() {
    if (selected.size === 0) {
      toast("Select at least one recipient", "error");
      return;
    }
    if (!body.trim()) {
      toast("Message is required", "error");
      return;
    }
    if (scheduledAt && new Date(scheduledAt).getTime() <= Date.now()) {
      toast("Pick a schedule time in the future", "error");
      return;
    }
    setSending(true);
    try {
      const scheduleIso = scheduledAt ? new Date(scheduledAt).toISOString() : null;
      const excludedCount = recipients.length - selected.size;
      const payload: Parameters<typeof apiSendAudienceSms>[0] = {
        category,
        body,
        audience,
        classId: classId ?? null,
        sectionId: sectionId ?? null,
        scheduledAt: scheduleIso,
        campaignName: `${category} ${new Date().toLocaleDateString()}`,
      };
      if (audience === "TEACHERS") {
        payload.teacherIds = [...selected];
      } else {
        payload.studentIds = [...selected];
      }
      const res = await apiSendAudienceSms(payload);
      const excluded = excludedCount > 0 ? `, ${excludedCount} excluded` : "";
      if (scheduleIso) {
        toast(
          `${res.queued} message(s) scheduled for ${new Date(
            scheduleIso,
          ).toLocaleString()}${excluded}`,
          "success",
        );
      } else {
        toast(
          `Sent ${res.sent}, failed ${res.failed}${excluded} (${res.creditsUsed} credits)`,
          res.failed && !res.sent ? "error" : "success",
        );
      }
      await load();
      await loadPreview();
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

  async function handleBulkSend() {
    if (bulkRecipients.length === 0) {
      toast("Enter at least one phone number", "error");
      return;
    }
    if (!bulkBody.trim()) {
      toast("Message is required", "error");
      return;
    }
    if (bulkScheduledAt && new Date(bulkScheduledAt).getTime() <= Date.now()) {
      toast("Pick a schedule time in the future", "error");
      return;
    }
    setSending(true);
    try {
      const scheduleIso = bulkScheduledAt ? new Date(bulkScheduledAt).toISOString() : null;
      const res = await apiSendSms({
        category: bulkCategory,
        body: bulkBody,
        recipients: bulkRecipients.map((r) => ({ phone: r.phone, name: r.name, type: "OTHER" })),
        scheduledAt: scheduleIso,
      });
      if (scheduleIso) {
        toast(
          `${res.queued} message(s) scheduled for ${new Date(
            scheduleIso,
          ).toLocaleString()}`,
          "success",
        );
      } else {
        toast(
          `Sent ${res.sent}, failed ${res.failed} (${res.creditsUsed} credits)`,
          res.failed && !res.sent ? "error" : "success",
        );
      }
      setBulkNumbers("");
      setBulkBody("");
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Send failed", "error");
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
    { id: "send", label: "Send", icon: Send },
    { id: "custom", label: "Custom SMS", icon: Users },
    { id: "templates", label: "Templates", icon: FileText },
    { id: "logs", label: "Logs", icon: Bell },
    { id: "settings", label: "Settings", icon: Wallet },
  ];

  const canSend = !!balance?.provider.canSend && (balance?.creditsRemaining ?? 0) > 0;
  const excludedCount = recipients.length - selected.size;

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
            Buy credits
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
                : (balance?.provider?.status ?? "Not ready")}
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

      <div className="flex flex-wrap gap-2 border-b pb-3">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors ${
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
          <div className="space-y-5 rounded-2xl border bg-card p-5 shadow-sm">
            {/* Step 1 — audience */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  1
                </span>
                <h2 className="font-semibold">Choose audience</h2>
              </div>
              <div>
                <Label>Send to</Label>
                <Select
                  className="mt-1.5"
                  value={audience}
                  onChange={(e) => setAudience(e.target.value as SmsAudience)}
                >
                  {AUDIENCES.map((a) => (
                    <option key={a.value} value={a.value}>
                      {a.label}
                    </option>
                  ))}
                </Select>
                <p className="mt-1 text-xs text-muted-foreground">
                  {AUDIENCES.find((a) => a.value === audience)?.hint}
                </p>
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
                      <option value="">All…</option>
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

              {/* Recipient summary + View button (opens the picker dialog) */}
              <div className="flex items-center justify-between rounded-xl border bg-secondary/40 px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <Users className="h-5 w-5 text-muted-foreground" />
                  <div className="text-sm">
                    <p className="font-medium">
                      {previewLoading
                        ? "Loading recipients…"
                        : `${selected.size} recipient${selected.size === 1 ? "" : "s"} selected`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {recipients.length} matched
                      {excludedCount > 0 ? ` · ${excludedCount} excluded` : ""}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="h-8 px-3 text-xs"
                  onClick={() => setPickerOpen(true)}
                  disabled={recipients.length === 0 && !previewLoading}
                >
                  View & choose
                </Button>
              </div>
            </div>

            {/* Step 2 — compose */}
            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  2
                </span>
                <h2 className="font-semibold">Write your message</h2>
              </div>
              <div className="grid grid-cols-2 gap-3">
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
                  <Label>Template</Label>
                  <Select
                    className="mt-1.5"
                    value={templateId}
                    onChange={(e) => setTemplateId(e.target.value)}
                  >
                    <option value="">None — write custom</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
              <div>
                <Label>Message</Label>
                <div className="mt-1.5 space-y-2">
                  <VariablePicker
                    targetRef={bodyRef}
                    value={body}
                    onChange={setBody}
                  />
                  <Textarea
                    ref={bodyRef}
                    className="min-h-[120px]"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Write your message, and click a variable above to insert it…"
                  />
                </div>
                <VariableWarning body={body} />
              </div>
              <div>
                <Label>Schedule (optional)</Label>
                <div className="mt-1.5 flex items-center gap-2">
                  <Input
                    type="datetime-local"
                    min={toLocalInputValue(new Date())}
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                  />
                  {scheduledAt && (
                    <Button
                      variant="outline"
                      className="h-8 shrink-0 px-3 text-xs"
                      onClick={() => setScheduledAt("")}
                    >
                      Clear
                    </Button>
                  )}
                </div>
                <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {scheduledAt
                    ? `Will be sent on ${new Date(scheduledAt).toLocaleString()}`
                    : "Leave empty to send right now."}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  onClick={() => void handleSend()}
                  disabled={sending || !body.trim() || !canSend || selected.size === 0}
                >
                  <Send className="mr-2 h-4 w-4" />
                  {sending
                    ? "Sending…"
                    : scheduledAt
                      ? `Schedule SMS (${selected.size})`
                      : `Send SMS (${selected.size})`}
                </Button>
                {audience === "OUTSTANDING" && (
                  <Button
                    variant="outline"
                    onClick={() => void handleFeeReminders()}
                    disabled={sending}
                  >
                    Send default fee reminder
                  </Button>
                )}
              </div>
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

      {tab === "custom" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm">
            <div>
              <Label>Phone numbers (one per line)</Label>
              <Textarea
                className="mt-1.5 min-h-[140px] font-mono text-sm"
                value={bulkNumbers}
                onChange={(e) => setBulkNumbers(e.target.value)}
                placeholder={"25261xxxxxxx, Name (optional)\n25263xxxxxxx\n25265xxxxxxx"}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Add one number per line, or separate with a comma. You can add a name after
                a comma. {bulkRecipients.length} number{bulkRecipients.length === 1 ? "" : "s"} detected.
              </p>
            </div>
            <div>
              <Label>Category</Label>
              <Select
                className="mt-1.5"
                value={bulkCategory}
                onChange={(e) => setBulkCategory(e.target.value as SmsCategory)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Message (one message sent to everyone)</Label>
              <Textarea
                className="mt-1.5 min-h-[120px]"
                value={bulkBody}
                onChange={(e) => setBulkBody(e.target.value)}
                placeholder="Write your message here…"
              />
            </div>
            <div>
              <Label>Schedule (optional)</Label>
              <div className="mt-1.5 flex items-center gap-2">
                <Input
                  type="datetime-local"
                  min={toLocalInputValue(new Date())}
                  value={bulkScheduledAt}
                  onChange={(e) => setBulkScheduledAt(e.target.value)}
                />
                {bulkScheduledAt && (
                  <Button
                    variant="outline"
                    className="h-8 shrink-0 px-3 text-xs"
                    onClick={() => setBulkScheduledAt("")}
                  >
                    Clear
                  </Button>
                )}
              </div>
              <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {bulkScheduledAt
                  ? `Will be sent on ${new Date(bulkScheduledAt).toLocaleString()}`
                  : "Leave empty to send right now."}
              </p>
            </div>
            <Button
              onClick={() => void handleBulkSend()}
              disabled={sending || !bulkBody.trim() || bulkRecipients.length === 0 || !canSend}
            >
              <Send className="mr-2 h-4 w-4" />
              {sending
                ? "Sending…"
                : bulkScheduledAt
                  ? `Schedule SMS (${bulkRecipients.length})`
                  : `Send SMS (${bulkRecipients.length})`}
            </Button>
          </div>

          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <h2 className="font-semibold">How this works</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Use this to send one message to many phone numbers that aren&apos;t in your
              student or parent lists — like a WhatsApp broadcast. Paste the numbers, write one
              message, and everyone gets the same message at once.
            </p>
            {bulkRecipients.length > 0 && (
              <div className="mt-4 max-h-[280px] overflow-auto rounded-lg border">
                <ul className="divide-y text-sm">
                  {bulkRecipients.map((r) => (
                    <li key={r.phone} className="flex justify-between px-3 py-1.5">
                      <span className="font-mono">{r.phone}</span>
                      {r.name && <span className="text-muted-foreground">{r.name}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "templates" && (
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <TemplateManager templates={templates} onChanged={load} />
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
              Max 20 characters. Defaults to the school name.
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

      <RecipientPickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        recipients={recipients}
        selected={selected}
        onToggle={toggleRecipient}
        onToggleAll={toggleAllRecipients}
        loading={previewLoading}
      />
    </div>
  );
}
