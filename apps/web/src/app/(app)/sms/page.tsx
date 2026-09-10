"use client";


import { useT, type TranslationKey } from "@/lib/i18n/provider";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  MessageSquare,
  RefreshCw,
  Send,
  Wallet,
  Users,
  Clock,
  PlugZap,
  Check,
  ChevronLeft,
  ChevronRight,
  } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RecipientPickerDialog } from "@/components/sms/recipient-picker";
import { ConfirmDialog } from "@/components/students/confirm-dialog";
import { GatewaySettings } from "@/components/sms/gateway-settings";
import { SenderIdCard } from "@/components/sms/sender-id-card";
import { CATEGORIES } from "@/components/sms/categories";
import { VariablePicker, VariableWarning } from "@/components/sms/variables";
import { smsCost } from "@/lib/sms/cost";
import {
  apiFeeReminders,
  apiPreviewAudience,
  apiSeedSmsTemplates,
  apiSendAudienceSms,
  apiSendSms,
  apiSmsBalance,
  apiClearSmsMessages,
  apiSmsMessages,
  apiSmsSettings,
  apiSmsTemplates,
  apiListContactGroups,
  type SmsContactGroup,
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
  groupClassNames,
  sectionNamesForClass,
  useAcademicsState,
} from "@/lib/academics/store";
import { activeAcademicYear } from "@/lib/academics/store";
import { toast } from "@/lib/toast";

type Tab = "send" | "custom" | "templates" | "contacts" | "logs" | "settings" | "gateway";

