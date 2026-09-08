"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useT } from "@/lib/i18n/provider";
import { useCachedResource } from "@/lib/cached-resource";
import { money, monthLabel } from "@/lib/fees/format";
import { formatMoneyCompact } from "@/lib/settings/currency";

/**
 * How collection has moved, by month and by class.
 *
 * Charts were the last part of this page still capable of drawing a number
 * nothing else could reproduce, and a chart is the most persuasive thing on a
 * dashboard: a school reads a trend line and plans against it. These come from
 * `/fees/analytics`, which walks the same charge lines every card and every
 * list are built from, and carries the same class filter — so the bar for a
 * month equals the cards on the day that month was live.
 *
 * Only months the school actually billed are drawn. A flat run of zeros for
 * months nobody set up is not history; it is a picture of a school that
 * collected nothing.
 */

interface MonthPoint {
  monthKey: string;
  expected: number;
  collected: number;
  outstanding: number;
}

interface ClassPoint {
  className: string;
  students: number;
  expected: number;
  collected: number;
  outstanding: number;
  rate: number;
}

const axisStyle = { fontSize: 11, fill: "hsl(var(--muted-foreground))" };

const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid hsl(var(--border))",
  background: "hsl(var(--card))",
  color: "hsl(var(--card-foreground))",
  fontSize: 12,
  boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
};

export function FeeCollectionCharts({
  classId,
  sectionId,
}: {
  classId?: string;
  sectionId?: string;
}) {
  const t = useT();

  const url = useMemo(() => {
    const q = new URLSearchParams();
    if (classId) q.set("classId", classId);
    if (sectionId) q.set("sectionId", sectionId);
    const s = q.toString();
    return `/fees/analytics${s ? `?${s}` : ""}`;
  }, [classId, sectionId]);

  // Coming back to this page redraws last visit's charts on the first frame
  // and refreshes behind them. The skeleton below is for a school that has
  // genuinely never loaded this view, which is once.
  const { data, failed } = useCachedResource<{
    trend: MonthPoint[];
    byClass: ClassPoint[];
  }>(url);

  if (failed) return null;

  if (!data) {
    return (
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="h-[300px] animate-pulse rounded-2xl border bg-secondary/40" />
        <div className="h-[300px] animate-pulse rounded-2xl border bg-secondary/40" />
      </div>
    );
  }

  // Nothing billed yet is a real state and deserves a sentence, not an empty
  // pair of axes suggesting the data failed to arrive.
  if (data.trend.length === 0) {
    return (
      <div className="rounded-2xl border bg-card p-6 text-center text-sm text-muted-foreground">
        {t("feeCharts.nothingBilledYet")}
      </div>
    );
  }

  const trend = data.trend.map((m) => ({
    label: monthLabel(m.monthKey),
    expected: m.expected,
    collected: m.collected,
  }));

  return (
    <div className="grid items-start gap-6 xl:grid-cols-2">
      <section className="rounded-2xl border bg-card p-5 shadow-sm">
        <h2 className="text-sm font-semibold">{t("feeCharts.expectedVsCollected")}</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {t("feeCharts.expectedVsCollectedNote")}
        </p>
        <div className="mt-3">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart
              data={trend}
              margin={{ top: 10, right: 8, left: -8, bottom: 0 }}
              barGap={4}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="hsl(var(--border))"
              />
              <XAxis dataKey="label" tick={axisStyle} tickLine={false} axisLine={false} />
              <YAxis
                tick={axisStyle}
                tickLine={false}
                axisLine={false}
                tickFormatter={(n: number) => formatMoneyCompact(n)}
                width={48}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
                formatter={(v: number, name) => [
                  money(v),
                  name === "expected"
                    ? t("feeCharts.expected")
                    : t("feeCharts.collected"),
                ]}
              />
              <Bar dataKey="expected" fill="#0ea5e9" radius={[4, 4, 0, 0]} maxBarSize={22} />
              <Bar dataKey="collected" fill="#22c55e" radius={[4, 4, 0, 0]} maxBarSize={22} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="rounded-2xl border bg-card shadow-sm">
        <div className="p-5 pb-3">
          <h2 className="text-sm font-semibold">{t("feeCharts.byClass")}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("feeCharts.byClassNote")}
          </p>
        </div>
        <div className="max-h-[240px] overflow-auto border-t">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-secondary/60 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-2 text-start">{t("feeCharts.classLabel")}</th>
                <th className="p-2 text-end">{t("feeCharts.expected")}</th>
                <th className="p-2 text-end">{t("feeCharts.collected")}</th>
                <th className="p-2 text-end">{t("feeCharts.rate")}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.byClass.map((c) => (
                <tr key={c.className}>
                  <td className="p-2 font-medium">
                    {c.className}
                    <span className="ms-2 text-xs text-muted-foreground">
                      ({c.students})
                    </span>
                  </td>
                  <td className="p-2 text-end tabular-nums">{money(c.expected)}</td>
                  <td className="p-2 text-end tabular-nums">{money(c.collected)}</td>
                  <td className="p-2 text-end">
                    <span className="flex items-center justify-end gap-2">
                      <span
                        aria-hidden
                        className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-secondary sm:block"
                      >
                        <span
                          className="block h-full rounded-full bg-emerald-500"
                          style={{ width: `${Math.min(100, c.rate)}%` }}
                        />
                      </span>
                      <span className="w-12 text-end font-medium tabular-nums">
                        {c.rate.toFixed(1)}%
                      </span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
