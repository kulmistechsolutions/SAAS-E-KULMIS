"use client";


import { useT } from "@/lib/i18n/provider";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  Building2,
  MoonStar,
  Plus,
} from "lucide-react";
import { PlatformSummaryCards } from "@/components/platform/summary-cards";
import { SchoolStatusBadge } from "@/components/platform/school-status-badge";
import { loadDashboard, loadSchools } from "@/lib/platform/data";
import { shortDate } from "@/lib/platform/format";
import { usePlatformSchoolsState } from "@/lib/platform/store";
import type { PlatformDashboard, PlatformSchool } from "@/lib/platform/types";
import {
  fetchPlatformSubscriptionAlerts,
  fetchSchoolActivity,
  type PlatformSubscriptionAlert,
  type SchoolActivity,
} from "@/lib/platform/api";
import { Button } from "@/components/ui/button";
import { useHydrated } from "@/lib/use-hydrated";

export default function PlatformDashboardPage() {
  const t = useT();
  const previewSchools = usePlatformSchoolsState();
  const mounted = useHydrated();
  const [summary, setSummary] = useState<PlatformDashboard | null>(null);
  const [schools, setSchools] = useState<PlatformSchool[]>([]);
  const [alerts, setAlerts] = useState<PlatformSubscriptionAlert[]>([]);
  /**
   * Who is working hardest, and who has gone quiet.
   *
   * Read from the same endpoint School Activity uses rather than counted
   * again here — two places computing "busiest" from the same audit trail is
   * two places to disagree. A week is the window the console opens on;
   * changing it lives on that page.
   */
  const [activity, setActivity] = useState<SchoolActivity | null>(null);


  useEffect(() => {
    if (!mounted) return;
    loadDashboard().then(setSummary).catch(() => setSummary(null));
    loadSchools().then(setSchools).catch(() => setSchools([]));
    fetchPlatformSubscriptionAlerts()
      .then(setAlerts)
      .catch(() => setAlerts([]));
    fetchSchoolActivity(7)
      .then(setActivity)
      .catch(() => setActivity(null));
  }, [mounted, previewSchools]);

  if (!mounted || !summary) {
    return <div className="text-slate-400">{t("platform.loadingDashboard")}</div>;
  }

  const recent = schools.slice(0, 5);

  // Busiest counts work done, not logins: a school that signs in every
  // morning and does nothing is not a school using the system. Quietest is
  // the list worth ringing, and a school nobody has ever opened leads it.
  const busiest = [...(activity?.rows ?? [])]
    .sort((a, b) => b.actions - a.actions || b.logins - a.logins)
    .filter((r) => r.actions > 0)
    .slice(0, 5);
  const quietest = [...(activity?.rows ?? [])]
    .sort((a, b) => {
      const at = a.lastActiveAt ? new Date(a.lastActiveAt).getTime() : 0;
      const bt = b.lastActiveAt ? new Date(b.lastActiveAt).getTime() : 0;
      return a.logins - b.logins || at - bt;
    })
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{t("platform.platformDashboard")}</h1>
          <p className="mt-1 text-sm text-slate-400">
            {t("platform.crossTenantOverviewForAllSchools")}
          </p>
        </div>
        <Link href="/platform/schools">
          <Button className="bg-violet-600 hover:bg-violet-500">
            <Plus className="me-2 h-4 w-4" />
            {t("platform.newSchool")}
          </Button>
        </Link>
      </div>

      <PlatformSummaryCards summary={summary} />

      {alerts.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-semibold text-amber-100">
              <AlertTriangle className="h-4 w-4" />
              {t("platform.subscriptionAlerts731Day")}
            </h2>
            <Link
              href="/platform/subscriptions"
              className="text-sm text-violet-300 hover:underline"
            >
              {t("platform.openSubscriptions")}
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
                  <span className="ms-2 text-slate-400">{a.planName}</span>
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

      {activity && (
        <div className="grid gap-4 lg:grid-cols-2">
          {[
            {
              title: "Busiest schools",
              note: `Most work done in the last ${activity.days} days`,
              icon: Activity,
              tone: "text-emerald-300",
              rows: busiest,
              empty: "Nobody has done anything this week.",
              figure: (r: SchoolActivity["rows"][number]) =>
                `${r.actions.toLocaleString()} actions`,
            },
            {
              title: "Quietest schools",
              note: "Fewest sign-ins — the list worth ringing",
              icon: MoonStar,
              tone: "text-amber-300",
              rows: quietest,
              empty: "Every school has signed in.",
              figure: (r: SchoolActivity["rows"][number]) =>
                r.logins === 0 ? "No sign-ins" : `${r.logins} sign-ins`,
            },
          ].map((panel) => (
            <div
              key={panel.title}
              className="rounded-xl border border-white/10 bg-white/5 p-5"
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <h2 className="flex items-center gap-2 font-semibold text-white">
                    <panel.icon className={`h-4 w-4 ${panel.tone}`} />
                    {panel.title}
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-400">{panel.note}</p>
                </div>
                <Link
                  href="/platform/school-activity"
                  className="whitespace-nowrap text-xs text-violet-300 hover:underline"
                >
                  Open activity
                </Link>
              </div>
              {panel.rows.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-500">
                  {panel.empty}
                </p>
              ) : (
                <ul className="space-y-1.5 text-sm">
                  {panel.rows.map((r) => (
                    <li
                      key={r.id}
                      className="flex items-center justify-between gap-3 rounded-lg bg-black/20 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <Link
                          href={`/platform/schools/${r.id}`}
                          className="block truncate font-medium text-white hover:underline"
                        >
                          {r.name}
                        </Link>
                        <span className="text-[11px] text-slate-500">
                          {r.students.toLocaleString()} students
                          {r.subscription
                            ? r.subscription.status === "ACTIVE"
                              ? ` \u00b7 ${r.subscription.daysLeft}d left`
                              : " \u00b7 expired"
                            : " \u00b7 no plan"}
                        </span>
                      </div>
                      <span className="whitespace-nowrap text-xs tabular-nums text-slate-300">
                        {panel.figure(r)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-white/10 bg-white/5 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold text-white">{t("platform.recentSchools")}</h2>
          <Link
            href="/platform/schools"
            className="text-sm text-violet-400 hover:underline"
          >
            {t("platform.viewAll")}
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-start text-slate-400">
                <th className="px-3 py-2">{t("platform.school")}</th>
                <th className="px-3 py-2">{t("platform.subdomain")}</th>
                <th className="px-3 py-2">{t("platform.status")}</th>
                <th className="px-3 py-2">{t("platform.users")}</th>
                <th className="px-3 py-2">{t("platform.created")}</th>
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
                    {t("platform.noSchoolsProvisionedYet")}
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
