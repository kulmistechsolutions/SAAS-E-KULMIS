"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BarChart3, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { toast } from "@/lib/toast";
import { fetchPlatformSmsUsage, type PlatformSmsUsage } from "@/lib/platform/api";

/**
 * Who is actually sending, across every school.
 *
 * Credits, not message counts: that is the unit a school is billed in and the
 * unit the provider account is drawn down by. A hundred long messages and a
 * hundred short ones are the same row counted as messages, and they are not
 * the same cost.
 *
 * Failed messages sit in their own column and are never counted as spend — the
 * provider does not charge for what it did not send, so folding them in would
 * make this page disagree with the invoice.
 */

const WINDOWS = [7, 30, 90, 365];

export default function PlatformSmsUsagePage() {
  const [data, setData] = useState<PlatformSmsUsage | null>(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (d: number) => {
    setLoading(true);
    try {
      setData(await fetchPlatformSmsUsage(d));
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not load usage", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(days);
  }, [days, load]);

  const max = data?.rows[0]?.credits ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/platform/sms"
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> SMS
          </Link>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold text-white">
            <BarChart3 className="h-6 w-6 text-violet-400" />
            SMS usage
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Credits spent per school. Failed messages cost nothing and are
            counted apart.
          </p>
        </div>
        <div className="flex gap-2">
          <Select
            value={String(days)}
            onChange={(e) => setDays(Number(e.target.value))}
            className="border-white/10 bg-[#0b1120] text-white"
          >
            {WINDOWS.map((w) => (
              <option key={w} value={w}>
                Last {w} days
              </option>
            ))}
          </Select>
          <Button
            variant="outline"
            onClick={() => void load(days)}
            className="border-white/20 text-slate-200"
          >
            <RefreshCw className="me-2 h-4 w-4" /> Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Credits spent" value={data?.totals.credits ?? 0} />
        <Stat label="Messages" value={data?.totals.messages ?? 0} />
        <Stat label="Failed" value={data?.totals.failed ?? 0} tone="rose" />
        <Stat label="Schools sending" value={data?.totals.schoolsSending ?? 0} />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#0f172a]">
        <table className="w-full min-w-[700px] text-sm">
          <thead className="border-b border-white/10 text-xs uppercase text-slate-400">
            <tr>
              <th className="px-4 py-3 text-start font-medium">School</th>
              <th className="px-4 py-3 text-start font-medium">Share</th>
              <th className="px-4 py-3 text-end font-medium">Credits</th>
              <th className="px-4 py-3 text-end font-medium">Messages</th>
              <th className="px-4 py-3 text-end font-medium">Failed</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  Loading...
                </td>
              </tr>
            )}
            {!loading && (data?.rows.length ?? 0) === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  No school sent anything in this window.
                </td>
              </tr>
            )}
            {(data?.rows ?? []).map((r) => (
              <tr key={r.schoolId} className="border-b border-white/5 last:border-0">
                <td className="px-4 py-3">
                  <p className="font-medium text-white">{r.name}</p>
                  <p className="text-xs text-slate-500">{r.subdomain}</p>
                </td>
                <td className="px-4 py-3">
                  {/* Against the busiest school, not against the total: with
                      seventy-eight schools every bar against the total is a
                      sliver and the chart says nothing. */}
                  <div className="h-2 w-40 overflow-hidden rounded-full bg-white/5">
                    <div
                      className="h-full rounded-full bg-violet-500"
                      style={{
                        width: `${max > 0 ? Math.max(2, Math.round((r.credits / max) * 100)) : 0}%`,
                      }}
                    />
                  </div>
                </td>
                <td className="px-4 py-3 text-end tabular-nums font-medium text-white">
                  {r.credits.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-end tabular-nums text-slate-300">
                  {r.messages.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-end tabular-nums text-rose-300">
                  {r.failed > 0 ? r.failed.toLocaleString() : "\u2014"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(data?.byStatus.length ?? 0) > 0 && (
        <div className="rounded-2xl border border-white/10 bg-[#0f172a] p-5">
          <h2 className="font-semibold text-white">By delivery status</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {(data?.byStatus ?? []).map((s) => (
              <div key={s.status}>
                <p className="text-xs text-slate-500">{s.status}</p>
                <p className="mt-0.5 text-lg font-bold tabular-nums text-white">
                  {s.count.toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "rose";
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#0f172a] p-4">
      <p className="text-xs text-slate-400">{label}</p>
      <p
        className={`mt-1 text-2xl font-bold tabular-nums ${
          tone === "rose" ? "text-rose-300" : "text-white"
        }`}
      >
        {value.toLocaleString()}
      </p>
    </div>
  );
}
