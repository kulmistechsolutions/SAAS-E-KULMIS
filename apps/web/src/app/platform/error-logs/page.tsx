"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  fetchPlatformErrorLogs,
  type PlatformErrorLogRow,
  type PlatformErrorLogs,
} from "@/lib/platform/api";
import { loadSchools } from "@/lib/platform/data";
import type { PlatformSchool } from "@/lib/platform/types";
import { cn } from "@/lib/utils";

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  return `${days}d ago`;
}

function ErrorRow({ row }: { row: PlatformErrorLogRow }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-white/10 bg-black/20">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between gap-3 px-4 py-3 text-start"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-md bg-rose-500/15 px-2 py-0.5 font-mono text-xs font-semibold text-rose-300">
              {row.statusCode}
            </span>
            <span className="font-mono text-xs text-slate-400">
              {row.method}
            </span>
            <span className="truncate font-mono text-xs text-slate-300">
              {row.path}
            </span>
          </div>
          <p className="mt-1 truncate text-sm text-white">{row.message}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            {row.schoolName ? (
              <Link
                href={`/platform/schools/${row.schoolId}`}
                className="text-violet-300 hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {row.schoolName} ({row.schoolSubdomain})
              </Link>
            ) : (
              <span>No school (platform-level)</span>
            )}
            {row.role && <span>· {row.role}</span>}
            <span>· {timeAgo(row.createdAt)}</span>
          </div>
        </div>
        {open ? (
          <ChevronUp className="mt-1 h-4 w-4 shrink-0 text-slate-500" />
        ) : (
          <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-slate-500" />
        )}
      </button>
      {open && row.stack && (
        <pre className="overflow-x-auto border-t border-white/10 bg-black/30 px-4 py-3 text-xs text-slate-400 whitespace-pre-wrap">
          {row.stack}
        </pre>
      )}
    </div>
  );
}

export default function PlatformErrorLogsPage() {
  const [data, setData] = useState<PlatformErrorLogs | null>(null);
  const [schools, setSchools] = useState<PlatformSchool[]>([]);
  const [schoolId, setSchoolId] = useState("");
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [logs, schoolList] = await Promise.all([
        fetchPlatformErrorLogs({ schoolId: schoolId || undefined, days }),
        schools.length ? Promise.resolve(schools) : loadSchools(),
      ]);
      setData(logs);
      setSchools(schoolList);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId, days]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
            <AlertTriangle className="h-6 w-6 text-rose-400" />
            Error Logs
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Every unhandled server error (5xx) across every school — a durable
            record that survives redeploys, unlike container logs.
          </p>
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={cn("me-2 h-4 w-4", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="min-w-[220px]">
          <label className="mb-1 block text-xs text-slate-400">School</label>
          <Select
            value={schoolId}
            onChange={(e) => setSchoolId(e.target.value)}
            className="bg-black/30"
          >
            <option value="">All schools</option>
            {schools.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.subdomain})
              </option>
            ))}
          </Select>
        </div>
        <div className="min-w-[160px]">
          <label className="mb-1 block text-xs text-slate-400">Window</label>
          <Select
            value={String(days)}
            onChange={(e) => setDays(Number(e.target.value))}
            className="bg-black/30"
          >
            <option value="1">Last 24 hours</option>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
          </Select>
        </div>
      </div>

      {data && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs text-slate-400">
              Total errors ({days === 1 ? "24h" : `${days}d`})
            </p>
            <p className="mt-1 text-3xl font-bold text-white">{data.total}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="mb-2 text-xs text-slate-400">Most frequent</p>
            {data.topPaths.length === 0 ? (
              <p className="text-sm text-slate-500">No errors in this window.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {data.topPaths.slice(0, 4).map((p) => (
                  <li
                    key={p.path}
                    className="flex items-center justify-between gap-2 font-mono text-xs text-slate-300"
                  >
                    <span className="truncate">{p.path}</span>
                    <span className="shrink-0 text-slate-500">
                      x{p.count}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <div className="space-y-2">
        {loading && !data && (
          <p className="text-sm text-slate-400">Loading…</p>
        )}
        {data && data.rows.length === 0 && (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-6 text-center text-sm text-emerald-300">
            No server errors reported in this window — clean.
          </div>
        )}
        {data?.rows.map((row) => (
          <ErrorRow key={row.id} row={row} />
        ))}
      </div>
    </div>
  );
}
