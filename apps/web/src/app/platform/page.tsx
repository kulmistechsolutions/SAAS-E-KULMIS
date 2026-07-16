"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Building2, Plus } from "lucide-react";
import { PlatformSummaryCards } from "@/components/platform/summary-cards";
import { SchoolStatusBadge } from "@/components/platform/school-status-badge";
import { loadDashboard, loadSchools } from "@/lib/platform/data";
import { shortDate } from "@/lib/platform/format";
import { usePlatformSchoolsState } from "@/lib/platform/store";
import type { PlatformDashboard, PlatformSchool } from "@/lib/platform/types";
import {
  fetchPlatformSubscriptionAlerts,
  type PlatformSubscriptionAlert,
} from "@/lib/platform/api";
import { Button } from "@/components/ui/button";

export default function PlatformDashboardPage() {
  const previewSchools = usePlatformSchoolsState();
  const [mounted, setMounted] = useState(false);
  const [summary, setSummary] = useState<PlatformDashboard | null>(null);
  const [schools, setSchools] = useState<PlatformSchool[]>([]);
  const [alerts, setAlerts] = useState<PlatformSubscriptionAlert[]>([]);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted) return;
    loadDashboard().then(setSummary).catch(() => setSummary(null));
    loadSchools().then(setSchools).catch(() => setSchools([]));
    fetchPlatformSubscriptionAlerts()
      .then(setAlerts)
      .catch(() => setAlerts([]));
  }, [mounted, previewSchools]);

  if (!mounted || !summary) {
    return <div className="text-slate-400">Loading dashboard…</div>;
  }

  const recent = schools.slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Platform Dashboard</h1>
          <p className="mt-1 text-sm text-slate-400">
            Cross-tenant overview for all schools on eKulmis
          </p>
        </div>
        <Link href="/platform/schools">
          <Button className="bg-violet-600 hover:bg-violet-500">
            <Plus className="mr-2 h-4 w-4" />
            New School
          </Button>
        </Link>
      </div>

      <PlatformSummaryCards summary={summary} />

      {alerts.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-semibold text-amber-100">
              <AlertTriangle className="h-4 w-4" />
              Subscription alerts (7 / 3 / 1 day)
            </h2>
            <Link
              href="/platform/subscriptions"
              className="text-sm text-violet-300 hover:underline"
            >
              Open subscriptions →
            </Link>
          </div>
          <ul className="space-y-2 text-sm">
            {alerts.slice(0, 8).map((a) => (
              <li
                key={`${a.school.id}-${a.endDate}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-black/20 px-3 py-2"
              >
                <div>
                  <Link
                    href={`/platform/schools/${a.school.id}`}
                    className="font-medium text-white hover:underline"
                  >
                    {a.school.name}
                  </Link>
                  <span className="ml-2 text-slate-400">{a.planName}</span>
                </div>
                <span
                  className={
                    a.status === "EXPIRED" || a.daysRemaining <= 1
                      ? "text-rose-300"
                      : a.daysRemaining <= 3
                        ? "text-amber-200"
                        : "text-slate-300"
                  }
                >
                  {a.status === "EXPIRED"
                    ? "Expired"
                    : a.daysRemaining === 1
                      ? "Expires in 1 day"
                      : `Expires in ${a.daysRemaining} days`}
                  {" · "}
                  {shortDate(a.endDate)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-xl border border-white/10 bg-white/5 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold text-white">Recent Schools</h2>
          <Link
            href="/platform/schools"
            className="text-sm text-violet-400 hover:underline"
          >
            View all →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-slate-400">
                <th className="px-3 py-2">School</th>
                <th className="px-3 py-2">Subdomain</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Users</th>
                <th className="px-3 py-2">Created</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((s) => (
                <tr key={s.id} className="border-b border-white/5">
                  <td className="px-3 py-3">
                    <Link
                      href={`/platform/schools/${s.id}`}
                      className="font-medium text-white hover:text-violet-300"
                    >
                      {s.name}
                    </Link>
                  </td>
                  <td className="px-3 py-3 font-mono text-slate-300">
                    {s.subdomain}
                  </td>
                  <td className="px-3 py-3">
                    <SchoolStatusBadge status={s.status} />
                  </td>
                  <td className="px-3 py-3 text-slate-300">{s.userCount}</td>
                  <td className="px-3 py-3 text-slate-400">
                    {shortDate(s.createdAt)}
                  </td>
                </tr>
              ))}
              {recent.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-3 py-8 text-center text-slate-500"
                  >
                    <Building2 className="mx-auto mb-2 h-8 w-8 opacity-50" />
                    No schools provisioned yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
