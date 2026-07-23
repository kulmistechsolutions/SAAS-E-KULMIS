"use client";

import { useEffect, useState } from "react";
import { Activity, Loader2, ShieldAlert } from "lucide-react";
import {
  fetchPlatformSchoolLoginActivity,
  type PlatformLoginActivityRow,
} from "@/lib/platform/api";

interface Summary {
  successful: number;
  failed: number;
  lastLoginAt: string | null;
}

function when(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Short, readable device from a user-agent — enough to recognise a session. */
function device(ua: string | null): string {
  if (!ua) return "—";
  if (/android/i.test(ua)) return "Android";
  if (/iphone|ipad|ipod/i.test(ua)) return "iPhone / iPad";
  if (/windows/i.test(ua)) return "Windows";
  if (/mac os/i.test(ua)) return "Mac";
  if (/linux/i.test(ua)) return "Linux";
  return "Other";
}

/**
 * The school's sign-in trail, for the platform owner. Shows whether a school is
 * actually being used and surfaces runs of failed attempts against an account.
 */
export function SchoolLoginActivity({ schoolId }: { schoolId: string }) {
  const [rows, setRows] = useState<PlatformLoginActivityRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void fetchPlatformSchoolLoginActivity(schoolId, 100)
      .then((res) => {
        if (!active) return;
        setRows(res.rows);
        setSummary(res.summary);
        setError(null);
      })
      .catch((e: unknown) => {
        if (active) {
          setError(e instanceof Error ? e.message : "Could not load activity");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [schoolId]);

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-center gap-2">
        <Activity className="h-4 w-4 text-emerald-400" />
        <h2 className="font-semibold text-white">Login Activity</h2>
      </div>
      <p className="mt-1 text-sm text-white/60">
        Every sign-in attempt for this school — who, when, and from where.
        Failed attempts are shown too.
      </p>

      {loading ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-white/60">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </p>
      ) : error ? (
        <p className="mt-4 text-sm text-rose-300">{error}</p>
      ) : (
        <>
          {summary && (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Stat label="Successful" value={summary.successful} tone="ok" />
              <Stat label="Failed" value={summary.failed} tone="bad" />
              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <p className="text-xs text-white/50">Last sign-in</p>
                <p className="mt-1 text-sm font-medium text-white">
                  {summary.lastLoginAt ? when(summary.lastLoginAt) : "Never"}
                </p>
              </div>
            </div>
          )}

          {summary && summary.successful === 0 && (
            <p className="mt-3 flex items-start gap-2 rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-200">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
              Nobody has ever signed in to this school.
            </p>
          )}

          <div className="mt-4 overflow-x-auto rounded-lg border border-white/10">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-white/5 text-left text-xs uppercase tracking-wide text-white/50">
                <tr>
                  <th className="px-3 py-2.5 font-medium">When</th>
                  <th className="px-3 py-2.5 font-medium">User</th>
                  <th className="px-3 py-2.5 font-medium">Role</th>
                  <th className="px-3 py-2.5 font-medium">Result</th>
                  <th className="px-3 py-2.5 font-medium">IP</th>
                  <th className="px-3 py-2.5 font-medium">Device</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-white/10">
                    <td className="whitespace-nowrap px-3 py-2 text-white/80">
                      {when(r.at)}
                    </td>
                    <td className="px-3 py-2 font-medium text-white">
                      {r.username ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-white/70">
                      {r.role ? r.role.replace(/_/g, " ") : "—"}
                    </td>
                    <td className="px-3 py-2">
                      {r.success ? (
                        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-300">
                          Signed in
                        </span>
                      ) : (
                        <span
                          className="rounded-full bg-rose-500/15 px-2 py-0.5 text-xs font-medium text-rose-300"
                          title={r.reason ?? undefined}
                        >
                          Failed{r.reason ? ` · ${r.reason}` : ""}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-white/60">
                      {r.ip ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-white/60">
                      {device(r.userAgent)}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-3 py-8 text-center text-white/50"
                    >
                      No sign-in attempts recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
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
  tone: "ok" | "bad";
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-3">
      <p className="text-xs text-white/50">{label}</p>
      <p
        className={`mt-1 text-xl font-bold tabular-nums ${
          tone === "ok" ? "text-emerald-300" : "text-rose-300"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
