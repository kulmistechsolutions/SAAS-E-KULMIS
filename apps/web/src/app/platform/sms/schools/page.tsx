"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Ban, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/lib/toast";
import {
  fetchPlatformSmsOverview,
  updateSchoolSmsGovernance,
  type PlatformSmsOverview,
} from "@/lib/platform/api";

/**
 * Every school's SMS account, and the two controls only the platform owner has.
 *
 * A school owns one switch — whether it wants SMS on — and nothing else. It
 * cannot see a credential, cannot change a sending name, and cannot lift a
 * suspension: the route behind this page is the only one that writes any of
 * that, and it is Super Admin-only at the guard, not merely hidden from a menu.
 */

type School = PlatformSmsOverview["schools"][number];

export default function PlatformSmsSchoolsPage() {
  const [data, setData] = useState<PlatformSmsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<School | null>(null);

  async function load() {
    setLoading(true);
    try {
      setData(await fetchPlatformSmsOverview());
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not load schools", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // Loaded once; the refresh button is the way back for a stale page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const schools = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const all = data?.schools ?? [];
    if (!needle) return all;
    return all.filter(
      (s) =>
        s.name.toLowerCase().includes(needle) ||
        s.subdomain.toLowerCase().includes(needle) ||
        s.accountNo.toLowerCase().includes(needle),
    );
  }, [data, q]);

  const suspended = (data?.schools ?? []).filter((s) => s.smsSuspended).length;
  const limited = (data?.schools ?? []).filter(
    (s) => s.smsDailyLimit > 0 || s.smsMonthlyLimit > 0,
  ).length;

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
            <ShieldCheck className="h-6 w-6 text-violet-400" />
            School SMS accounts
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Suspend a school&apos;s SMS, or cap how much it may send. A school
            cannot change either of these itself.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => void load()}
          className="border-white/20 text-slate-200"
        >
          <RefreshCw className="me-2 h-4 w-4" /> Refresh
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Schools" value={data?.schools.length ?? 0} />
        <Stat label="Suspended" value={suspended} tone="rose" />
        <Stat label="With a limit set" value={limited} tone="amber" />
      </div>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="School, subdomain or account number"
          className="border-white/10 bg-[#0b1120] ps-9 text-white"
        />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#0f172a]">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="border-b border-white/10 text-xs uppercase text-slate-400">
            <tr>
              <th className="px-4 py-3 text-start font-medium">School</th>
              <th className="px-4 py-3 text-start font-medium">Account</th>
              <th className="px-4 py-3 text-start font-medium">Sender ID</th>
              <th className="px-4 py-3 text-end font-medium">Credits</th>
              <th className="px-4 py-3 text-start font-medium">Limits</th>
              <th className="px-4 py-3 text-start font-medium">Status</th>
              <th className="px-4 py-3 text-end font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  Loading...
                </td>
              </tr>
            )}
            {!loading && schools.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  No school matches that.
                </td>
              </tr>
            )}
            {schools.map((s) => (
              <tr key={s.id} className="border-b border-white/5 last:border-0">
                <td className="px-4 py-3">
                  <p className="font-medium text-white">{s.name}</p>
                  <p className="text-xs text-slate-500">{s.subdomain}</p>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-slate-400">
                  {s.accountNo}
                </td>
                <td className="px-4 py-3 text-slate-300">
                  {s.smsSenderName || <span className="text-slate-600">&mdash;</span>}
                </td>
                <td className="px-4 py-3 text-end tabular-nums text-slate-200">
                  {s.creditsRemaining.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-xs text-slate-400">
                  {/* Zero is the absence of a ceiling, not a ceiling of zero. */}
                  {s.smsDailyLimit === 0 && s.smsMonthlyLimit === 0 ? (
                    <span className="text-slate-600">No limit</span>
                  ) : (
                    [
                      s.smsDailyLimit > 0
                        ? `${s.smsDailyLimit.toLocaleString()}/day`
                        : null,
                      s.smsMonthlyLimit > 0
                        ? `${s.smsMonthlyLimit.toLocaleString()}/month`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" \u00b7 ")
                  )}
                </td>
                <td className="px-4 py-3">
                  {s.smsSuspended ? (
                    <span
                      className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2 py-0.5 text-xs font-semibold text-rose-300"
                      title={s.smsSuspendedReason ?? undefined}
                    >
                      <Ban className="h-3 w-3" /> Suspended
                    </span>
                  ) : s.smsEnabled ? (
                    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-300">
                      Active
                    </span>
                  ) : (
                    <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs font-semibold text-slate-400">
                      Off by school
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-end">
                  <button
                    type="button"
                    onClick={() => setEditing(s)}
                    className="text-xs font-medium text-violet-300 hover:underline"
                  >
                    Manage
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <GovernanceDialog
          school={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void load();
          }}
        />
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
  tone?: "rose" | "amber";
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#0f172a] p-4">
      <p className="text-xs text-slate-400">{label}</p>
      <p
        className={`mt-1 text-2xl font-bold tabular-nums ${
          tone === "rose"
            ? "text-rose-300"
            : tone === "amber"
              ? "text-amber-300"
              : "text-white"
        }`}
      >
        {value.toLocaleString()}
      </p>
    </div>
  );
}

/**
 * The two decisions, on one school.
 *
 * Suspension asks for a reason because the school is shown it: "SMS is
 * suspended: account configuration issue" is something a desk can act on,
 * where a bare refusal only sends them to the phone.
 */
function GovernanceDialog({
  school,
  onClose,
  onSaved,
}: {
  school: School;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [suspended, setSuspended] = useState(school.smsSuspended);
  const [reason, setReason] = useState(school.smsSuspendedReason ?? "");
  const [daily, setDaily] = useState(String(school.smsDailyLimit));
  const [monthly, setMonthly] = useState(String(school.smsMonthlyLimit));
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await updateSchoolSmsGovernance(school.id, {
        smsSuspended: suspended,
        smsSuspendedReason: suspended ? reason.trim() || null : null,
        smsDailyLimit: Math.max(0, Number(daily) || 0),
        smsMonthlyLimit: Math.max(0, Number(monthly) || 0),
      });
      toast(`${school.name} updated`, "success");
      onSaved();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0f172a] p-5 shadow-xl">
        <h2 className="font-semibold text-white">{school.name}</h2>
        <p className="mt-0.5 font-mono text-xs text-slate-500">
          {school.accountNo}
        </p>

        <label className="mt-5 flex items-start gap-3 rounded-xl border border-white/10 p-3">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={suspended}
            onChange={(e) => setSuspended(e.target.checked)}
          />
          <span>
            <span className="block text-sm font-medium text-white">
              Suspend SMS sending
            </span>
            <span className="mt-0.5 block text-xs text-slate-400">
              History and reports stay readable. The school cannot lift this.
            </span>
          </span>
        </label>

        {suspended && (
          <div className="mt-3">
            <Label className="text-slate-400">Reason shown to the school</Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Account configuration issue"
              className="mt-1 border-white/10 bg-[#0b1120] text-white"
            />
          </div>
        )}

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <Label className="text-slate-400">Daily limit</Label>
            <Input
              type="number"
              min={0}
              value={daily}
              onChange={(e) => setDaily(e.target.value)}
              className="mt-1 border-white/10 bg-[#0b1120] text-white"
            />
          </div>
          <div>
            <Label className="text-slate-400">Monthly limit</Label>
            <Input
              type="number"
              min={0}
              value={monthly}
              onChange={(e) => setMonthly(e.target.value)}
              className="mt-1 border-white/10 bg-[#0b1120] text-white"
            />
          </div>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Counted in credits, the same unit the school is billed in. 0 means no
          limit.
        </p>

        <div className="mt-5 flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            className="border-white/20 text-slate-200"
          >
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}
