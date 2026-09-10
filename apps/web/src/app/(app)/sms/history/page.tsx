"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Printer, RotateCcw, Search } from "lucide-react";
import { csvRow } from "@ekulmis/shared";
import { useT, type TranslationKey } from "@/lib/i18n/provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useHydrated } from "@/lib/use-hydrated";
import { apiSmsMessagePage, type SmsMessage } from "@/lib/sms/api";
import { escapeHtml } from "@/lib/print/header";
import {
  accentColour,
  documentFooterHtml,
  letterheadHtml,
  LETTERHEAD_CSS,
  watermarkHtml,
} from "@/lib/print/letterhead";
import { getStoredPaper, paperCss } from "@/lib/print/paper";

/**
 * Every message this school has sent.
 *
 * The send log has been recorded since SMS was built and the only way to read
 * it was a tab inside the send screen, capped at the newest hundred with no
 * way to tell whether that was the whole of it. A school asking "what did we
 * send that parent in August" had no way to answer.
 *
 * The count and the credits under the table describe the filtered view, not
 * the school — otherwise a filter would narrow the rows and leave a total
 * describing something else, which is the fault the fee module spent longest
 * correcting.
 */

const PAGE = 50;

const STATUSES = [
  "PENDING",
  "SENT",
  "DELIVERED",
  "FAILED",
  "REJECTED",
] as const;

function statusTone(status: string): string {
  switch (status) {
    case "DELIVERED":
    case "SENT":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300";
    case "FAILED":
    case "REJECTED":
      return "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300";
    default:
      return "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300";
  }
}

