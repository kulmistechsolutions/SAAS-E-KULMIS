"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ChevronRight,
  MapPin,
  RefreshCw,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
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

const LEVEL: Record<SchoolActivityLevel, { label: string; cls: string }> = {
  today: { label: "Active today", cls: "bg-emerald-500/12 text-emerald-600" },
  this_week: { label: "This week", cls: "bg-blue-500/12 text-blue-600" },
  this_month: { label: "This month", cls: "bg-amber-500/12 text-amber-600" },
  dormant: { label: "Dormant", cls: "bg-rose-500/12 text-rose-600" },
  never: { label: "Never used", cls: "bg-slate-500/12 text-slate-500" },
};

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
      <div className="rounded-xl border bg-card p-5 text-sm text-rose-600">
        Could not load this school&apos;s activity.
      </div>
    );
  }
  if (!data) {
    return (
      <div className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">{data.school.name}</h2>
          <p className="text-sm text-muted-foreground">
            {data.school.subdomain}.ekulmis.com
            {data.school.region ? ` · ${data.school.region}` : ""}
            {data.school.city ? ` · ${data.school.city}` : ""}
          </p>
        </div>
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          { label: "Last active", value: timeAgo(data.lastActiveAt) },
          { label: "Logins (30d)", value: String(data.logins) },
          { label: "Failed logins", value: String(data.failedLogins) },
          { label: "Errors (30d)", value: String(data.errors.length) },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border bg-background p-3">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="mt-1 font-semibold">{s.value}</p>
          </div>
        ))}
      </div>

      {data.lastAction && (
        <div className="rounded-lg border bg-background p-3 text-sm">
          <span className="text-muted-foreground">Last thing they did: </span>
          <span className="font-medium">
            {data.lastAction.action} ({data.lastAction.module})
          </span>
          <span className="text-muted-foreground">
            {" "}
            by {data.lastAction.username ?? "—"}, {timeAgo(data.lastAction.at)}
          </span>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold">What they use</h3>
          {data.modules.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              No recorded work in this window.
            </p>
          ) : (
            <dl className="mt-2 space-y-1.5">
              {data.modules.slice(0, 10).map((m) => (
                <div key={m.module} className="flex justify-between text-sm">
                  <dt className="text-muted-foreground">{m.module}</dt>
                  <dd className="font-semibold tabular-nums">{m.count}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>

        <div>
          <h3 className="text-sm font-semibold">Who is working</h3>
          {data.users.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">Nobody yet.</p>
          ) : (
            <dl className="mt-2 space-y-1.5">
              {data.users.slice(0, 10).map((u) => (
                <div
                  key={`${u.username}-${u.role}`}
                  className="flex justify-between text-sm"
                >
                  <dt className="min-w-0 truncate text-muted-foreground">
                    {u.username ?? "—"}{" "}
                    <span className="text-xs">({u.role ?? "—"})</span>
                  </dt>
                  <dd className="shrink-0 ps-2 tabular-nums">
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
          <h3 className="flex items-center gap-2 text-sm font-semibold text-rose-600">
            <AlertTriangle className="h-4 w-4" />
            Pages that failed for them
          </h3>
          <div className="mt-2 space-y-1.5">
            {data.errorPaths.map((e) => (
              <div key={e.path} className="rounded-lg border bg-background p-2.5 text-sm">
                <div className="flex justify-between gap-2">
                  <code className="min-w-0 truncate text-xs">{e.path}</code>
                  <span className="shrink-0 font-semibold tabular-nums">
                    ×{e.count}
                  </span>
                </div>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {e.message}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h3 className="text-sm font-semibold">Recent activity</h3>
        <div className="mt-2 max-h-80 space-y-1 overflow-y-auto pe-1">
          {data.recent.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between gap-2 rounded-lg border bg-background px-3 py-2 text-sm"
            >
              <span className="min-w-0 truncate">
                <span className="font-medium">{r.action}</span>{" "}
                <span className="text-xs text-muted-foreground">
                  {r.module} · {r.username ?? "—"}
                </span>
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">School Activity</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Who is using the system, what they did last, and what failed for them.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={String(days)}
            onChange={(e) => setDays(Number(e.target.value))}
            className="w-36"
          >
            <option value="7">Last 7 days</option>
            <option value="14">Last 14 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </Select>
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {failed && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-400">
          Could not load school activity.
        </div>
      )}

      {data && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Active today", value: data.totals.activeToday, tone: "text-emerald-600" },
            { label: "Active this week", value: data.totals.activeThisWeek, tone: "text-blue-600" },
            { label: "Dormant", value: data.totals.dormant, tone: "text-rose-600" },
            { label: "With errors", value: data.totals.withErrors, tone: "text-amber-600" },
          ].map((c) => (
            <div key={c.label} className="rounded-xl border bg-card p-5 shadow-sm">
              <p className="text-sm text-muted-foreground">{c.label}</p>
              <p className={cn("mt-1 text-2xl font-bold", c.tone)}>{c.value}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                of {data.totals.schools} schools
              </p>
            </div>
          ))}
        </div>
      )}

      {openId && <Detail schoolId={openId} onClose={() => setOpenId(null)} />}

      <div className="flex flex-wrap gap-2">
        <span className="relative">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search school, subdomain, province…"
            className="w-72 ps-9"
          />
        </span>
        <Select
          value={level}
          onChange={(e) => setLevel(e.target.value as typeof level)}
          className="w-44"
        >
          <option value="all">All schools</option>
          <option value="today">Active today</option>
          <option value="this_week">Active this week</option>
          <option value="this_month">Active this month</option>
          <option value="dormant">Dormant</option>
          <option value="never">Never used</option>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              <th className="px-4 py-3 text-start font-medium">School</th>
              <th className="px-4 py-3 text-start font-medium">Province</th>
              <th className="px-4 py-3 text-start font-medium">Last active</th>
              <th className="px-4 py-3 text-start font-medium">Status</th>
              <th className="px-4 py-3 text-end font-medium">Logins</th>
              <th className="px-4 py-3 text-end font-medium">Actions</th>
              <th className="px-4 py-3 text-end font-medium">Errors</th>
              <th className="px-4 py-3 text-start font-medium">Most used</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r: SchoolActivityRow) => (
              <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                <td className="px-4 py-3">
                  <p className="font-medium">{r.name}</p>
                  <p className="text-xs text-muted-foreground">{r.subdomain}</p>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {r.region || r.city ? (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {r.region ?? r.city}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {timeAgo(r.lastActiveAt)}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      "inline-block rounded-full px-2.5 py-1 text-xs font-medium",
                      LEVEL[r.activity].cls,
                    )}
                  >
                    {LEVEL[r.activity].label}
                  </span>
                </td>
                <td className="px-4 py-3 text-end tabular-nums">
                  {r.logins}
                  {r.failedLogins > 0 && (
                    <span className="text-xs text-rose-600"> ({r.failedLogins}✕)</span>
                  )}
                </td>
                <td className="px-4 py-3 text-end tabular-nums">{r.actions}</td>
                <td
                  className={cn(
                    "px-4 py-3 text-end tabular-nums",
                    r.errors > 0 && "font-semibold text-rose-600",
                  )}
                >
                  {r.errors}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {r.topModules.length === 0
                    ? "—"
                    : r.topModules.map((m) => m.module).join(", ")}
                </td>
                <td className="px-4 py-3 text-end">
                  <Button
                    variant="ghost"
                    className="h-8 px-2"
                    onClick={() => setOpenId(r.id)}
                  >
                    <Activity className="me-1 h-4 w-4" />
                    View
                    <ChevronRight className="ms-1 h-4 w-4 rtl:rotate-180" />
                  </Button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-10 text-center text-sm text-muted-foreground"
                >
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
