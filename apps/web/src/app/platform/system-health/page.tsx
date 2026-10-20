"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Database,
  Globe,
  HardDrive,
  MemoryStick,
  RefreshCw,
  Server,
  ShieldAlert,
  Zap,
} from "lucide-react";
import {
  fetchSystemHealth,
  type SystemHealthReport,
  type SystemStatus,
} from "@/lib/platform/api";
import { cn } from "@/lib/utils";

const CARD = "rounded-xl border border-white/10 bg-white/[0.03] p-4";

const STATUS: Record<SystemStatus, { title: string; cls: string; icon: typeof CheckCircle2 }> = {
  OK: { title: "All systems operational", cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300", icon: CheckCircle2 },
  PROBLEM: { title: "A problem was found in the last check", cls: "border-amber-500/40 bg-amber-500/10 text-amber-300", icon: AlertTriangle },
  NOT_REPORTING: { title: "The server is not reporting", cls: "border-rose-500/40 bg-rose-500/10 text-rose-300", icon: ShieldAlert },
  NO_DATA: { title: "Waiting for the first check", cls: "border-white/10 bg-white/5 text-slate-300", icon: Clock },
};

function ago(min: number | null): string {
  if (min === null) return "—";
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  return h < 24 ? `${h} h ${min % 60} min ago` : `${Math.floor(h / 24)} days ago`;
}

function ms(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  return v >= 1000 ? `${(v / 1000).toFixed(1)} s` : `${v} ms`;
}

function when(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function Kpi({
  icon: Icon, label, value, sub, bad,
}: { icon: typeof Server; label: string; value: string; sub?: string; bad?: boolean }) {
  return (
    <div className={CARD}>
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <Icon className="h-4 w-4" /> {label}
      </div>
      <p className={cn("mt-2 text-2xl font-semibold", bad ? "text-amber-300" : "text-white")}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

export default function SystemHealthPage() {
  const [data, setData] = useState<SystemHealthReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await fetchSystemHealth());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load system health");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    // The monitor checks every five minutes; a minute here keeps the page current.
    const t = setInterval(() => void load(), 60_000);
    return () => clearInterval(t);
  }, [load]);

  const st = STATUS[data?.status ?? "NO_DATA"];
  const latest = data?.latest ?? null;
  const problems = (latest?.problems ?? "").split(";").map((p) => p.trim()).filter(Boolean);
  const maxMs = Math.max(500, ...(data?.series ?? []).map((p) => p.apiMs ?? 0));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">System Health</h1>
          <p className="mt-1 text-sm text-slate-400">
            The server checks itself every {data?.checkEveryMinutes ?? 5} minutes: the API, the website, every
            school&apos;s site, the database, disk, memory, errors and backups.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 hover:bg-white/10"
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /> Refresh
        </button>
      </div>

      {error && <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300">{error}</p>}

      {/* ── Status ── */}
      <div className={cn("rounded-xl border p-4", st.cls)}>
        <div className="flex flex-wrap items-center gap-3">
          <st.icon className="h-6 w-6" />
          <div className="flex-1">
            <p className="text-lg font-semibold">{st.title}</p>
            <p className="text-xs opacity-80">
              {data?.status === "NOT_REPORTING"
                ? `No check has arrived for ${data.minutesSinceLast} minutes — the server or its monitor is down.`
                : data?.checkedAt
                  ? `Last checked ${ago(data.minutesSinceLast)} (${when(data.checkedAt)})`
                  : "The monitor writes its first check within 5 minutes of being installed."}
            </p>
          </div>
        </div>
        {problems.length > 0 && data?.status === "PROBLEM" && (
          <ul className="mt-3 list-disc space-y-0.5 ps-9 text-sm">
            {problems.map((p) => <li key={p}>{p}</li>)}
          </ul>
        )}
      </div>

      {/* ── Figures ── */}
      {data && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          <Kpi
            icon={CheckCircle2}
            label="Uptime (24 h)"
            value={data.last24h.uptimePct === null ? "—" : `${data.last24h.uptimePct}%`}
            sub={`${data.last24h.okChecks} of ${data.last24h.expected} checks passed`}
            bad={(data.last24h.uptimePct ?? 100) < 99}
          />
          <Kpi icon={Zap} label="API speed (24 h)" value={ms(data.last24h.apiAvgMs)} sub={`slowest 5%: ${ms(data.last24h.apiP95Ms)}`} bad={(data.last24h.apiAvgMs ?? 0) > 1000} />
          <Kpi icon={Globe} label="Website speed (24 h)" value={ms(data.last24h.webAvgMs)} sub={`slowest 5%: ${ms(data.last24h.webP95Ms)}`} bad={(data.last24h.webAvgMs ?? 0) > 1500} />
          <Kpi
            icon={Globe}
            label="School sites"
            value={latest ? `${latest.sitesChecked - latest.sitesFailed} / ${latest.sitesChecked}` : "—"}
            sub={latest?.sitesFailed ? `not loading: ${latest.failedSites}` : "all loading"}
            bad={!!latest?.sitesFailed}
          />
          <Kpi icon={Database} label="Database" value={ms(latest?.dbMs)} sub={latest?.errors1h ? `${latest.errors1h} server errors in the last hour` : "no server errors in the last hour"} bad={(latest?.errors1h ?? 0) >= 5} />
          <Kpi icon={HardDrive} label="Disk used" value={latest?.diskPct != null ? `${latest.diskPct}%` : "—"} bad={(latest?.diskPct ?? 0) >= 85} />
          <Kpi icon={MemoryStick} label="Free memory" value={latest?.memAvailableMb != null ? `${(latest.memAvailableMb / 1024).toFixed(1)} GB` : "—"} sub={latest?.load1 != null ? `load ${latest.load1}` : undefined} bad={(latest?.memAvailableMb ?? 9999) < 500} />
          <Kpi icon={Database} label="Last backup" value={latest?.backupAgeHours != null ? `${latest.backupAgeHours} h ago` : "—"} sub="nightly at 02:15 UTC" bad={(latest?.backupAgeHours ?? 0) > 26} />
          <Kpi icon={Server} label="Server running since" value={latest?.bootedAt ? when(latest.bootedAt) : "—"} sub={latest?.containersDown ? `down: ${latest.containersDown}` : "API, website and database up"} bad={!!latest?.containersDown} />
        </div>
      )}

      {/* ── API response time, last 24 hours ── */}
      {data && data.series.length > 0 && (
        <div className={CARD}>
          <p className="mb-3 text-sm font-medium text-slate-200">API response time — last 24 hours</p>
          <div className="flex h-28 items-end gap-px">
            {data.series.map((p) => (
              <div
                key={p.t}
                title={`${when(p.t)} — API ${ms(p.apiMs)}, website ${ms(p.webMs)}${p.ok ? "" : " — problem"}`}
                className={cn("min-w-[2px] flex-1 rounded-t-sm", p.ok ? "bg-violet-400/70" : "bg-rose-400")}
                style={{ height: `${Math.max(3, ((p.apiMs ?? 0) / maxMs) * 100)}%` }}
              />
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Each bar is one check. Red bars are checks that found a problem; a gap means no check arrived.
          </p>
        </div>
      )}

      {/* ── Incidents ── */}
      {data && (
        <div className={CARD}>
          <p className="mb-3 text-sm font-medium text-slate-200">Incidents — last 7 days</p>
          {data.incidents.length === 0 ? (
            <p className="text-sm text-slate-500">No incidents. Everything has been working.</p>
          ) : (
            <ul className="divide-y divide-white/5">
              {data.incidents.map((i) => (
                <li key={`${i.kind}${i.startedAt}`} className="flex flex-wrap items-start gap-3 py-2.5">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                      !i.endedAt ? "bg-rose-500/20 text-rose-300" : i.kind === "OUTAGE" ? "bg-amber-500/15 text-amber-300" : "bg-sky-500/15 text-sky-300",
                    )}
                  >
                    {!i.endedAt ? "ONGOING" : i.kind === "OUTAGE" ? "OUTAGE" : "PROBLEM"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-100">{i.message}</p>
                    <p className="text-xs text-slate-500">
                      {when(i.startedAt)} → {i.endedAt ? when(i.endedAt) : "now"} · {i.minutes} min
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ── Recent checks ── */}
      {data && data.recent.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/5">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-start text-xs text-slate-400">
                <th className="px-4 py-2.5 text-start">Checked</th>
                <th className="px-4 py-2.5 text-start">Result</th>
                <th className="px-4 py-2.5 text-start">API</th>
                <th className="px-4 py-2.5 text-start">Website</th>
                <th className="px-4 py-2.5 text-start">Database</th>
                <th className="px-4 py-2.5 text-start">Sites</th>
                <th className="px-4 py-2.5 text-start">Disk</th>
              </tr>
            </thead>
            <tbody>
              {data.recent.map((r) => (
                <tr key={r.id} className="border-b border-white/5">
                  <td className="px-4 py-2 text-slate-300">{when(r.checkedAt)}</td>
                  <td className="px-4 py-2">
                    {r.ok ? (
                      <span className="text-emerald-300">OK</span>
                    ) : (
                      <span className="text-amber-300" title={r.problems ?? ""}>{r.problems ?? "Problem"}</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-slate-300">{ms(r.apiMs)}</td>
                  <td className="px-4 py-2 text-slate-300">{ms(r.webMs)}</td>
                  <td className="px-4 py-2 text-slate-300">{ms(r.dbMs)}</td>
                  <td className="px-4 py-2 text-slate-300">{r.sitesChecked - r.sitesFailed}/{r.sitesChecked}</td>
                  <td className="px-4 py-2 text-slate-300">{r.diskPct ?? "—"}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
