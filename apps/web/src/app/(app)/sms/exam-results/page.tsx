"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  MessageSquare,
  RefreshCw,
  Send,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/provider";
import { toast } from "@/lib/toast";
import { useHydrated } from "@/lib/use-hydrated";
import { apiListExams, type ApiExam } from "@/lib/examinations/api";
import { apiSmsTemplates, type SmsTemplate } from "@/lib/sms/api";
import {
  examResultHistory,
  previewExamResults,
  retryExamResults,
  sendExamResults,
  smsError,
  type ExamResultHistory,
  type ExamResultPreview,
  type SkipReason,
} from "@/lib/sms/exam-results";

const SKIP_TONE: Record<SkipReason, string> = {
  NO_MARKS: "bg-slate-500/15 text-slate-600 dark:text-slate-400",
  NO_PHONE: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
  ALREADY_SENT: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
};

/**
 * Exam results to parents.
 *
 * Pick the exam, pick who, pick the words, look at what will go out, send. The
 * fourth step is the one that matters: an SMS to four hundred parents cannot be
 * recalled, and the only way to know a template is right is to read the message
 * a real parent will get, with a real child's marks in it. So the preview is
 * not a summary of the send — it is the send, built and shown before it goes.
 */
export default function ExamResultSmsPage() {
  const t = useT();
  const mounted = useHydrated();

  const [exams, setExams] = useState<ApiExam[]>([]);
  const [templates, setTemplates] = useState<SmsTemplate[]>([]);
  const [examId, setExamId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [custom, setCustom] = useState("");
  const [useCustom, setUseCustom] = useState(false);

  const [preview, setPreview] = useState<ExamResultPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<ExamResultHistory | null>(null);

  useEffect(() => {
    if (!mounted) return;
    void apiListExams()
      .then((rows) =>
        // Only what may be sent. An exam still being marked is not a result,
        // and offering it here would be offering something the server refuses.
        setExams(rows.filter((e) => e.status === "PUBLISHED")),
      )
      .catch(() => setExams([]));
    void apiSmsTemplates()
      .then((rows) => setTemplates(rows.filter((x) => x.isActive)))
      .catch(() => setTemplates([]));
  }, [mounted]);

  const examResultTemplates = useMemo(
    () => templates.filter((x) => x.category === "EXAM_RESULT"),
    [templates],
  );

  async function load() {
    if (!examId) return;
    setLoading(true);
    setError(null);
    setHistory(null);
    try {
      const res = await previewExamResults({
        examId,
        templateId: useCustom ? undefined : templateId || undefined,
        body: useCustom ? custom : undefined,
      });
      setPreview(res);
      setExcluded(new Set());
      const h = await examResultHistory(examId).catch(() => null);
      setHistory(h);
    } catch (e) {
      setPreview(null);
      setError(smsError(e, "Could not build the preview."));
    } finally {
      setLoading(false);
    }
  }

  const sendable = useMemo(
    () => (preview?.rows ?? []).filter((r) => r.skip === null),
    [preview],
  );
  const chosen = useMemo(
    () => sendable.filter((r) => !excluded.has(r.studentId)),
    [sendable, excluded],
  );
  const credits = chosen.reduce((n, r) => n + r.segments, 0);
  const shortfall = Math.max(0, credits - (preview?.summary.balance ?? 0));

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = preview?.rows ?? [];
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.studentName.toLowerCase().includes(q) ||
        r.studentCode.toLowerCase().includes(q) ||
        r.parentName.toLowerCase().includes(q),
    );
  }, [preview, search]);

  async function send() {
    if (!preview) return;
    setSending(true);
    try {
      const res = await sendExamResults({
        examId: preview.exam.id,
        templateId: useCustom ? undefined : templateId || undefined,
        body: useCustom ? custom : undefined,
        studentIds: chosen.map((r) => r.studentId),
      });
      toast(
        t("smsExamResults.sent")
          .replace("{sent}", String(res.sent ?? chosen.length))
          .replace("{credits}", String(res.creditsUsed ?? credits)),
        "success",
      );
      setConfirmOpen(false);
      await load();
    } catch (e) {
      toast(smsError(e, "Send failed."), "error");
    } finally {
      setSending(false);
    }
  }

  async function retry() {
    if (!preview) return;
    setSending(true);
    try {
      const res = await retryExamResults({
        examId: preview.exam.id,
        templateId: useCustom ? undefined : templateId || undefined,
        body: useCustom ? custom : undefined,
      });
      toast(
        t("smsExamResults.retried").replace("{n}", String(res.sent ?? 0)),
        "success",
      );
      await load();
    } catch (e) {
      toast(smsError(e, "Retry failed."), "error");
    } finally {
      setSending(false);
    }
  }

  if (!mounted) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        {t("common.loading")}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        href="/sms"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> {t("smsExamResults.backToSms")}
      </Link>

      <div>
        <h1 className="text-2xl font-bold">{t("smsExamResults.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("smsExamResults.description")}
        </p>
      </div>

      {/* ── Steps 1-3: which exam, which words ─────────────────────────── */}
      <div className="rounded-2xl border bg-card p-5 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              {t("smsExamResults.exam")} *
            </label>
            <Select value={examId} onChange={(e) => { setExamId(e.target.value); setPreview(null); }}>
              <option value="">{t("smsExamResults.selectExam")}</option>
              {exams.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.class.name} · {e.name} · {e.term}
                </option>
              ))}
            </Select>
            {exams.length === 0 && (
              <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400">
                {t("smsExamResults.noPublished")}
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              {t("smsExamResults.template")}
            </label>
            <Select
              value={useCustom ? "__custom" : templateId}
              onChange={(e) => {
                const v = e.target.value;
                setUseCustom(v === "__custom");
                setTemplateId(v === "__custom" ? "" : v);
                setPreview(null);
              }}
            >
              <option value="">{t("smsExamResults.defaultTemplate")}</option>
              {examResultTemplates.map((x) => (
                <option key={x.id} value={x.id}>{x.name}</option>
              ))}
              <option value="__custom">{t("smsExamResults.writeItHere")}</option>
            </Select>
          </div>
        </div>

        {useCustom && (
          <div className="mt-3">
            <textarea
              value={custom}
              onChange={(e) => { setCustom(e.target.value); setPreview(null); }}
              rows={7}
              placeholder={t("smsExamResults.customPlaceholder")}
              className="w-full rounded-lg border bg-background p-3 font-mono text-sm outline-none focus:border-primary"
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              {t("smsExamResults.variablesHelp")}
            </p>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button onClick={() => void load()} disabled={!examId || loading}>
            {loading ? (
              <Loader2 className="me-2 h-4 w-4 animate-spin" />
            ) : (
              <MessageSquare className="me-2 h-4 w-4" />
            )}
            {t("smsExamResults.buildPreview")}
          </Button>
          <Button variant="outline" asChild>
            <Link href="/sms/templates">{t("smsExamResults.manageTemplates")}</Link>
          </Button>
        </div>

        {error && (
          <p className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-400">
            {error}
          </p>
        )}
      </div>

      {preview && (
        <>
          {/* ── Step 4: what this will cost, before it goes ────────────── */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Figure
              label={t("smsExamResults.recipients")}
              value={String(chosen.length)}
              note={`${t("smsExamResults.onSheet")}: ${preview.summary.onSheet}`}
              icon={Users}
            />
            <Figure
              label={t("smsExamResults.creditsNeeded")}
              value={String(credits)}
              note={`${t("smsExamResults.balance")}: ${preview.summary.balance}`}
              icon={Send}
              danger={shortfall > 0}
            />
            <Figure
              label={t("smsExamResults.longestMessage")}
              value={`${preview.summary.maxCharacters}`}
              note={t("smsExamResults.segmentsEach").replace(
                "{n}",
                String(preview.summary.maxSegments),
              )}
              icon={MessageSquare}
            />
            <Figure
              label={t("smsExamResults.notSending")}
              value={String(
                preview.summary.noPhone +
                  preview.summary.noMarks +
                  preview.summary.alreadySent,
              )}
              note={[
                preview.summary.noPhone > 0 &&
                  `${preview.summary.noPhone} ${t("smsExamResults.noPhoneShort")}`,
                preview.summary.noMarks > 0 &&
                  `${preview.summary.noMarks} ${t("smsExamResults.noMarksShort")}`,
                preview.summary.alreadySent > 0 &&
                  `${preview.summary.alreadySent} ${t("smsExamResults.sentShort")}`,
              ]
                .filter(Boolean)
                .join(" · ") || "—"}
              icon={AlertTriangle}
            />
          </div>

          {preview.summary.maxSegments > 1 && (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
              <AlertTriangle className="me-2 inline h-4 w-4" />
              {t("smsExamResults.twoSegments").replace(
                "{n}",
                String(preview.summary.maxSegments),
              )}
            </p>
          )}

          {shortfall > 0 && (
            <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-400">
              {t("smsExamResults.shortfall")
                .replace("{need}", String(credits))
                .replace("{have}", String(preview.summary.balance))
                .replace("{short}", String(shortfall))}
            </p>
          )}

          {history && history.failed > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm">
              <span className="text-rose-700 dark:text-rose-400">
                {t("smsExamResults.someFailed").replace(
                  "{n}",
                  String(history.failed),
                )}
              </span>
              <Button variant="outline" disabled={sending} onClick={() => void retry()}>
                <RefreshCw className="me-2 h-4 w-4" />
                {t("smsExamResults.retryFailed")}
              </Button>
            </div>
          )}

          {/* ── The messages themselves ────────────────────────────────── */}
          <div className="rounded-2xl border bg-card shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
              <p className="text-sm font-medium">
                {preview.exam.className} · {preview.exam.name} · {preview.exam.term}
                <span className="ms-2 text-xs font-normal text-muted-foreground">
                  {preview.templateName}
                </span>
              </p>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("smsExamResults.searchStudent")}
                className="h-9 max-w-xs"
              />
            </div>

            <div className="max-h-[560px] divide-y overflow-auto scrollbar-slim">
              {shown.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                  {t("smsExamResults.nobody")}
                </p>
              ) : (
                shown.map((r) => {
                  const off = excluded.has(r.studentId);
                  return (
                    <div
                      key={r.studentId}
                      className={cn(
                        "flex gap-3 px-4 py-3",
                        r.skip && "bg-secondary/40",
                        off && !r.skip && "opacity-50",
                      )}
                    >
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 shrink-0 accent-primary"
                        disabled={r.skip !== null}
                        checked={r.skip === null && !off}
                        onChange={(e) =>
                          setExcluded((prev) => {
                            const next = new Set(prev);
                            if (e.target.checked) next.delete(r.studentId);
                            else next.add(r.studentId);
                            return next;
                          })
                        }
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                          <span className="font-medium">{r.studentName}</span>
                          <span className="font-mono text-xs text-muted-foreground">
                            {r.studentCode}
                          </span>
                          {r.position !== null && (
                            <span className="rounded bg-secondary px-1.5 py-0.5 text-xs">
                              #{r.position}
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {r.average}%
                          </span>
                          {r.skip && (
                            <span
                              className={cn(
                                "rounded px-1.5 py-0.5 text-xs font-medium",
                                SKIP_TONE[r.skip],
                              )}
                            >
                              {t(`smsExamResults.skip${r.skip}` as never)}
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {r.parentName || t("smsExamResults.noParentName")}
                          {r.phone ? ` · ${r.phone}` : ""}
                          {" · "}
                          {r.characters} {t("smsExamResults.chars")} ·{" "}
                          {r.segments} {t("smsExamResults.segments")}
                        </p>
                        <pre className="mt-1.5 whitespace-pre-wrap rounded-lg bg-secondary/60 px-3 py-2 font-sans text-xs leading-relaxed">
                          {r.body}
                        </pre>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="h-8"
                  onClick={() => setExcluded(new Set())}
                >
                  {t("smsExamResults.selectAll")}
                </Button>
                <Button
                  variant="outline"
                  className="h-8"
                  onClick={() =>
                    setExcluded(new Set(sendable.map((r) => r.studentId)))
                  }
                >
                  {t("smsExamResults.selectNone")}
                </Button>
              </div>
              <Button
                disabled={chosen.length === 0 || shortfall > 0}
                onClick={() => setConfirmOpen(true)}
              >
                <Send className="me-2 h-4 w-4" />
                {t("smsExamResults.sendResults").replace(
                  "{n}",
                  String(chosen.length),
                )}
              </Button>
            </div>
          </div>
        </>
      )}

      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={t("smsExamResults.confirmTitle")}
        className="max-w-md"
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={sending}>
              {t("common.cancel")}
            </Button>
            <Button onClick={() => void send()} disabled={sending}>
              {sending ? (
                <Loader2 className="me-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="me-2 h-4 w-4" />
              )}
              {t("smsExamResults.confirmSend")}
            </Button>
          </>
        }
      >
        <div className="space-y-2 text-sm">
          <p>
            {t("smsExamResults.confirmBody")
              .replace("{n}", String(chosen.length))
              .replace("{credits}", String(credits))
              .replace("{exam}", preview?.exam.name ?? "")}
          </p>
          <p className="text-xs text-muted-foreground">
            {t("smsExamResults.confirmNote")}
          </p>
        </div>
      </Dialog>
    </div>
  );
}

function Figure({
  label,
  value,
  note,
  icon: Icon,
  danger,
}: {
  label: string;
  value: string;
  note: string;
  icon: typeof Users;
  danger?: boolean;
}) {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
        <Icon className="h-4 w-4" />
      </span>
      <p
        className={cn(
          "mt-3 text-2xl font-bold leading-none tabular-nums",
          danger && "text-rose-600 dark:text-rose-400",
        )}
      >
        {value}
      </p>
      <p className="mt-1.5 truncate text-sm font-medium">{label}</p>
      <p className="mt-0.5 truncate text-xs text-muted-foreground">{note}</p>
    </div>
  );
}
