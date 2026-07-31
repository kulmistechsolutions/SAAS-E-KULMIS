"use client";

import { useT, type TranslationKey } from "@/lib/i18n/provider";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  BookOpen,
  Database,
  GraduationCap,
  KeyRound,
  Mail,
  Palette,
  Receipt,
  School,
  Shield,
  Users,
  Wallet,
  ClipboardList,
  CalendarCheck,
  FileUp,
  Info,
  Layers,
  MapPin,
  Settings,
  TriangleAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

const NAV: {
  href: string;
  label: TranslationKey;
  icon: LucideIcon;
  exact?: boolean;
}[] = [
  { href: "/settings", label: "settingsSettingsNav.dashboard", icon: Settings, exact: true },
  { href: "/settings/school", label: "settingsSettingsNav.schoolInformation", icon: School },
  { href: "/settings/branding", label: "settingsSettingsNav.branding", icon: Palette },
  { href: "/settings/academic", label: "settingsSettingsNav.academic", icon: BookOpen },
  {
    href: "/settings/academic-structure",
    label: "settingsSettingsNav.academicStructure",
    icon: Layers,
  },
  { href: "/settings/villages", label: "settingsSettingsNav.villages", icon: MapPin },
  { href: "/settings/students", label: "settingsSettingsNav.students", icon: GraduationCap },
  { href: "/settings/teachers", label: "settingsSettingsNav.teachers", icon: Users },
  { href: "/settings/parents", label: "settingsSettingsNav.parents", icon: Users },
  {
    href: "/settings/examinations",
    label: "settingsSettingsNav.examinations",
    icon: ClipboardList,
  },
  { href: "/settings/fees", label: "settingsSettingsNav.fees", icon: Wallet },
  { href: "/settings/salary", label: "settingsSettingsNav.salary", icon: Receipt },
  { href: "/settings/expenses", label: "settingsSettingsNav.expenses", icon: Receipt },
  { href: "/settings/attendance", label: "settingsSettingsNav.attendance", icon: CalendarCheck },
  { href: "/settings/quiz", label: "settingsSettingsNav.onlineQuiz", icon: ClipboardList },
  { href: "/settings/notifications", label: "settingsSettingsNav.notifications", icon: Bell },
  { href: "/settings/email", label: "settingsSettingsNav.emailSMTP", icon: Mail },
  { href: "/settings/security", label: "settingsSettingsNav.security", icon: Shield },
  { href: "/settings/backup", label: "settingsSettingsNav.backup", icon: Database },
  { href: "/settings/system", label: "settingsSettingsNav.systemInfo", icon: Info },
  { href: "/settings/import-export", label: "settingsSettingsNav.importExport", icon: FileUp },
  { href: "/settings/subscription", label: "settingsSettingsNav.subscription", icon: Layers },
  { href: "/settings/license", label: "settingsSettingsNav.license", icon: KeyRound },
  { href: "/settings/danger-zone", label: "settingsSettingsNav.dangerZone", icon: TriangleAlert },
];

export function SettingsNav() {
  const t = useT();
  const pathname = usePathname();

  return (
    <nav className="space-y-0.5">
      {NAV.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
              active
                ? "bg-primary/10 font-medium text-primary"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {t(item.label)}
          </Link>
        );
      })}
    </nav>
  );
}
