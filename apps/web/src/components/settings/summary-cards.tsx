import type { SettingsDashboardSummary } from "@/lib/settings/types";
import {
  Bell,
  BookOpen,
  Database,
  GraduationCap,
  Palette,
  School,
  Shield,
  Users,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const CARDS: {
  key: string;
  label: string;
  icon: LucideIcon;
  chip: string;
  href: string;
}[] = [
  { key: "school", label: "School Information", icon: School, chip: "bg-blue-500/15 text-blue-600", href: "/settings/school" },
  { key: "academic", label: "Academic Settings", icon: BookOpen, chip: "bg-indigo-500/15 text-indigo-600", href: "/settings/academic" },
  { key: "students", label: "Student Settings", icon: GraduationCap, chip: "bg-violet-500/15 text-violet-600", href: "/settings/students" },
  { key: "teachers", label: "Teacher Settings", icon: Users, chip: "bg-sky-500/15 text-sky-600", href: "/settings/teachers" },
  { key: "parents", label: "Parent Settings", icon: Users, chip: "bg-teal-500/15 text-teal-600", href: "/settings/parents" },
  { key: "examinations", label: "Examination Settings", icon: BookOpen, chip: "bg-amber-500/15 text-amber-600", href: "/settings/examinations" },
  { key: "fees", label: "Fee Settings", icon: Wallet, chip: "bg-emerald-500/15 text-emerald-600", href: "/settings/fees" },
  { key: "notifications", label: "Notification Settings", icon: Bell, chip: "bg-rose-500/15 text-rose-600", href: "/settings/notifications" },
  { key: "security", label: "Security Settings", icon: Shield, chip: "bg-slate-500/15 text-slate-600", href: "/settings/security" },
  { key: "backup", label: "Backup Settings", icon: Database, chip: "bg-orange-500/15 text-orange-600", href: "/settings/backup" },
  { key: "branding", label: "Branding", icon: Palette, chip: "bg-fuchsia-500/15 text-fuchsia-600", href: "/settings/branding" },
  { key: "system", label: "System Information", icon: Database, chip: "bg-cyan-500/15 text-cyan-600", href: "/settings/system" },
];

export function SettingsSummaryCards({
  summary,
}: {
  summary: SettingsDashboardSummary;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      {CARDS.map((c) => (
        <a
          key={c.key}
          href={c.href}
          className="rounded-xl border bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
        >
          <span className={cn("mb-2 flex h-8 w-8 items-center justify-center rounded-lg", c.chip)}>
            <c.icon className="h-4 w-4" />
          </span>
          <p className="text-sm font-medium leading-tight">{c.label}</p>
        </a>
      ))}
      <div className="col-span-2 rounded-xl border bg-gradient-to-br from-primary/10 to-transparent p-4 sm:col-span-3 lg:col-span-2">
        <p className="text-xs text-muted-foreground">Active school</p>
        <p className="mt-1 font-bold">{summary.schoolName}</p>
        <p className="mt-2 text-xs text-muted-foreground">Academic year {summary.activeAcademicYear}</p>
      </div>
    </div>
  );
}