const AUDIENCES: { value: SmsAudience; label: TranslationKey; hint: string }[] = [
  {
    value: "ALL_PARENTS",
    label: "sms.allParents",
    hint: "Every active student's parent",
  },
  { value: "CLASS", label: "sms.aClass", hint: "Choose a class" },
  { value: "SECTION", label: "sms.aSection", hint: "Choose a class and section" },
  {
    value: "OUTSTANDING",
    label: "sms.outstandingFees",
    hint: "Parents who owe a balance",
  },
  { value: "TEACHERS", label: "sms.teachers", hint: "Every active teacher" },
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
  const t = useT();
  const tr = useT();
  const academics = useAcademicsState();
  const year = activeAcademicYear();
  const classes = useMemo(
    () => classNamesForYear(year),
    [year, academics.classes],
  );
  const classGroups = useMemo(
    () => groupClassNames(classes, year, t("common.defaultGrades")),
    [classes, year, academics.structureTrees, t],
  );

  const [tab, setTab] = useState<Tab>("send");
  const [balance, setBalance] = useState<SmsBalance | null>(null);
  const [templates, setTemplates] = useState<SmsTemplate[]>([]);
  const [messages, setMessages] = useState<SmsMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  // Which step is on screen. The three panels used to be shown at once,
  // which asked a school to read the whole form before it could tell what
  // it was meant to do first.
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [clearLogsOpen, setClearLogsOpen] = useState(false);
  const [clearingLogs, setClearingLogs] = useState(false);

  // ── Audience send ──────────────────────────────────────────────────────
  const [audience, setAudience] = useState<SmsAudience>("ALL_PARENTS");
  const [className, setClassName] = useState("");
  const [section, setSection] = useState("");
  const [groupId, setGroupId] = useState<string | null>(null);
  const [contactGroups, setContactGroups] = useState<SmsContactGroup[]>([]);

  const loadContactGroups = useCallback(async () => {
    try {
      setContactGroups(await apiListContactGroups());
    } catch {
      /* the send tab still works without custom groups loaded */
    }
  }, []);
  useEffect(() => {
    void loadContactGroups();
  }, [loadContactGroups]);
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
  const bulkRecipients = useMemo(
    () => parseBulkNumbers(bulkNumbers),
    [bulkNumbers],
  );

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
      setSmsEnabled(b.school.smsEnabled);
      if (t.length === 0) {
        const seeded = await apiSeedSmsTemplates();
        setTemplates(seeded);
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : "Something went wrong", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleClearLogs() {
    setClearingLogs(true);
    try {
      const res = await apiClearSmsMessages();
      setMessages([]);
      toast(`Cleared ${res.cleared} log ${res.cleared === 1 ? "entry" : "entries"}`, "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not clear logs", "error");
    } finally {
      setClearingLogs(false);
      setClearLogsOpen(false);
    }
  }

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
        audience === "CLASS" ||
        audience === "SECTION" ||
        audience === "OUTSTANDING";
      const usesSection = audience === "SECTION" || audience === "OUTSTANDING";
      const list = await apiPreviewAudience({
        audience,
        classId: usesClass ? (classId ?? null) : null,
        sectionId: usesSection ? (sectionId ?? null) : null,
        groupId: audience === "CONTACT_GROUP" ? groupId : null,
      });
      setRecipients(list);
      setSelected(new Set(list.map((r) => r.recordId)));
    } catch (e) {
      toast(
        e instanceof Error ? e.message : "Something went wrong",
        "error",
      );
      setRecipients([]);
      setSelected(new Set());
    } finally {
      setPreviewLoading(false);
    }
  }, [audience, classId, sectionId, groupId]);

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
    setSelected(
      checked ? new Set(recipients.map((r) => r.recordId)) : new Set(),
    );
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
      const scheduleIso = scheduledAt
        ? new Date(scheduledAt).toISOString()
        : null;
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
      } else if (audience === "CONTACT_GROUP") {
        payload.groupId = groupId;
        payload.contactIds = [...selected];
      } else {
        // The audience is now resolved and listed one row per PARENT (a
        // parent with several children used to get the same SMS once per
        // child), so the exclude-list selection is keyed on parentId, not
        // studentId — matching the recordId the picker now hands back.
        payload.parentIds = [...selected];
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
      setStep(1);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Something went wrong", "error");
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
      toast(e instanceof Error ? e.message : "Something went wrong", "error");
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
      const scheduleIso = bulkScheduledAt
        ? new Date(bulkScheduledAt).toISOString()
        : null;
      const res = await apiSendSms({
        category: bulkCategory,
        body: bulkBody,
        recipients: bulkRecipients.map((r) => ({
          phone: r.phone,
          name: r.name,
          type: "OTHER",
        })),
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
      toast(e instanceof Error ? e.message : "Something went wrong", "error");
    } finally {
      setSending(false);
    }
  }

  async function saveSettings() {
    try {
      // The sending name is granted through a sender ID application, not typed
      // here — see SenderIdCard.
      await apiSmsSettings({ smsEnabled });
      toast("SMS settings saved", "success");
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Something went wrong", "error");
    }
  }

  // Templates, contacts and logs each have a page of their own now, reached
  // from the sidebar. Leaving them here as well gave a school two doors into
  // the same room and made this screen look like the whole module rather than
  // the one job it does.
  const tabs: { id: Tab; label: TranslationKey; icon: typeof Send }[] = [
    { id: "send", label: "sms.send", icon: Send },
    { id: "custom", label: "sms.customSMS", icon: Users },
    { id: "settings", label: "sms.settings", icon: Wallet },
    { id: "gateway", label: "sms.mySMSAccount", icon: PlugZap },
  ];

  // A school on its own gateway (Hormuud/Dhambaal) never carries platform
  // credits — it pays the provider directly — so requiring
  // creditsRemaining > 0 unconditionally blocked every own-gateway school
  // from ever sending, regardless of how well-connected their account was.
  const canSend =
    !!balance?.provider.canSend &&
    (balance?.gateway?.active || (balance?.creditsRemaining ?? 0) > 0);
  const excludedCount = recipients.length - selected.size;
  // What the send will cost, from the same function the template editor
  // quotes with — two copies of this arithmetic is how a school is shown one
  // price and charged another.
  const cost = smsCost(body);
  const estimatedCredits = cost.segments * selected.size;
  const balanceAfter = (balance?.creditsRemaining ?? 0) - estimatedCredits;

  // Purchased vs left, so the bar means something. Summed over active
  // packages only: an expired package's credits are not spendable and
  // counting them would make the bar say a school has more than it has.
  const creditsRemaining = balance?.creditsRemaining ?? 0;
  const creditsTotal = (balance?.purchases ?? [])
    .filter((x) => x.status === "ACTIVE")
    .reduce((n, x) => n + x.creditsTotal, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <MessageSquare className="h-6 w-6 text-primary" />
            {tr("sms.sms")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {tr("sms.sendAnnouncementsFeeRemindersAndNotifications")}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/sms/packages"
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md border bg-background px-3 text-sm font-medium hover:bg-accent"
          >
            {tr("sms.buyCredits")}
          </Link>
          <Button variant="outline" onClick={() => void load()}>
            <RefreshCw className="me-2 h-4 w-4" /> {tr("sms.refresh")}
          </Button>
        </div>
      </div>

      {!loading && balance && !balance.provider.canSend && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">{tr("sms.smsSendingIsNotAvailableYet")}</p>
          <p className="mt-1">{balance.provider.message}</p>
          {!balance.provider.connected && (
            <p className="mt-1 text-xs">
              {tr("sms.thePlatformAdministratorMustConnectHormuud")}
            </p>
          )}
          {balance.provider.connected && balance.creditsRemaining === 0 && (
            <p className="mt-2">
              <Link href="/sms/packages" className="font-medium underline">
                {tr("sms.buySmsCredits")}
              </Link>
            </p>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-b pb-3">
        {tabs.map((tb) => (
          <button
            key={tb.id}
            type="button"
            onClick={() => setTab(tb.id)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors ${
              tab === tb.id
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:bg-secondary/80"
            }`}
          >
            <tb.icon className="h-3.5 w-3.5" />
            {t(tb.label)}
          </button>
        ))}
      </div>

      {tab === "send" && (
        <>
        <SendSteps
          step={step}
          hasAudience={selected.size > 0}
          hasMessage={body.trim().length > 0}
          sending={sending}
          onGo={setStep}
        />
        <div className="grid items-start gap-4 xl:grid-cols-3">
          <div className="flex min-h-[560px] flex-col gap-4 xl:col-span-2">
          {step === 1 && (
          <div className="flex-1 space-y-5 rounded-2xl border bg-card p-5 shadow-sm">
            {/* Step 1 — audience */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  1
                </span>
                <div>
                  <h2 className="font-semibold leading-tight">{tr("sms.chooseAudience")}</h2>
                  <p className="text-xs text-muted-foreground">
                    {tr("smsSend.step1Note")}
                  </p>
                </div>
              </div>
              <div>
                <Label>{tr("sms.sendTo")}</Label>
                <Select
                  className="mt-1.5"
                  value={audience === "CONTACT_GROUP" ? `CONTACT_GROUP:${groupId ?? ""}` : audience}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v.startsWith("CONTACT_GROUP:")) {
                      setAudience("CONTACT_GROUP");
                      setGroupId(v.slice("CONTACT_GROUP:".length));
                    } else {
                      setAudience(v as SmsAudience);
                      setGroupId(null);
                    }
                  }}
                >
                  {AUDIENCES.map((a) => (
                    <option key={a.value} value={a.value}>
                      {t(a.label)}
                    </option>
                  ))}
                  {contactGroups.length > 0 && (
                    <optgroup label="Custom Groups">
                      {contactGroups.map((g) => (
                        <option key={g.id} value={`CONTACT_GROUP:${g.id}`}>
                          {g.name} ({g._count.contacts})
                        </option>
                      ))}
                    </optgroup>
                  )}
                </Select>
                <p className="mt-1 text-xs text-muted-foreground">
                  {audience === "CONTACT_GROUP"
                    ? "Everyone in this custom group"
                    : AUDIENCES.find((a) => a.value === audience)?.hint}
                </p>
              </div>
              {(audience === "CLASS" ||
                audience === "SECTION" ||
                audience === "OUTSTANDING") && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>{tr("sms.class")}</Label>
                    <Select
                      className="mt-1.5"
                      value={className}
                      onChange={(e) => {
                        setClassName(e.target.value);
                        setSection("");
                      }}
                    >
                      <option value="">{tr("sms.all")}</option>
                      {classGroups.map((g) =>
                        g.label === null ? (
                          g.names.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))
                        ) : (
                          <optgroup key={g.label} label={g.label}>
                            {g.names.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </optgroup>
                        ),
                      )}
                    </Select>
                  </div>
                  {(audience === "SECTION" || audience === "OUTSTANDING") && (
                    <div>
                      <Label>{tr("sms.section")}</Label>
                      <Select
                        className="mt-1.5"
                        value={section}
                        onChange={(e) => setSection(e.target.value)}
                      >
                        <option value="">{tr("sms.all")}</option>
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
                      {recipients.length} {tr("sms.matched")}
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
                  {tr("sms.viewChoose")}
                </Button>
              </div>
            </div>

          </div>
          )}

          {/* Step 2 — compose */}
          {step === 2 && (
          <div className="flex-1 space-y-3 rounded-2xl border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  2
                </span>
                <div>
                  <h2 className="font-semibold leading-tight">{tr("sms.writeYourMessage")}</h2>
                  <p className="text-xs text-muted-foreground">
                    {tr("smsSend.step2Note")}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{tr("sms.category")}</Label>
                  <Select
                    className="mt-1.5"
                    value={category}
                    onChange={(e) => setCategory(e.target.value as SmsCategory)}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {t(c.label)}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label>{tr("sms.template")}</Label>
                  <Select
                    className="mt-1.5"
                    value={templateId}
                    onChange={(e) => setTemplateId(e.target.value)}
                  >
                    <option value="">{tr("sms.noneWriteCustom")}</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
              <div>
                <Label>{tr("sms.message")}</Label>
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
                    placeholder={tr("sms.writeYourMessageAndClickA")}
                  />
                </div>
                <VariableWarning body={body} />
              </div>
              <div>
                <Label>{tr("sms.scheduleOptional")}</Label>
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
                      {tr("sms.clear")}
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
              {/* What this send costs, before it is sent. The button used to
                  say how many people and never how much, so a school could
                  clear a month of credit in one click and find out after. */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="rounded-xl border bg-secondary/30 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    {tr("smsSend.messageLength")}
                  </p>
                  <p className="mt-1 text-xl font-bold tabular-nums">
                    {cost.chars}
                    <span className="ms-1 text-xs font-normal text-muted-foreground">
                      {tr("smsSend.characters")}
                    </span>
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {cost.segments} {tr("smsSend.segments")}
                    {cost.ucs2 ? ` \u00b7 ${tr("smsSend.specialChars")}` : ""}
                  </p>
                </div>
                <div className="rounded-xl border bg-secondary/30 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    {tr("smsSend.estimatedUsage")}
                  </p>
                  <p className="mt-1 text-xl font-bold tabular-nums text-primary">
                    {estimatedCredits}
                    <span className="ms-1 text-xs font-normal text-muted-foreground">
                      {tr("smsSend.credits")}
                    </span>
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {cost.segments} × {selected.size}
                  </p>
                </div>
              </div>
            </div>
          )}

            {/* Step 3 - preview and confirm */}
            {step === 3 && (
            <div className="flex-1 rounded-2xl border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  3
                </span>
                <div>
                  <h2 className="font-semibold leading-tight">
                    {tr("smsSend.previewConfirm")}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {tr("smsSend.step3Note")}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr),280px]">
                <dl className="space-y-2 text-sm">
                  <SendFact label={tr("smsSend.recipients")}>
                    {selected.size}
                  </SendFact>
                  <SendFact label={tr("smsSend.message")}>
                    <span className="block max-w-prose whitespace-pre-wrap text-muted-foreground">
                      {body.trim() || tr("smsSend.nothingWritten")}
                    </span>
                  </SendFact>
                  <SendFact label={tr("smsSend.characters")}>
                    {cost.chars}
                  </SendFact>
                  <SendFact label={tr("smsSend.segments")}>
                    {cost.segments}
                  </SendFact>
                  <SendFact label={tr("smsSend.estimatedUsage")}>
                    {estimatedCredits} {tr("smsSend.credits")}
                  </SendFact>
                  {!balance?.gateway?.active && (
                    <SendFact label={tr("smsSend.balanceAfter")}>
                      {/* Red when the send would not fit: the one number that
                          decides whether pressing the button achieves
                          anything at all. */}
                      <span
                        className={
                          balanceAfter < 0
                            ? "font-semibold text-rose-600"
                            : "font-semibold text-emerald-600"
                        }
                      >
                        {balanceAfter.toLocaleString()}
                      </span>
                    </SendFact>
                  )}
                </dl>

                {/* A message reads differently on a phone than in a textarea,
                    and a phone is where every one of these is actually read. */}
                <div className="mx-auto w-full max-w-[240px] rounded-2xl border bg-secondary/30 p-3">
                  <p className="text-center text-[11px] font-medium text-muted-foreground">
                    {tr("smsSend.newMessage")}
                  </p>
                  <div className="mt-2 rounded-xl bg-card p-3 text-sm shadow-sm">
                    <p className="whitespace-pre-wrap break-words">
                      {body.trim() || tr("smsSend.nothingWritten")}
                    </p>
                  </div>
                  <p className="mt-1 text-end text-[10px] text-muted-foreground">
                    {cost.chars}/{cost.ucs2 ? 70 : 160}
                  </p>
                </div>
              </div>

            </div>
            )}

            {/* Back and Next, in one bar that stays put whichever panel is on
                screen — and on the last step Next is the send itself, so the
                button that spends credits is never one a school reaches by
                accident. */}
            <div className="mt-auto flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card px-5 py-4 shadow-sm">
              <Button
                variant="outline"
                onClick={() => setStep((n) => (n > 1 ? ((n - 1) as 1 | 2 | 3) : n))}
                disabled={step === 1 || sending}
              >
                <ChevronLeft className="me-1.5 h-4 w-4" />
                {tr("smsSend.back")}
              </Button>

              <div className="flex flex-wrap items-center gap-2">
                {step === 3 && balanceAfter < 0 && !balance?.gateway?.active && (
                  <span className="text-xs font-medium text-rose-600">
                    {tr("smsSend.notEnoughCredit")}
                  </span>
                )}
                {step === 3 && audience === "OUTSTANDING" && (
                  <Button
                    variant="outline"
                    onClick={() => void handleFeeReminders()}
                    disabled={sending}
                  >
                    {tr("sms.sendDefaultFeeReminder")}
                  </Button>
                )}
                {step < 3 ? (
                  <Button
                    onClick={() => setStep((n) => ((n + 1) as 1 | 2 | 3))}
                    disabled={
                      (step === 1 && selected.size === 0) ||
                      (step === 2 && !body.trim())
                    }
                  >
                    {tr("smsSend.next")}
                    <ChevronRight className="ms-1.5 h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    onClick={() => void handleSend()}
                    disabled={
                      sending || !body.trim() || !canSend || selected.size === 0
                    }
                  >
                    <Send className="me-2 h-4 w-4" />
                    {sending
                      ? tr("smsSend.sending")
                      : scheduledAt
                        ? `${tr("smsSend.schedule")} (${selected.size})`
                        : `${tr("smsSend.send")} (${selected.size})`}
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
          {/* The balance sits beside the button that spends it. It used to be
              a card at the top of the page, four screens away from the send
              button by the time a long audience list had rendered. */}
          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs text-muted-foreground">
                  {tr("smsSend.smsBalance")}
                </p>
                {balance?.gateway?.active ? (
                  <>
                    <p className="mt-1 text-lg font-bold text-emerald-600">
                      {tr("sms.ownAccount")}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {tr("sms.platformCreditsAreNotUsed")}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="mt-1 text-3xl font-bold tabular-nums text-emerald-600">
                      {loading ? "\u2026" : creditsRemaining.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {tr("smsSend.available")}
                    </p>
                  </>
                )}
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  balance?.provider?.connected
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                    : "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
                }`}
              >
                {balance?.provider?.connected
                  ? tr("smsSend.connected")
                  : (balance?.provider?.status ?? "\u2014")}
              </span>
            </div>

            {!balance?.gateway?.active && creditsTotal > 0 && (
              <>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-emerald-500"
                    style={{
                      width: `${Math.min(100, Math.round((creditsRemaining / creditsTotal) * 100))}%`,
                    }}
                  />
                </div>
                <dl className="mt-3 space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">
                      {tr("smsSend.totalPurchased")}
                    </dt>
                    <dd className="font-medium tabular-nums">
                      {creditsTotal.toLocaleString()}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">{tr("smsSend.used")}</dt>
                    <dd className="font-medium tabular-nums">
                      {(creditsTotal - creditsRemaining).toLocaleString()}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">
                      {tr("smsSend.remaining")}
                    </dt>
                    <dd className="font-medium tabular-nums">
                      {creditsRemaining.toLocaleString()}
                    </dd>
                  </div>
                </dl>
              </>
            )}

            <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">
              {tr("sms.senderName")}:{" "}
              <span className="font-medium text-foreground">
                {balance?.school.sendingName || balance?.school.name || "\u2014"}
              </span>
            </p>

            {!balance?.gateway?.active && (
              <Link
                href="/sms/packages"
                className="mt-3 inline-flex h-9 w-full items-center justify-center rounded-lg bg-primary text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                {tr("sms.buyCredits")}
              </Link>
            )}
          </div>

          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <h2 className="font-semibold">{tr("sms.activePackages")}</h2>
            {balance?.gateway?.active ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Using your own {balance.gateway.provider === "DHAMBAAL" ? "Dhambaal" : "Hormuud"} account —
                sent directly through your provider, no platform package needed.
              </p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {(balance?.purchases ?? [])
                  .filter((p) => p.status === "ACTIVE")
                  .map((p) => (
                    <li key={p.id} className="rounded-lg border px-3 py-2">
                      <p className="font-medium">{p.package.name}</p>
                      <p className="text-muted-foreground">
                        {p.creditsRemaining} / {p.creditsTotal} {tr("sms.creditsRemaining")}
                      </p>
                    </li>
                  ))}
                {(balance?.purchases ?? []).filter((p) => p.status === "ACTIVE")
                  .length === 0 && (
                  <p className="text-muted-foreground">
                    {tr("sms.noActiveSmsPackageAskThe")}
                  </p>
                )}
              </ul>
            )}
            <h2 className="mt-6 font-semibold">{tr("sms.deliveryStats")}</h2>
            <ul className="mt-2 space-y-1 text-sm">
              {(balance?.deliveryStats ?? []).length === 0 && (
                <li className="text-muted-foreground">No messages sent yet.</li>
              )}
              {(balance?.deliveryStats ?? []).map((s) => (
                <li key={s.status} className="flex justify-between">
                  <span>{s.status}</span>
                  <span className="font-mono">
                    {s.count}
                    {!balance?.gateway?.active && ` (${s.credits} ${tr("sms.cr")})`}
                  </span>
                </li>
              ))}
            </ul>
            {(balance?.deliveryStats ?? []).length > 0 && (
              <p className="mt-3 border-t pt-3 text-sm font-medium">
                Total sent:{" "}
                {(balance?.deliveryStats ?? [])
                  .filter((s) => s.status === "SENT" || s.status === "DELIVERED")
                  .reduce((sum, s) => sum + s.count, 0)}
              </p>
            )}
          </div>

          {/* Recent sends, so the desk can see whether the message it is about
              to write has just gone out already. */}
          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold">{tr("smsSend.recentSms")}</h2>
              <Link
                href="/sms/history"
                className="text-xs font-medium text-primary hover:underline"
              >
                {tr("smsSend.viewAll")}
              </Link>
            </div>
            {messages.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                {tr("smsSend.nothingSentYet")}
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {messages.slice(0, 4).map((m) => (
                  <li key={m.id} className="rounded-lg border p-3">
                    <p className="line-clamp-2 text-xs">{m.body}</p>
                    <p className="mt-1 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                      <span>{m.recipientName || m.recipientPhone}</span>
                      <span>{new Date(m.createdAt).toLocaleDateString()}</span>
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
          </div>
        </div>

        </>
      )}

      {tab === "custom" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm">
            <div>
              <Label>{tr("sms.phoneNumbersOnePerLine")}</Label>
              <Textarea
                className="mt-1.5 min-h-[140px] font-mono text-sm"
                value={bulkNumbers}
                onChange={(e) => setBulkNumbers(e.target.value)}
                placeholder={
                  tr("sms.n25261xxxxxxxNameOptional25263xxxxxxx25265xxxxxxx")
                }
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {tr("sms.addOneNumberPerLineOr")} {bulkRecipients.length} {tr("sms.number")}
                {bulkRecipients.length === 1 ? "" : "s"} {tr("sms.detected")}
              </p>
            </div>
            <div>
              <Label>{tr("sms.category")}</Label>
              <Select
                className="mt-1.5"
                value={bulkCategory}
                onChange={(e) => setBulkCategory(e.target.value as SmsCategory)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {t(c.label)}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>{tr("sms.messageOneMessageSentToEveryone")}</Label>
              <Textarea
                className="mt-1.5 min-h-[120px]"
                value={bulkBody}
                onChange={(e) => setBulkBody(e.target.value)}
                placeholder={tr("sms.writeYourMessageHere")}
              />
            </div>
            <div>
              <Label>{tr("sms.scheduleOptional")}</Label>
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
                    {tr("sms.clear")}
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
              disabled={
                sending ||
                !bulkBody.trim() ||
                bulkRecipients.length === 0 ||
                !canSend
              }
            >
              <Send className="me-2 h-4 w-4" />
              {sending
                ? "Sending…"
                : bulkScheduledAt
                  ? `Schedule SMS (${bulkRecipients.length})`
                  : `Send SMS (${bulkRecipients.length})`}
            </Button>
          </div>

          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <h2 className="font-semibold">{tr("sms.howThisWorks")}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {tr("sms.useThisToSendOneMessage")}
            </p>
            {bulkRecipients.length > 0 && (
              <div className="mt-4 max-h-[280px] overflow-auto rounded-lg border">
                <ul className="divide-y text-sm">
                  {bulkRecipients.map((r) => (
                    <li
                      key={r.phone}
                      className="flex justify-between px-3 py-1.5"
                    >
                      <span className="font-mono">{r.phone}</span>
                      {r.name && (
                        <span className="text-muted-foreground">{r.name}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}




      {tab === "settings" && (
        <div className="space-y-4">
          <SenderIdCard />
          <div className="max-w-md space-y-4 rounded-2xl border bg-card p-5 shadow-sm">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={smsEnabled}
                onChange={(e) => setSmsEnabled(e.target.checked)}
              />
              {tr("sms.enableSmsForThisSchool")}
            </label>
            <Button onClick={() => void saveSettings()}>{tr("sms.saveSettings")}</Button>
          </div>
        </div>
      )}

      {tab === "gateway" && <GatewaySettings />}

      <RecipientPickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        recipients={recipients}
        selected={selected}
        onToggle={toggleRecipient}
        onToggleAll={toggleAllRecipients}
        loading={previewLoading}
      />

      <ConfirmDialog
        open={clearLogsOpen}
        onClose={() => setClearLogsOpen(false)}
        onConfirm={handleClearLogs}
        title="Clear SMS Logs"
        message={`Delete all ${messages.length} log entries shown here? This only clears the send-history log — it does not refund or change any credits.${clearingLogs ? " Clearing…" : ""}`}
        confirmLabel="Clear Logs"
      />
    </div>
  );
}

/**
 * The wizard's spine: where the desk is, what it has finished, and a way back.
 *
 * The steps were numbered inside the panels and nowhere else, so a half-filled
 * form looked the same as an empty one. They are now the navigation as well —
 * a finished step is a button back to its own panel, which is what a school
 * reaches for when it wants to change the audience after writing the message.
 */
function SendSteps({
  step,
  hasAudience,
  hasMessage,
  sending,
  onGo,
}: {
  step: 1 | 2 | 3;
  hasAudience: boolean;
  hasMessage: boolean;
  sending: boolean;
  onGo: (n: 1 | 2 | 3) => void;
}) {
  const tr = useT();

  // Sending is the fourth marker; it belongs to no panel, so it is shown but
  // never navigable.
  const current = sending ? 4 : step;

  const steps: { n: 1 | 2 | 3 | 4; label: TranslationKey; open: boolean }[] = [
    { n: 1, label: "smsSend.stepRecipients", open: true },
    { n: 2, label: "smsSend.stepCompose", open: hasAudience },
    { n: 3, label: "smsSend.stepPreview", open: hasAudience && hasMessage },
    { n: 4, label: "smsSend.stepSend", open: false },
  ];

  return (
    <ol className="flex flex-wrap items-center gap-x-3 gap-y-3 rounded-2xl border bg-card px-5 py-4 shadow-sm sm:flex-nowrap">
      {steps.map((s, i) => {
        const done = s.n < current;
        const active = s.n === current;
        // Only a step whose prerequisites are met can be jumped to; the fourth
        // is the send, which the button on the last panel owns.
        const go = s.open && s.n !== 4 && !sending;
        return (
          <Fragment key={s.n}>
            <li className="shrink-0">
              <button
                type="button"
                onClick={go ? () => onGo(s.n as 1 | 2 | 3) : undefined}
                disabled={!go}
                aria-current={active ? "step" : undefined}
                className={`flex items-center gap-2 rounded-full py-1 pe-3 ps-1 transition-colors ${
                  go ? "hover:bg-secondary" : "cursor-default"
                }`}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                    done
                      ? "bg-primary text-primary-foreground"
                      : active
                        ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                        : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {done ? <Check className="h-4 w-4" /> : s.n}
                </span>
                <span
                  className={`whitespace-nowrap text-xs ${
                    active
                      ? "font-semibold text-foreground"
                      : done
                        ? "font-medium text-foreground"
                        : "font-medium text-muted-foreground"
                  }`}
                >
                  {tr(s.label)}
                </span>
              </button>
            </li>
            {i < steps.length - 1 && (
              // The line fills whatever is left between two steps, so the four
              // of them stay evenly spread however long the labels translate to.
              <li
                aria-hidden
                className={`hidden h-0.5 min-w-4 flex-1 rounded-full sm:block ${
                  s.n < current ? "bg-primary" : "bg-border"
                }`}
              />
            )}
          </Fragment>
        );
      })}
    </ol>
  );
}

/** One labelled fact in the confirmation panel. */
function SendFact({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <dt className="w-32 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 font-medium">{children}</dd>
    </div>
  );
}

