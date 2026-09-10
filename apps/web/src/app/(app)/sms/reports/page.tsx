"use client";

import { useMemo, useState } from "react";
import { Printer } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useT, type TranslationKey } from "@/lib/i18n/provider";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useHydrated } from "@/lib/use-hydrated";
import { useCachedResource } from "@/lib/cached-resource";
import { escapeHtml } from "@/lib/print/header";
import {
  accentColour,
  documentFooterHtml,
  letterheadHtml,
  LETTERHEAD_CSS,
  watermarkHtml,
} from "@/lib/print/letterhead";
import { getStoredPaper, paperCss } from "@/lib/print/paper";
import { formatMoney } from "@/lib/settings/currency";

/**
 * What the school's SMS has cost and where it went.
 *
 * Three questions a school actually asks, each answered from a record that
 * already exists: how much have we used, who have we been messaging, and what
 * have we paid. Nothing here is estimated — a communication budget reported
 * from anything but the send log is a budget that will surprise somebody.
 */

interface Usage {
  today: number;
  thisMonth: number;
  allTime: number;
  failed: number;
  pending: number;
  daily: { date: string; credits: number }[];
}

interface Message {
  recipientType: string | null;
  status: string;
  creditsUsed: number;
  createdAt: string;
}

interface Transaction {
  id: string;
  type: string;
  credits: number;
  amount?: number | null;
  createdAt: string;
  purchase?: {
    package?: { name: string; credits: number; price?: number | null } | null;
  } | null;
}

const RANGES: { id: string; days: number; labelKey: TranslationKey }[] = [
  { id: "7", days: 7, labelKey: "smsReports.last7" },
  { id: "30", days: 30, labelKey: "smsReports.last30" },
  { id: "90", days: 90, labelKey: "smsReports.last90" },
];

const axisStyle = { fontSize: 11, fill: "hsl(var(--muted-foreground))" };

const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid hsl(var(--border))",
  background: "hsl(var(--card))",
  color: "hsl(var(--card-foreground))",
  fontSize: 12,
};

