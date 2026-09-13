import { useT, type TranslationKey } from "@/lib/i18n/provider";
import type { PlatformDashboard } from "@/lib/platform/types";
import {
  Ban,
  BadgeCheck,
  Building2,
  CalendarClock,
  GraduationCap,
  Users,
  UserCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * What the platform owner is asked about first.
 *
 * Six counts of people and schools, and nothing at all about who is paying —
 * so the one question the console exists to answer, "how many schools are on a
 * plan", had to be gone and looked up elsewhere. Expired is kept apart from
 * never-subscribed: one is a renewal conversation and the other a sales one,
 * and a single "no plan" number loses that.
 */
const CARDS: {
  key: keyof PlatformDashboard;
  label: TranslationKey | null;
  /** Used when there is no dictionary entry yet. */
  text?: string;
  icon: LucideIcon;
  chip: string;
  note?: (s: PlatformDashboard) => string;
}[] = [
  {
    key: "totalSchools",
    label: "platformSummaryCards.totalSchools",
    icon: Building2,
    chip: "bg-violet-500/15 text-violet-400",
    note: (s) => `${s.activeSchools} active · ${s.suspendedSchools} suspended`,
  },
  {
    key: "subscribedSchools",
    label: null,
    text: "On a subscription",
    icon: BadgeCheck,
    chip: "bg-emerald-500/15 text-emerald-400",
    note: (s) =>
      s.expiringSchools > 0
        ? `${s.expiringSchools} expiring within 14 days`
        : "None expiring soon",
  },
  {
    key: "expiredSchools",
    label: null,
    text: "Expired plans",
    icon: CalendarClock,
    chip: "bg-amber-500/15 text-amber-400",
    note: () => "Ran out — worth a renewal call",
  },
  {
    key: "unsubscribedSchools",
    label: null,
    text: "Never on a plan",
    icon: Ban,
    chip: "bg-rose-500/15 text-rose-400",
    note: () => "No subscription has ever been set",
  },
  {
    key: "totalStudents",
    label: "platformSummaryCards.totalStudents",
    icon: GraduationCap,
    chip: "bg-sky-500/15 text-sky-400",
    note: () => "Registered across every school",
  },
  {
    key: "totalTeachers",
    label: "platformSummaryCards.totalTeachers",
    icon: Users,
    chip: "bg-teal-500/15 text-teal-400",
  },
  {
    key: "totalParents",
    label: "platformSummaryCards.totalParents",
    icon: Users,
    chip: "bg-indigo-500/15 text-indigo-400",
  },
  {
    key: "activeSchools",
    label: "platformSummaryCards.activeSchools",
    icon: UserCheck,
    chip: "bg-lime-500/15 text-lime-400",
    note: (s) => `of ${s.totalSchools} provisioned`,
  },
];

export function PlatformSummaryCards({ summary }: { summary: PlatformDashboard }) {
  const t = useT();
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {CARDS.map((c) => (
        <div
          key={c.key}
          className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur"
        >
          <span
            className={cn(
              "mb-2 flex h-8 w-8 items-center justify-center rounded-lg",
              c.chip,
            )}
          >
            <c.icon className="h-4 w-4" />
          </span>
          <p className="text-2xl font-bold tabular-nums text-white">
            {summary[c.key].toLocaleString()}
          </p>
          <p className="mt-1 text-[11px] text-slate-400">
            {c.label ? t(c.label) : c.text}
          </p>
          {c.note && (
            <p className="mt-0.5 truncate text-[10px] text-slate-500">
              {c.note(summary)}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
