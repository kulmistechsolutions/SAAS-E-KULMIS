
import { useT, type TranslationKey } from "@/lib/i18n/provider";
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
  label: TranslationKey;
  icon: LucideIcon;
  chip: string;
  href: string;
}[] = [
  { key: "school", label: "settingsSummaryCards.schoolInformation", icon: School, chip: "bg-blue-500/15 text-blue-600", href: "/settings/school" },
  { key: "academic", label: "settingsSummaryCards.academicSettings", icon: BookOpen, chip: "bg-indigo-500/15 text-indigo-600", href: "/settings/academic" },
  { key: "students", label: "settingsSummaryCards.studentSettings", icon: GraduationCap, chip: "bg-violet-500/15 text-violet-600", href: "/settings/students" },
  { key: "teachers", label: "settingsSummaryCards.teacherSettings", icon: Users, chip: "bg-sky-500/15 text-sky-600", href: "/settings/teachers" },
  { key: "parents", label: "settingsSummaryCards.parentSettings", icon: Users, chip: "bg-teal-500/15 text-teal-600", href: "/settings/parents" },
  { key: "examinations", label: "settingsSummaryCards.examinationSettings", icon: BookOpen, chip: "bg-amber-500/15 text-amber-600", href: "/settings/examinations" },
  { key: "fees", label: "settingsSummaryCards.feeSettings", icon: Wallet, chip: "bg-emerald-500/15 text-emerald-600", href: "/settings/fees" },
  { key: "notifications", label: "settingsSummaryCards.notificationSettings", icon: Bell, chip: "bg-rose-500/15 text-rose-600", href: "/settings/notifications" },
  { key: "security", label: "settingsSummaryCards.securitySettings", icon: Shield, chip: "bg-slate-500/15 text-slate-600", href: "/settings/security" },
  { key: "branding", label: "settingsSummaryCards.branding", icon: Palette, chip: "bg-fuchsia-500/15 text-fuchsia-600", href: "/settings/branding" },
  { key: "system", label: "settingsSummaryCards.systemInformation", icon: Database, chip: "bg-cyan-500/15 text-cyan-600", href: "/settings/system" },
];

export function SettingsSummaryCards({
  summary,
}: {
  summary: SettingsDashboardSummary;
}) {
  const t = useT();
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
          <p className="text-sm font-medium leading-tight">{t(c.label)}</p>
        </a>
      ))}
      <div className="col-span-2 rounded-xl border bg-gradient-to-br from-primary/10 to-transparent p-4 sm:col-span-3 lg:col-span-2">
        <p className="text-xs text-muted-foreground">{t("settingsSummaryCards.activeSchool")}</p>
        <p className="mt-1 font-bold">{summary.schoolName}</p>
        <p className="mt-2 text-xs text-muted-foreground">{t("settingsSummaryCards.academicYear")} {summary.activeAcademicYear}</p>
      </div>
    </div>
  );
}