export default function SmsReportsPage() {
  const t = useT();
  const mounted = useHydrated();
  const [range, setRange] = useState("30");

  const days = RANGES.find((r) => r.id === range)?.days ?? 30;

  const { data: usage } = useCachedResource<Usage>(
    mounted ? `/sms/usage?days=${days}` : null,
  );
  // The whole window in one call, so the recipient breakdown counts the same
  // messages the usage chart does rather than a different sample of them.
  const { data: page } = useCachedResource<{ items: Message[]; total: number }>(
    mounted ? `/sms/messages?take=500` : null,
  );
  const { data: transactions } = useCachedResource<Transaction[]>(
    mounted ? "/sms/transactions" : null,
  );

  const chart = useMemo(
    () =>
      (usage?.daily ?? []).map((d) => ({
        label: d.date.slice(5),
        credits: d.credits,
      })),
    [usage],
  );

  /** Who the school has been messaging, by credits rather than by message. */
  const byRecipient = useMemo(() => {
    const rows = page?.items ?? [];
    const map = new Map<string, { credits: number; count: number }>();
    for (const m of rows) {
      if (m.status === "FAILED") continue;
      const key = m.recipientType || "OTHER";
      const cur = map.get(key) ?? { credits: 0, count: 0 };
      cur.credits += m.creditsUsed;
      cur.count += 1;
      map.set(key, cur);
    }
    return [...map.entries()]
      .map(([type, v]) => ({ type, ...v }))
      .sort((a, b) => b.credits - a.credits);
  }, [page]);

  const delivery = useMemo(() => {
    const rows = page?.items ?? [];
    const map = new Map<string, number>();
    for (const m of rows) map.set(m.status, (map.get(m.status) ?? 0) + 1);
    return [...map.entries()]
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count);
  }, [page]);

  const purchases = useMemo(
    () => (transactions ?? []).filter((x) => x.credits > 0),
    [transactions],
  );
  const spent = purchases.reduce(
    (n, p) => n + (p.amount ?? p.purchase?.package?.price ?? 0),
    0,
  );

  function print() {
    const w = window.open("", "_blank", "width=900,height=1000");
    if (!w) return;
    const paper = getStoredPaper();
    const rows = (arr: string[][]) =>
      arr.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("");
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"/>
<title>${escapeHtml(t("smsReports.title"))}</title><style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#0f172a}
${paperCss(paper)}
${LETTERHEAD_CSS}
h3{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#1e3a8a;margin:16px 0 6px}
table{width:100%;border-collapse:collapse}
th{background:#eff6ff;color:#1e3a8a;font-size:10px;font-weight:700;text-transform:uppercase;
  letter-spacing:.05em;padding:7px 10px;text-align:start;border-bottom:1px solid #dbeafe}
td{padding:6px 10px;font-size:11.5px;border-bottom:1px solid #f1f5f9}
@media print{ .doc-watermark{position:absolute} }
</style></head><body>
<div class="doc" style="--ek-accent:${accentColour()}">
${watermarkHtml()}
${letterheadHtml({
  title: t("smsReports.title"),
  subtitle: `${t(RANGES.find((r) => r.id === range)?.labelKey ?? "smsReports.last30")}`,
})}
<h3>${escapeHtml(t("smsReports.usage"))}</h3>
<table><tbody>${rows([
  [escapeHtml(t("smsReports.today")), String(usage?.today ?? 0)],
  [escapeHtml(t("smsReports.thisMonth")), String(usage?.thisMonth ?? 0)],
  [escapeHtml(t("smsReports.allTime")), String(usage?.allTime ?? 0)],
  [escapeHtml(t("smsReports.failed")), String(usage?.failed ?? 0)],
])}</tbody></table>
<h3>${escapeHtml(t("smsReports.byRecipient"))}</h3>
<table><thead><tr><th>${escapeHtml(t("smsReports.recipientType"))}</th>
<th>${escapeHtml(t("smsReports.messages"))}</th><th>${escapeHtml(t("smsReports.credits"))}</th></tr></thead>
<tbody>${rows(
  byRecipient.map((r) => [escapeHtml(r.type), String(r.count), String(r.credits)]),
)}</tbody></table>
<h3>${escapeHtml(t("smsReports.purchases"))}</h3>
<table><thead><tr><th>${escapeHtml(t("smsReports.date"))}</th>
<th>${escapeHtml(t("smsReports.package"))}</th><th>${escapeHtml(t("smsReports.credits"))}</th></tr></thead>
<tbody>${rows(
  purchases.map((p) => [
    new Date(p.createdAt).toISOString().slice(0, 10),
    escapeHtml(p.purchase?.package?.name ?? p.type),
    String(p.credits),
  ]),
)}</tbody></table>
${documentFooterHtml()}
</div><script>window.onload=function(){window.print()}</script></body></html>`);
    w.document.close();
  }

  const summary: { label: TranslationKey; value: number | null }[] = [
    { label: "smsReports.today", value: usage?.today ?? null },
    { label: "smsReports.thisMonth", value: usage?.thisMonth ?? null },
    { label: "smsReports.allTime", value: usage?.allTime ?? null },
    { label: "smsReports.failed", value: usage?.failed ?? null },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("smsReports.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("smsReports.intro")}
          </p>
        </div>
        <div className="flex items-end gap-2">
          <Select value={range} onChange={(e) => setRange(e.target.value)}>
            {RANGES.map((r) => (
              <option key={r.id} value={r.id}>
                {t(r.labelKey)}
              </option>
            ))}
          </Select>
          <Button variant="outline" onClick={print}>
            <Printer className="me-2 h-4 w-4" />
            {t("smsReports.print")}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {summary.map((c) => (
          <div key={c.label} className="rounded-xl border bg-card p-4 shadow-sm">
            <p className="text-xs font-medium text-muted-foreground">
              {t(c.label)}
            </p>
            <p className="mt-2 text-2xl font-bold tabular-nums">
              {c.value === null ? "—" : c.value.toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      <section className="rounded-2xl border bg-card p-5 shadow-sm">
        <h2 className="text-sm font-semibold">{t("smsReports.usage")}</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {t("smsReports.usageNote")}
        </p>
        <div className="mt-3">
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={chart} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="hsl(var(--border))"
              />
              <XAxis
                dataKey="label"
                tick={axisStyle}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
                minTickGap={18}
              />
              <YAxis
                tick={axisStyle}
                tickLine={false}
                axisLine={false}
                width={44}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
                formatter={(v: number) => [
                  v.toLocaleString(),
                  t("smsReports.credits"),
                ]}
              />
              <Bar dataKey="credits" fill="#2563eb" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border bg-card shadow-sm">
          <div className="border-b p-5">
            <h2 className="text-sm font-semibold">
              {t("smsReports.byRecipient")}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("smsReports.byRecipientNote")}
            </p>
          </div>
          {byRecipient.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              {t("smsReports.nothingYet")}
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-secondary/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="p-3 text-start">
                    {t("smsReports.recipientType")}
                  </th>
                  <th className="p-3 text-end">{t("smsReports.messages")}</th>
                  <th className="p-3 text-end">{t("smsReports.credits")}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {byRecipient.map((r) => (
                  <tr key={r.type}>
                    <td className="p-3 font-medium">{r.type}</td>
                    <td className="p-3 text-end tabular-nums">{r.count}</td>
                    <td className="p-3 text-end tabular-nums">{r.credits}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="rounded-2xl border bg-card shadow-sm">
          <div className="border-b p-5">
            <h2 className="text-sm font-semibold">{t("smsReports.delivery")}</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("smsReports.deliveryNote")}
            </p>
          </div>
          {delivery.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              {t("smsReports.nothingYet")}
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-secondary/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="p-3 text-start">{t("smsReports.status")}</th>
                  <th className="p-3 text-end">{t("smsReports.messages")}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {delivery.map((d) => (
                  <tr key={d.status}>
                    <td className="p-3 font-medium">{d.status}</td>
                    <td className="p-3 text-end tabular-nums">{d.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      <section className="rounded-2xl border bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b p-5">
          <div>
            <h2 className="text-sm font-semibold">{t("smsReports.purchases")}</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("smsReports.purchasesNote")}
            </p>
          </div>
          {spent > 0 && (
            <span className="text-sm font-semibold">{formatMoney(spent)}</span>
          )}
        </div>
        {purchases.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            {t("smsReports.noPurchases")}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="p-3 text-start">{t("smsReports.date")}</th>
                  <th className="p-3 text-start">{t("smsReports.package")}</th>
                  <th className="p-3 text-end">{t("smsReports.credits")}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {purchases.map((p) => (
                  <tr key={p.id}>
                    <td className="whitespace-nowrap p-3 text-muted-foreground">
                      {new Date(p.createdAt).toLocaleDateString()}
                    </td>
                    <td className="p-3 font-medium">
                      {p.purchase?.package?.name ?? p.type}
                    </td>
                    <td className="p-3 text-end tabular-nums">{p.credits}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