export default function SmsHistoryPage() {
  const t = useT();
  const mounted = useHydrated();

  const [rows, setRows] = useState<SmsMessage[]>([]);
  const [total, setTotal] = useState(0);
  const [credits, setCredits] = useState(0);
  const [skip, setSkip] = useState(0);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");
  // Typing must not requery on every keystroke; the query runs on what was
  // actually asked for.
  const [applied, setApplied] = useState("");

  const load = useCallback(async () => {
    if (!mounted) return;
    setLoading(true);
    setFailed(false);
    try {
      const page = await apiSmsMessagePage({
        status: status || undefined,
        q: applied || undefined,
        from: from || undefined,
        to: to || undefined,
        take: PAGE,
        skip,
      });
      setRows(page.items);
      setTotal(page.total);
      setCredits(page.credits);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [mounted, status, applied, from, to, skip]);

  useEffect(() => {
    void load();
  }, [load]);

  // Any change of filter starts again at the first page: staying on page 4 of
  // a list that no longer has one is how a filtered screen looks empty.
  const setFilter = (fn: () => void) => {
    fn();
    setSkip(0);
  };

  const reset = () => {
    setStatus("");
    setFrom("");
    setTo("");
    setQ("");
    setApplied("");
    setSkip(0);
  };

  const filterNote = useMemo(
    () =>
      [
        status || t("smsHistory.allStatuses"),
        from || to ? `${from || "…"} → ${to || "…"}` : "",
        applied,
      ]
        .filter(Boolean)
        .join(" · "),
    [status, from, to, applied, t],
  );

  /** Exports the filtered view, never the whole log — the filter is the question. */
  function exportCsv() {
    const lines = [
      csvRow([`${t("smsHistory.title")} — ${filterNote}`]),
      "",
      csvRow([
        t("smsHistory.when"),
        t("smsHistory.recipient"),
        t("smsHistory.phone"),
        t("smsHistory.message"),
        t("smsHistory.credits"),
        t("smsHistory.status"),
      ]),
      ...rows.map((m) =>
        csvRow([
          new Date(m.createdAt).toISOString().replace("T", " ").slice(0, 19),
          m.recipientName ?? "",
          m.recipientPhone,
          m.body,
          m.creditsUsed,
          m.status,
        ]),
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sms-history-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function print() {
    const w = window.open("", "_blank", "width=900,height=1000");
    if (!w) return;
    const paper = getStoredPaper();
    const body = rows
      .map(
        (m, i) => `<tr>
          <td class="n">${i + 1}</td>
          <td>${new Date(m.createdAt).toISOString().slice(0, 16).replace("T", " ")}</td>
          <td>${escapeHtml(m.recipientName || m.recipientPhone)}</td>
          <td>${escapeHtml(m.body)}</td>
          <td class="num">${m.creditsUsed}</td>
          <td>${escapeHtml(m.status)}</td>
        </tr>`,
      )
      .join("");
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"/>
<title>${escapeHtml(t("smsHistory.title"))}</title><style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#0f172a}
${paperCss(paper)}
${LETTERHEAD_CSS}
table{width:100%;border-collapse:collapse;margin-top:12px}
th{background:#eff6ff;color:#1e3a8a;font-size:10px;font-weight:700;text-transform:uppercase;
  letter-spacing:.05em;padding:8px 10px;text-align:start;border-bottom:1px solid #dbeafe}
td{padding:7px 10px;font-size:11.5px;border-bottom:1px solid #f1f5f9}
.n{width:30px;color:#94a3b8}
.num{text-align:end;font-variant-numeric:tabular-nums}
.sum{margin-top:12px;font-size:11px;color:#475569}
@media print{ .doc-watermark{position:absolute} }
</style></head><body>
<div class="doc" style="--ek-accent:${accentColour()}">
${watermarkHtml()}
${letterheadHtml({ title: t("smsHistory.title"), subtitle: filterNote })}
<table><thead><tr>
<th class="n">#</th><th>${escapeHtml(t("smsHistory.when"))}</th>
<th>${escapeHtml(t("smsHistory.recipient"))}</th><th>${escapeHtml(t("smsHistory.message"))}</th>
<th class="num">${escapeHtml(t("smsHistory.credits"))}</th><th>${escapeHtml(t("smsHistory.status"))}</th>
</tr></thead><tbody>${body}</tbody></table>
<div class="sum">${rows.length} / ${total} · ${credits} ${escapeHtml(t("smsHistory.credits"))}</div>
${documentFooterHtml()}
</div><script>window.onload=function(){window.print()}</script></body></html>`);
    w.document.close();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("smsHistory.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("smsHistory.intro")}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={print} disabled={rows.length === 0}>
            <Printer className="me-2 h-4 w-4" />
            {t("smsHistory.print")}
          </Button>
          <Button variant="outline" onClick={exportCsv} disabled={rows.length === 0}>
            <Download className="me-2 h-4 w-4" />
            {t("smsHistory.exportCsv")}
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border bg-card shadow-sm">
        <div className="flex flex-wrap items-end gap-3 border-b bg-secondary/20 px-5 py-4">
          <div className="min-w-[150px]">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              {t("smsHistory.status")}
            </label>
            <Select
              value={status}
              onChange={(e) => setFilter(() => setStatus(e.target.value))}
            >
              <option value="">{t("smsHistory.allStatuses")}</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              {t("smsHistory.from")}
            </label>
            <Input
              type="date"
              value={from}
              onChange={(e) => setFilter(() => setFrom(e.target.value))}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              {t("smsHistory.to")}
            </label>
            <Input
              type="date"
              value={to}
              onChange={(e) => setFilter(() => setTo(e.target.value))}
            />
          </div>
          <div className="min-w-[190px] flex-1">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              {t("smsHistory.search")}
            </label>
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") setFilter(() => setApplied(q));
              }}
              placeholder={t("smsHistory.searchPlaceholder")}
            />
          </div>
          <Button onClick={() => setFilter(() => setApplied(q))}>
            <Search className="me-2 h-4 w-4" />
            {t("smsHistory.searchButton")}
          </Button>
          <Button variant="outline" onClick={reset}>
            <RotateCcw className="me-2 h-4 w-4" />
            {t("smsHistory.reset")}
          </Button>
        </div>

        {failed ? (
          <p className="p-8 text-center text-sm text-muted-foreground">
            {t("smsHistory.couldNotLoad")}
          </p>
        ) : loading ? (
          <div className="space-y-2 p-5">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-9 animate-pulse rounded bg-secondary/60" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">
            {t("smsHistory.nothingMatches")}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="p-3 text-start">{t("smsHistory.when")}</th>
                  <th className="p-3 text-start">{t("smsHistory.recipient")}</th>
                  <th className="p-3 text-start">{t("smsHistory.message")}</th>
                  <th className="p-3 text-end">{t("smsHistory.credits")}</th>
                  <th className="p-3 text-start">{t("smsHistory.status")}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((m) => (
                  <tr key={m.id} className="align-top">
                    <td className="whitespace-nowrap p-3 text-muted-foreground">
                      {new Date(m.createdAt).toLocaleString()}
                    </td>
                    <td className="p-3">
                      <span className="font-medium">
                        {m.recipientName || "—"}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {m.recipientPhone}
                      </span>
                    </td>
                    <td className="max-w-md p-3 text-muted-foreground">
                      {m.body}
                    </td>
                    <td className="p-3 text-end tabular-nums">{m.creditsUsed}</td>
                    <td className="p-3">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusTone(m.status)}`}
                      >
                        {m.status}
                      </span>
                      {m.error && (
                        <span className="mt-1 block max-w-[220px] text-[11px] text-rose-600">
                          {m.error}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3 text-sm">
          <span className="text-muted-foreground">
            {total === 0
              ? "—"
              : `${skip + 1}–${Math.min(skip + PAGE, total)} / ${total} · ${credits.toLocaleString()} ${t("smsHistory.credits")}`}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={skip === 0}
              onClick={() => setSkip(Math.max(0, skip - PAGE))}
            >
              {t("smsHistory.previous")}
            </Button>
            <Button
              variant="outline"
              disabled={skip + PAGE >= total}
              onClick={() => setSkip(skip + PAGE)}
            >
              {t("smsHistory.next")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
