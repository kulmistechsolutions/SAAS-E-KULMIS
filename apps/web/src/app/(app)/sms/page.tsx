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
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RecipientPreview } from "@/components/sms/recipient-preview";
import { TemplateManager } from "@/components/sms/template-manager";
import { CATEGORIES } from "@/components/sms/categories";
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
  { value: "ALL_PARENTS", label: "Dhammaan Waalidiinta", hint: "Dhammaan ardayda firfircoon" },
  { value: "CLASS", label: "Fasal gaar ah", hint: "Xulo fasal" },
  { value: "SECTION", label: "Xarun gaar ah", hint: "Xulo fasal iyo xarun" },
  { value: "OUTSTANDING", label: "Lacag Hadhaysa", hint: "Waalidiinta ay ku leeyihiin deyn" },
  { value: "TEACHERS", label: "Macallimiinta", hint: "Dhammaan macallimiinta firfircoon" },
];

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

  const [recipients, setRecipients] = useState<SmsAudienceRecipient[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [previewLoading, setPreviewLoading] = useState(false);

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

  // Load recipient preview whenever the audience/class/section changes.
  const loadPreview = useCallback(async () => {
    setPreviewLoading(true);
    try {
      const list = await apiPreviewAudience({
        audience,
        classId: audience === "CLASS" || audience === "SECTION" || audience === "OUTSTANDING" ? classId ?? null : null,
        sectionId: audience === "SECTION" || audience === "OUTSTANDING" ? sectionId ?? null : null,
      });
      setRecipients(list);
      setSelected(new Set(list.map((r) => r.recordId)));
    } catch (e) {
      toast(e instanceof Error ? e.message : "Liiska qaadis way fashilantay", "error");
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
      toast("Fadlan ugu yaraan hal qof dooro", "error");
      return;
    }
    if (!body.trim()) {
      toast("Fariinta waa loo baahan yahay", "error");
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
      toast(
        `Waa la diray ${res.sent}, way fashilantay ${res.failed}${
          excludedCount > 0 ? `, ${excludedCount} qof waa laga reebay` : ""
        } (${res.creditsUsed} credits)`,
        res.failed && !res.sent ? "error" : "success",
      );
      await load();
      await loadPreview();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Diridda way fashilantay", "error");
    } finally {
      setSending(false);
    }
  }

  async function handleFeeReminders() {
    setSending(true);
    try {
      const res = await apiFeeReminders(body || undefined);
      toast(
        `Xasuusinta lacagta: waa la diray ${res.sent}, way fashilantay ${res.failed} (${res.creditsUsed} credits)`,
        "success",
      );
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Xasuusinta way fashilantay", "error");
    } finally {
      setSending(false);
    }
  }

  async function handleBulkSend() {
    if (bulkRecipients.length === 0) {
      toast("Fadlan geli ugu yaraan hal lambar taleefan", "error");
      return;
    }
    if (!bulkBody.trim()) {
      toast("Fariinta waa loo baahan yahay", "error");
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
      toast(
        `Waa la diray ${res.sent}, way fashilantay ${res.failed}, sugaya ${res.queued} (${res.creditsUsed} credits)`,
        res.failed && !res.sent ? "error" : "success",
      );
      setBulkNumbers("");
      setBulkBody("");
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Diridda way fashilantay", "error");
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
      toast("Dejinta SMS-ka waa la kaydiyay", "success");
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Save failed", "error");
    }
  }

  const tabs: { id: Tab; label: string; icon: typeof Send }[] = [
    { id: "send", label: "Dir Liis", icon: Send },
    { id: "custom", label: "SMS Gaar ah", icon: Users },
    { id: "templates", label: "Templates", icon: FileText },
    { id: "logs", label: "Diiwaanka", icon: Bell },
    { id: "settings", label: "Dejinta", icon: Wallet },
  ];

  const canSend = !!balance?.provider.canSend && (balance?.creditsRemaining ?? 0) > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <MessageSquare className="h-6 w-6 text-primary" />
            SMS
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            U dir ogeysiisyo, xasuusin lacag, iyo fariimo dadka dugsigaaga via Hormuud SMS.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/sms/packages"
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md border bg-background px-3 text-sm font-medium hover:bg-accent"
          >
            Iibso Credits
          </Link>
          <Button variant="outline" onClick={() => void load()}>
            <RefreshCw className="mr-2 h-4 w-4" /> Cusboonaysii
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">Credits hadhay</p>
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
                ? "Isku xiran"
                : (balance?.provider?.status ?? "Diyaar maaha")}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {balance?.provider?.message ?? "Soo raridda xaaladda…"}
          </p>
        </div>
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">Magaca Diraha</p>
          <p className="mt-1 truncate text-lg font-semibold">
            {balance?.school.smsSenderName || balance?.school.name || "—"}
          </p>
        </div>
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">SMS Dugsiga</p>
          <p className="mt-1 text-lg font-semibold">
            {balance?.school.smsEnabled ? "Furan" : "Xiran"}
          </p>
        </div>
      </div>

      {!loading && balance && !balance.provider.canSend && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">Diridda SMS-ka weli lama heli karo</p>
          <p className="mt-1">{balance.provider.message}</p>
          {!balance.provider.connected && (
            <p className="mt-1 text-xs">
              Maamulaha nidaamka waa inuu isku xiraa Hormuud SMS Platform → SMS Settings.
              Ka dib waxaad iibsan kartaa package.
            </p>
          )}
          {balance.provider.connected && balance.creditsRemaining === 0 && (
            <p className="mt-2">
              <Link href="/sms/packages" className="font-medium underline">
                Iibso SMS Credits
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
          <div className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm">
            <h2 className="font-semibold">1. Xulo Dadka</h2>
            <div>
              <Label>Kooxda la diri doono</Label>
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
                  <Label>Fasal</Label>
                  <Select
                    className="mt-1.5"
                    value={className}
                    onChange={(e) => {
                      setClassName(e.target.value);
                      setSection("");
                    }}
                  >
                    <option value="">Dhammaan…</option>
                    {classes.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Select>
                </div>
                {(audience === "SECTION" || audience === "OUTSTANDING") && (
                  <div>
                    <Label>Xarun</Label>
                    <Select
                      className="mt-1.5"
                      value={section}
                      onChange={(e) => setSection(e.target.value)}
                    >
                      <option value="">Dhammaan</option>
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

            <div className="pt-2">
              <div className="mb-2 flex items-center justify-between">
                <Label>2. Eeg &amp; Reeb Cid (haddii loo baahdo)</Label>
                <Button className="h-8 px-3 text-xs" variant="outline" onClick={() => void loadPreview()}>
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Cusboonaysii
                </Button>
              </div>
              <RecipientPreview
                recipients={recipients}
                selected={selected}
                onToggle={toggleRecipient}
                onToggleAll={toggleAllRecipients}
                loading={previewLoading}
              />
            </div>

            <h2 className="pt-2 font-semibold">3. Qor Fariinta</h2>
            <div>
              <Label>Nooca</Label>
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
              <Label>Template (ikhtiyaari)</Label>
              <Select
                className="mt-1.5"
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
              >
                <option value="">Midna — qor fariin gaar ah</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Fariinta</Label>
              <Textarea
                className="mt-1.5 min-h-[120px]"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Isticmaal {{Magaca Waalidka}}, {{Magaca Ardayga}}, {{Magaca Dugsiga}}, {{Lacagta Hadhaysa}}…"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Variables: {"{{Magaca Waalidka}}"}, {"{{Magaca Ardayga}}"}, {"{{Fasalka}}"},{" "}
                {"{{Lacagta Hadhaysa}}"}, {"{{Magaca Dugsiga}}"}, {"{{Sanad Dugsiyeedka}}"}
              </p>
            </div>
            <div>
              <Label>Jadwal (ikhtiyaari)</Label>
              <Input
                type="datetime-local"
                className="mt-1.5"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                onClick={() => void handleSend()}
                disabled={sending || !body.trim() || !canSend || selected.size === 0}
              >
                <Send className="mr-2 h-4 w-4" />
                {sending ? "Dirayaa…" : `Dir SMS (${selected.size})`}
              </Button>
              {audience === "OUTSTANDING" && (
                <Button
                  variant="outline"
                  onClick={() => void handleFeeReminders()}
                  disabled={sending}
                >
                  Dir Xasuusin Lacag oo Toos ah
                </Button>
              )}
            </div>
          </div>

          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <h2 className="font-semibold">Packages Firfircoon</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {(balance?.purchases ?? [])
                .filter((p) => p.status === "ACTIVE")
                .map((p) => (
                  <li key={p.id} className="rounded-lg border px-3 py-2">
                    <p className="font-medium">{p.package.name}</p>
                    <p className="text-muted-foreground">
                      {p.creditsRemaining} / {p.creditsTotal} credits hadhay
                    </p>
                  </li>
                ))}
              {(balance?.purchases ?? []).filter((p) => p.status === "ACTIVE")
                .length === 0 && (
                <p className="text-muted-foreground">
                  Package firfircoon lama helin. Weydii maamulaha nidaamka.
                </p>
              )}
            </ul>
            <h2 className="mt-6 font-semibold">Xaaladda Diridda</h2>
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
              <Label>Lambarada Taleefanka (mid kasta xariiq)</Label>
              <Textarea
                className="mt-1.5 min-h-[140px] font-mono text-sm"
                value={bulkNumbers}
                onChange={(e) => setBulkNumbers(e.target.value)}
                placeholder={"25261xxxxxxx, Magaca (ikhtiyaari)\n25263xxxxxxx\n25265xxxxxxx"}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Ku dar lambar kasta xariiq cusub ama u kala saar comma (,). Waxaad ku dari
                kartaa magaca ka dib comma. {bulkRecipients.length} lambar ayaa la aqoonsaday.
              </p>
            </div>
            <div>
              <Label>Nooca</Label>
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
              <Label>Fariinta (hal fariin ayaa loo diri doonaa dhammaan)</Label>
              <Textarea
                className="mt-1.5 min-h-[120px]"
                value={bulkBody}
                onChange={(e) => setBulkBody(e.target.value)}
                placeholder="Qor fariinta halkan…"
              />
            </div>
            <div>
              <Label>Jadwal (ikhtiyaari)</Label>
              <Input
                type="datetime-local"
                className="mt-1.5"
                value={bulkScheduledAt}
                onChange={(e) => setBulkScheduledAt(e.target.value)}
              />
            </div>
            <Button
              onClick={() => void handleBulkSend()}
              disabled={sending || !bulkBody.trim() || bulkRecipients.length === 0 || !canSend}
            >
              <Send className="mr-2 h-4 w-4" />
              {sending ? "Dirayaa…" : `Dir SMS (${bulkRecipients.length} qof)`}
            </Button>
          </div>

          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <h2 className="font-semibold">Sida loo isticmaalo</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Qeybtan waxaad ku diri kartaa fariin gaar ah lambarro badan oo aadan ka helin
              liiska ardayda ama waalidiinta — sida broadcast-ka WhatsApp. Geli lambarada,
              qor hal fariin, dabadeedna dhammaan waxay heli doonaan isla fariinta hal mar.
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
                <th className="px-4 py-3">Qofka</th>
                <th className="px-4 py-3">Nooca</th>
                <th className="px-4 py-3">Xaaladda</th>
                <th className="px-4 py-3">Credits</th>
                <th className="px-4 py-3">Waqtiga</th>
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
                    Weli wax SMS ah lama dirin.
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
            <Label>Magaca Diraha (waxay ku muuqan doontaa qaadaha)</Label>
            <Input
              className="mt-1.5"
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
              maxLength={20}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Ugu badnaan 20 xaraf. Wuxuu iska caadi ahaan noqdaa magaca dugsiga.
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={smsEnabled}
              onChange={(e) => setSmsEnabled(e.target.checked)}
            />
            Dugsigan ka fur SMS-ka
          </label>
          <Button onClick={() => void saveSettings()}>Kaydi Dejinta</Button>
        </div>
      )}
    </div>
  );
}
