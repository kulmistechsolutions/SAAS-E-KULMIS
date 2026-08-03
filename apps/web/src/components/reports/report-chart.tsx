"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const axisStyle = {
  fontSize: 11,
  fill: "hsl(var(--muted-foreground))",
};

const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid hsl(var(--border))",
  background: "hsl(var(--card))",
  color: "hsl(var(--card-foreground))",
  fontSize: 12,
  boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
};

/** "$1,234.56" or 1234.56 → 1234.56. Report columns are pre-formatted for
 *  the table, so the chart re-parses rather than the backend carrying two
 *  copies of every amount. */
function toNumber(v: string | number | undefined): number {
  if (typeof v === "number") return v;
  if (!v) return 0;
  const n = Number(String(v).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export function ReportBarChart({
  rows,
  xKey,
  yKey,
  label,
}: {
  rows: Record<string, string | number>[];
  xKey: string;
  yKey: string;
  label: string;
}) {
  const data = rows.map((r) => ({
    x: String(r[xKey] ?? ""),
    y: toNumber(r[yKey]),
  }));
  if (data.length === 0) return null;

  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 10, right: 8, left: -8, bottom: 0 }}>
          <defs>
            <linearGradient id="reportBarGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity={0.95} />
              <stop offset="100%" stopColor="#6366f1" stopOpacity={0.55} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
          <XAxis dataKey="x" tick={axisStyle} tickLine={false} axisLine={false} />
          <YAxis tick={axisStyle} tickLine={false} axisLine={false} width={48} />
          <Tooltip
            contentStyle={tooltipStyle}
            cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
            formatter={(v: number) => [v.toLocaleString(), label]}
          />
          <Bar
            dataKey="y"
            fill="url(#reportBarGradient)"
            radius={[8, 8, 0, 0]}
            maxBarSize={56}
            animationDuration={500}
            animationEasing="ease-out"
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
