"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bell, Layers, MessageSquare, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  fetchPlatformEvents,
  markNotificationsSeen,
  type PlatformEvent,
  type PlatformEventType,
} from "@/lib/platform/notifications";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

const FILTERS: { id: "ALL" | PlatformEventType; label: string }[] = [
  { id: "ALL", label: "All events" },
  { id: "SUBSCRIPTION", label: "Subscriptions" },
  { id: "SMS_PURCHASE", label: "SMS purchases" },
];

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function PlatformNotificationsPage() {
  const [events, setEvents] = useState<PlatformEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"ALL" | PlatformEventType>("ALL");
  const [search, setSearch] = useState("");

  async function load() {
    setLoading(true);
    try {
      const rows = await fetchPlatformEvents();
      setEvents(rows);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to load notifications", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    markNotificationsSeen();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return events.filter((e) => {
      if (filter !== "ALL" && e.type !== filter) return false;
      if (q && !e.schoolName.toLowerCase().includes(q) && !e.subdomain.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [events, filter, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
            <Bell className="h-6 w-6 text-violet-300" /> Notifications
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Live feed of what happens across every school — subscriptions and SMS
            package purchases, newest first.
          </p>
        </div>
        <Button
          variant="outline"
          className="h-9 border-white/10 text-slate-200"
          onClick={() => void load()}
        >
          <RefreshCw className="me-2 h-4 w-4" /> Refresh
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm",
                filter === f.id
                  ? "bg-violet-600 text-white"
                  : "text-slate-400 hover:bg-white/5 hover:text-white",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <Input
          placeholder="Search school…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 max-w-xs border-white/10 bg-white/5 text-white placeholder:text-slate-500"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0f172a]">
        {loading ? (
          <p className="px-4 py-12 text-center text-slate-500">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="px-4 py-12 text-center text-slate-500">No events yet.</p>
        ) : (
          <ul className="divide-y divide-white/5">
            {filtered.map((e) => (
              <li key={e.id} className="flex items-start gap-3 px-4 py-3.5 hover:bg-white/[0.03]">
                <span
                  className={cn(
                    "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                    e.type === "SUBSCRIPTION"
                      ? "bg-violet-500/15 text-violet-300"
                      : "bg-emerald-500/15 text-emerald-300",
                  )}
                >
                  {e.type === "SUBSCRIPTION" ? (
                    <Layers className="h-4 w-4" />
                  ) : (
                    <MessageSquare className="h-4 w-4" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-100">
                    <Link
                      href={`/platform/schools/${e.schoolId}`}
                      className="font-medium hover:text-violet-300 hover:underline"
                    >
                      {e.title}
                    </Link>
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">{e.detail}</p>
                </div>
                <div className="shrink-0 text-end">
                  <p className="text-xs text-slate-500">{timeAgo(e.occurredAt)}</p>
                  <p className="mt-1 text-[11px] text-slate-600">
                    {new Date(e.occurredAt).toLocaleString()}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
