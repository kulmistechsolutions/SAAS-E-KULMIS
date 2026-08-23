"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Check,
  ChevronRight,
  Copy,
  MapPin,
  RefreshCw,
  Search,
} from "lucide-react";
import {
  fetchSchoolActivity,
  fetchSchoolActivityDetail,
  type SchoolActivity,
  type SchoolActivityDetail,
  type SchoolActivityLevel,
  type SchoolActivityRow,
} from "@/lib/platform/api";
import { cn } from "@/lib/utils";

function timeAgo(iso: string | null): string {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  if (d < 30) return `${d}d ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

const stamp = (iso: string) => new Date(iso).toISOString().replace("T", " ").slice(0, 19);

const LEVEL: Record<SchoolActivityLevel, { label: string; cls: string }> = {
  today: { label: "Active today", cls: "bg-emerald-500/15 text-emerald-300" },
  this_week: { label: "This week", cls: "bg-sky-500/15 text-sky-300" },
  this_month: { label: "This month", cls: "bg-amber-500/15 text-amber-300" },
  dormant: { label: "Dormant", cls: "bg-rose-500/15 text-rose-300" },
  never: { label: "Never used", cls: "bg-slate-500/15 text-slate-400" },
};

/** Copy-to-clipboard that reports back, so the owner knows it actually took. */
function CopyButton({
  text,
  label = "Copy",
  className,
}: {
  text: () => string;
  label?: string;
  className?: string;
}) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text());
        } catch {
          // Clipboard is blocked outside a secure context — fall back to a
          // selectable prompt rather than failing silently.
          window.prompt("Copy the log below:", text());
        }
        setDone(true);
        setTimeout(() => setDone(false), 1600);
      }}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-white/5 hover:text-white",
        className,
      )}
    >
      {done ? (
        <>
          <Check className="h-3.5 w-3.5 text-emerald-400" />
          Copied
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5" />
          {label}
        </>
      )}
    </button>
  );
}

function detailAsText(d: SchoolActivityDetail): string {
  const L: string[] = [];
  L.push(`SCHOOL ACTIVITY — ${d.school.name}`);
  L.push(`${d.school.subdomain}.ekulmis.com`);
  if (d.school.region || d.school.city) {
    L.push(`Province/City: ${d.school.region ?? "—"} / ${d.school.city ?? "—"}`);
  }
  L.push(`Status: ${d.school.status}`);
  L.push(`Window: last ${d.days} days (since ${stamp(d.since)})`);
  L.push(`Last active: ${d.lastActiveAt ? stamp(d.lastActiveAt) : "never"}`);
  L.push(`Logins: ${d.logins}   Failed logins: ${d.failedLogins}`);
  if (d.lastAction) {
    L.push(
      `Last action: ${d.lastAction.action} (${d.lastAction.module}) by ${d.lastAction.username ?? "—"} at ${stamp(d.lastAction.at)}`,
    );
  }

  L.push("", "MODULES USED");
  if (d.modules.length === 0) L.push("  (none)");
  for (const m of d.modules) L.push(`  ${m.module}: ${m.count}`);

  L.push("", "USERS");
  if (d.users.length === 0) L.push("  (none)");
  for (const u of d.users) {
    L.push(
      `  ${u.username ?? "—"} (${u.role ?? "—"}): ${u.actions} actions, last ${u.lastActiveAt ? stamp(u.lastActiveAt) : "never"}`,
    );
  }

  L.push("", `ERRORS (${d.errors.length})`);
  if (d.errorPaths.length === 0) L.push("  (none)");
  for (const e of d.errorPaths) L.push(`  x${e.count}  ${e.path}  — ${e.message}`);
  if (d.errors.length > 0) {
    L.push("", "ERROR LOG");
    for (const e of d.errors) {
      L.push(`  ${stamp(e.createdAt)}  ${e.statusCode} ${e.method} ${e.path}  ${e.message}`);
    }
  }

  L.push("", `EVENTS (${d.recent.length} most recent)`);
  for (const r of d.recent) {
    L.push(
      `  ${stamp(r.createdAt)}  ${r.action}  [${r.module}]  ${r.username ?? "—"} (${r.role ?? "—"})${r.ip ? `  ip=${r.ip}` : ""}`,
    );
  }
  return L.join("\n");
}

function listAsText(d: SchoolActivity): string {
  const L: string[] = [];
  L.push(`SCHOOL ACTIVITY — last ${d.days} days (since ${stamp(d.since)})`);
  L.push(
    `Schools: ${d.totals.schools}  Active today: ${d.totals.activeToday}  This week: ${d.totals.activeThisWeek}  Dormant: ${d.totals.dormant}  With errors: ${d.totals.withErrors}`,
  );
  L.push("");
  L.push(
    ["School", "Subdomain", "Province", "LastActive", "Status", "Logins", "Failed", "Actions", "Errors", "TopModules"].join("\t"),
  );
  for (const r of d.rows) {
    L.push(
      [
        r.name,
        r.subdomain,
        r.region ?? r.city ?? "",
        r.lastActiveAt ? stamp(r.lastActiveAt) : "never",
        LEVEL[r.activity].label,
        r.logins,
        r.failedLogins,
        r.actions,
        r.errors,
        r.topModules.map((m) => m.module).join(" "),
      ].join("\t"),
    );
  }
  return L.join("\n");
}

const CARD = "rounded-xl border border-white/10 bg-white/[0.03] p-5";

function Detail({ schoolId, onClose }: { schoolId: string; onClose: () => void }) {
  const [data, setData] = useState<SchoolActivityDetail | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchSchoolActivityDetail(schoolId, 30)
      .then((d) => alive && setData(d))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [schoolId]);

  if (failed) {
    return (
      <div className={cn(CARD, "text-sm text-rose-300")}>
        Could not load this school&apos;s activity.
      </div>
    );
  }
  if (!data) {
    return <div className={cn(CARD, "text-sm text-slate-400")}>Loading…</div>;
  }

  return (
    <div className={cn(CARD, "space-y-5")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white">{data.school.name}</h2>
          <p className="text-sm text-slate-400">
            {data.school.subdomain}.ekulmis.com
            {data.school.region ? ` · ${data.school.region}` : ""}
            {data.school.city ? ` · ${data.school.city}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CopyButton text={() => detailAsText(data)} label="Copy everything" />
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/5 hover:text-white"
          >
            Close
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          { label: "Last active", value: timeAgo(data.lastActiveAt) },
          { label: "Logins (30d)", value: String(data.logins) },
          { label: "Failed logins", value: String(data.failedLogins) },
          { label: "Errors (30d)", value: String(data.errors.length) },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-white/10 bg-black/20 p-3">
            <p className="text-xs text-slate-400">{s.label}</p>
            <p className="mt-1 font-semibold text-white">{s.value}</p>
          </div>
        ))}
      </div>

      {data.lastAction && (
        <div className="rounded-lg border border-white/10 bg-black/20 p-3 text-sm text-slate-300">
          <span className="text-slate-400">Last thing they did: </span>
          <span className="font-medium text-white">
            {data.lastAction.action} ({data.lastAction.module})
          </span>
          <span className="text-slate-400">
            {" "}
            by {data.lastAction.username ?? "—"}, {timeAgo(data.lastAction.at)}
          </span>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">What they use</h3>
            <CopyButton
              text={() =>
                data.modules.map((m) => `${m.module}\t${m.count}`).join("\n")
              }
            />
          </div>
          {data.modules.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">No recorded work.</p>
          ) : (
            <dl className="mt-2 space-y-1.5">
              {data.modules.slice(0, 12).map((m) => (
                <div key={m.module} className="flex justify-between text-sm">
                  <dt className="text-slate-400">{m.module}</dt>
                  <dd className="font-semibold tabular-nums text-slate-200">{m.count}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Who is working</h3>
            <CopyButton
              text={() =>
                data.users
                  .map(
                    (u) =>
                      `${u.username ?? "—"}\t${u.role ?? "—"}\t${u.actions}\t${u.lastActiveAt ? stamp(u.lastActiveAt) : "never"}`,
                  )
                  .join("\n")
              }
            />
          </div>
          {data.users.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">Nobody yet.</p>
          ) : (
            <dl className="mt-2 space-y-1.5">
              {data.users.slice(0, 12).map((u) => (
                <div
                  key={`${u.username}-${u.role}`}
                  className="flex justify-between gap-2 text-sm"
                >
                  <dt className="min-w-0 truncate text-slate-400">
                    {u.username ?? "—"}{" "}
                    <span className="text-xs text-slate-500">({u.role ?? "—"})</span>
                  </dt>
                  <dd className="shrink-0 tabular-nums text-slate-300">
                    {u.actions} · {timeAgo(u.lastActiveAt)}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </div>

      {data.errorPaths.length > 0 && (
        <div>
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-rose-300">
              <AlertTriangle className="h-4 w-4" />
              Pages that failed for them
            </h3>
            <CopyButton
              text={() =>
                data.errors
                  .map(
                    (e) =>
                      `${stamp(e.createdAt)}\t${e.statusCode}\t${e.method} ${e.path}\t${e.message}`,
                  )
                  .join("\n")
              }
              label="Copy errors"
            />
          </div>
          <div className="mt-2 space-y-1.5">
            {data.errorPaths.map((e) => (
              <div
                key={e.path}
                className="rounded-lg border border-white/10 bg-black/20 p-2.5"
              >
                <div className="flex justify-between gap-2">
                  <code className="min-w-0 truncate font-mono text-xs text-slate-300">
                    {e.path}
                  </code>
                  <span className="shrink-0 font-semibold tabular-nums text-rose-300">
                    ×{e.count}
                  </span>
                </div>
                <p className="mt-1 truncate text-xs text-slate-500">{e.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Recent events</h3>
          <CopyButton
            text={() =>
              data.recent
                .map(
                  (r) =>
                    `${stamp(r.createdAt)}\t${r.action}\t${r.module}\t${r.username ?? "—"}\t${r.role ?? "—"}\t${r.ip ?? ""}`,
                )
                .join("\n")
            }
            label="Copy events"
          />
        </div>
        <div className="mt-2 max-h-80 space-y-1 overflow-y-auto pe-1">
          {data.recent.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm"
            >
              <span className="min-w-0 truncate">
                <span className="font-medium text-slate-200">{r.action}</span>{" "}
                <span className="text-xs text-slate-500">
                  {r.module} · {r.username ?? "—"}
                </span>
              </span>
              <span className="shrink-0 text-xs text-slate-500">
                {timeAgo(r.createdAt)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function SchoolActivityPage() {
  const [data, setData] = useState<SchoolActivity | null>(null);
  const [failed, setFailed] = useState(false);
  const [days, setDays] = useState(7);
  const [q, setQ] = useState("");
  const [level, setLevel] = useState<"all" | SchoolActivityLevel>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await fetchSchoolActivity(days));
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(() => {
    if (!data) return [];
    const needle = q.trim().toLowerCase();
    return data.rows
      .filter((r) => (level === "all" ? true : r.activity === level))
      .filter((r) =>
        !needle
          ? true
          : [r.name, r.subdomain, r.region ?? "", r.city ?? ""]
              .join(" ")
              .toLowerCase()
              .includes(needle),
      )
      .sort((a, b) => {
        const at = a.lastActiveAt ? new Date(a.lastActiveAt).getTime() : 0;
        const bt = b.lastActiveAt ? new Date(b.lastActiveAt).getTime() : 0;
        return bt - at;
      });
  }, [data, q, level]);

  const selectCls =
    "rounded-lg border border-white/10 bg-[#0f172a] px-3 py-2 text-sm text-slate-200 focus:border-violet-500/50 focus:outline-none";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">School Activity</h1>
          <p className="mt-1 text-sm text-slate-400">
            Who is using the system, what they did last, and what failed for them.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {data && (
            <CopyButton
              text={() => listAsText(data)}
              label="Copy all schools"
              className="px-3 py-2"
            />
          )}
          <select
            value={String(days)}
            onChange={(e) => setDays(Number(e.target.value))}
            className={selectCls}
          >
            <option value="7">Last 7 days</option>
            <option value="14">Last 14 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </select>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="rounded-lg border border-white/10 p-2 text-slate-300 hover:bg-white/5 hover:text-white disabled:opacity-50"
            aria-label="Refresh"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {failed && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          Could not load school activity.
        </div>
      )}

      {data && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Active today", value: data.totals.activeToday, tone: "text-emerald-400" },
            { label: "Active this week", value: data.totals.activeThisWeek, tone: "text-sky-400" },
            { label: "Dormant", value: data.totals.dormant, tone: "text-rose-400" },
            { label: "With errors", value: data.totals.withErrors, tone: "text-amber-400" },
          ].map((c) => (
            <div key={c.label} className={CARD}>
              <p className="text-sm text-slate-400">{c.label}</p>
              <p className={cn("mt-1 text-3xl font-bold", c.tone)}>{c.value}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                of {data.totals.schools} schools
              </p>
            </div>
          ))}
        </div>
      )}

      {openId && <Detail schoolId={openId} onClose={() => setOpenId(null)} />}

      <div className="flex flex-wrap gap-2">
        <span className="relative">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search school, subdomain, province…"
            className={cn(selectCls, "w-72 ps-9 placeholder:text-slate-500")}
          />
        </span>
        <select
          value={level}
          onChange={(e) => setLevel(e.target.value as typeof level)}
          className={cn(selectCls, "w-44")}
        >
          <option value="all">All schools</option>
          <option value="today">Active today</option>
          <option value="this_week">Active this week</option>
          <option value="this_month">Active this month</option>
          <option value="dormant">Dormant</option>
          <option value="never">Never used</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/[0.03]">
        <table className="w-full text-sm">
          <thead className="border-b border-white/10 bg-black/20">
            <tr className="text-slate-300">
              <th className="px-4 py-3 text-start font-semibold">School</th>
              <th className="px-4 py-3 text-start font-semibold">Province</th>
              <th className="px-4 py-3 text-start font-semibold">Last active</th>
              <th className="px-4 py-3 text-start font-semibold">Status</th>
              <th className="px-4 py-3 text-end font-semibold">Logins</th>
              <th className="px-4 py-3 text-end font-semibold">Actions</th>
              <th className="px-4 py-3 text-end font-semibold">Errors</th>
              <th className="px-4 py-3 text-start font-semibold">Most used</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r: SchoolActivityRow) => (
              <tr
                key={r.id}
                className="border-b border-white/5 last:border-0 hover:bg-white/[0.04]"
              >
                <td className="px-4 py-3">
                  <p className="font-medium text-white">{r.name}</p>
                  <p className="text-xs text-slate-500">{r.subdomain}</p>
                </td>
                <td className="px-4 py-3 text-slate-300">
                  {r.region || r.city ? (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 text-slate-500" />
                      {r.region ?? r.city}
                    </span>
                  ) : (
                    <span className="text-slate-600">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-300">{timeAgo(r.lastActiveAt)}</td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      "inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold",
                      LEVEL[r.activity].cls,
                    )}
                  >
                    {LEVEL[r.activity].label}
                  </span>
                </td>
                <td className="px-4 py-3 text-end tabular-nums text-slate-200">
                  {r.logins}
                  {r.failedLogins > 0 && (
                    <span className="ms-1 text-xs text-rose-400">({r.failedLogins}✕)</span>
                  )}
                </td>
                <td className="px-4 py-3 text-end tabular-nums text-slate-200">
                  {r.actions}
                </td>
                <td
                  className={cn(
                    "px-4 py-3 text-end tabular-nums",
                    r.errors > 0 ? "font-bold text-rose-400" : "text-slate-500",
                  )}
                >
                  {r.errors}
                </td>
                <td className="px-4 py-3 text-xs text-slate-400">
                  {r.topModules.length === 0
                    ? "—"
                    : r.topModules.map((m) => m.module).join(", ")}
                </td>
                <td className="px-4 py-3 text-end">
                  <button
                    type="button"
                    onClick={() => setOpenId(r.id)}
                    className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/5 hover:text-white"
                  >
                    <Activity className="h-3.5 w-3.5" />
                    View
                    <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-sm text-slate-500">
                  No schools match this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
