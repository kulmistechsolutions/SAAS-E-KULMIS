"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCw, ScrollText, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { toast } from "@/lib/toast";
import {
  fetchPlatformSmsMessages,
  fetchPlatformSmsOverview,
  type PlatformSmsMessage,
  type PlatformSmsOverview,
} from "@/lib/platform/api";

/**
 * Every message the platform has sent, for anyone who has to answer for one.
 *
 * The school's own History answers "did our message go out". This answers the
 * questions only the platform can: which school, under which sending name, and
 * what the provider actually said about it — the code and text it replied with,
 * which is the only evidence when a school insists a parent never received
 * something.
 */

const STATUSES = ["", "PENDING", "QUEUED", "SENT", "DELIVERED", "FAILED", "CANCELLED"];
const PAGE = 100;

export default function PlatformSmsLogsPage() {
  const [rows, setRows] = useState<PlatformSmsMessage[]>([]);
  const [total, setTotal] = useState(0);
  const [skip, setSkip] = useState(0);
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<PlatformSmsOverview | null>(null);

  const [schoolId, setSchoolId] = useState("");
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const load = useCallback(
    async (nextSkip = 0) => {
      setLoading(true);
      try {
        const page = await fetchPlatformSmsMessages({
          schoolId: schoolId || undefined,
          status: status || undefined,
          q: q.trim() || undefined,
          from: from || undefined,
          to: to || undefined,
          take: PAGE,
          skip: nextSkip,
        });
        setRows(page.items);
        setTotal(page.total);
        setSkip(page.skip);
      } catch (e) {
        toast(e instanceof Error ? e.message : "Could not load logs", "error");
      } finally {
        setLoading(false);
      }
    },
    [schoolId, status, q, from, to],
  );

  useEffect(() => {
    void load(0);
    // Filters are applied by the button, not on every keystroke: this query
    // scans every school's messages and should not run per character typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchPlatformSmsOverview()
      .then(setOverview)
      .catch(() => undefined);
  }, []);

  const schools = useMemo(
    () => [...(overview?.schools ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    [overview],
  );

  const shown = rows.length;
  const hasPrev = skip > 0;
  const hasNext = skip + shown < total;

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
            <ScrollText className="h-6 w-6 text-violet-400" />
            Delivery logs
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Every message, every school, with what the provider replied.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => void load(skip)}
          className="border-white/20 text-slate-200"
        >
          <RefreshCw className="me-2 h-4 w-4" /> Refresh
        </Button>
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#0f172a] p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <Label className="text-slate-400">School</Label>
            <Select
              className="mt-1 border-white/10 bg-[#0b1120] text-white"
              value={schoolId}
              onChange={(e) => setSchoolId(e.target.value)}
            >
              <option value="">All schools</option>
              {schools.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label className="text-slate-400">Status</Label>
            <Select
              className="mt-1 border-white/10 bg-[#0b1120] text-white"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s || "Any status"}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label className="text-slate-400">From</Label>
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="mt-1 border-white/10 bg-[#0b1120] text-white"
            />
          </div>
          <div>
            <Label className="text-slate-400">To</Label>
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="mt-1 border-white/10 bg-[#0b1120] text-white"
            />
          </div>
          <div>
            <Label className="text-slate-400">Search</Label>
            <div className="relative mt-1">
              <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void load(0);
                }}
                placeholder="Number, name or text"
                className="border-white/10 bg-[#0b1120] ps-9 text-white"
              />
            </div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button onClick={() => void load(0)}>Apply</Button>
          <Button
            variant="outline"
            className="border-white/20 text-slate-200"
            onClick={() => {
              setSchoolId("");
              setStatus("");
              setQ("");
              setFrom("");
              setTo("");
              // Cleared and reloaded in one press: clearing the boxes and
              // leaving yesterday's rows on screen is how a filter gets
              // misread as a result.
              setTimeout(() => void load(0), 0);
            }}
          >
            Clear
          </Button>
          <span className="ms-auto text-xs text-slate-400">
            {loading
              ? "Loading..."
              : total === 0
                ? "No messages match"
                : `${(skip + 1).toLocaleString()}-${(skip + shown).toLocaleString()} of ${total.toLocaleString()}`}
          </span>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#0f172a]">
        <table className="w-full min-w-[1000px] text-sm">
          <thead className="border-b border-white/10 text-xs uppercase text-slate-400">
            <tr>
              <th className="px-4 py-3 text-start font-medium">When</th>
              <th className="px-4 py-3 text-start font-medium">School</th>
              <th className="px-4 py-3 text-start font-medium">Recipient</th>
              <th className="px-4 py-3 text-start font-medium">Sender</th>
              <th className="px-4 py-3 text-start font-medium">Message</th>
              <th className="px-4 py-3 text-end font-medium">Credits</th>
              <th className="px-4 py-3 text-start font-medium">Status</th>
              <th className="px-4 py-3 text-start font-medium">Provider said</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                  Loading...
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                  Nothing matches those filters.
                </td>
              </tr>
            )}
            {rows.map((m) => (
              <tr key={m.id} className="border-b border-white/5 last:border-0">
                <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-400">
                  {new Date(m.createdAt).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-slate-300">{m.school.name}</td>
                <td className="px-4 py-3">
                  <p className="text-white">{m.recipientName ?? "\u2014"}</p>
                  <p className="font-mono text-xs text-slate-500">
                    {m.recipientPhone}
                  </p>
                </td>
                <td className="px-4 py-3 text-xs text-slate-400">{m.senderId}</td>
                <td className="max-w-xs px-4 py-3 text-xs text-slate-300">
                  <p className="line-clamp-2">{m.body}</p>
                </td>
                <td className="px-4 py-3 text-end tabular-nums text-slate-200">
                  {m.creditsUsed}
                </td>
                <td className="px-4 py-3">
                  <StatusPill status={m.status} />
                </td>
                <td className="max-w-xs px-4 py-3 text-xs">
                  {/* The provider's own words. When a school says a parent
                      never got a message, this line is the only evidence
                      either way. */}
                  {m.error ? (
                    <p className="text-rose-300">{m.error}</p>
                  ) : m.providerMessage || m.providerCode ? (
                    <p className="text-slate-400">
                      {m.providerCode ? `[${m.providerCode}] ` : ""}
                      {m.providerMessage ?? ""}
                    </p>
                  ) : (
                    <span className="text-slate-600">\u2014</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-2">
        <Button
          variant="outline"
          className="border-white/20 text-slate-200"
          disabled={!hasPrev || loading}
          onClick={() => void load(Math.max(0, skip - PAGE))}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          className="border-white/20 text-slate-200"
          disabled={!hasNext || loading}
          onClick={() => void load(skip + PAGE)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const tone =
    status === "DELIVERED" || status === "SENT"
      ? "bg-emerald-500/15 text-emerald-300"
      : status === "FAILED"
        ? "bg-rose-500/15 text-rose-300"
        : status === "CANCELLED"
          ? "bg-white/5 text-slate-400"
          : "bg-amber-500/15 text-amber-300";
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}>
      {status}
    </span>
  );
}
