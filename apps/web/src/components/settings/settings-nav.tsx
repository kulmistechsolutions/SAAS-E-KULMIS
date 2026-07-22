"use client";

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
  Settings,
  TriangleAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

const NAV: {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
}[] = [
  { href: "/settings", label: "Dashboard", icon: Settings, exact: true },
  { href: "/settings/school", label: "School Information", icon: School },
  { href: "/settings/branding", label: "Branding", icon: Palette },
  { href: "/settings/academic", label: "Academic", icon: BookOpen },
  { href: "/settings/students", label: "Students", icon: GraduationCap },
  { href: "/settings/teachers", label: "Teachers", icon: Users },
  { href: "/settings/parents", label: "Parents", icon: Users },
  {
    href: "/settings/examinations",
    label: "Examinations",
    icon: ClipboardList,
  },
  { href: "/settings/fees", label: "Fees", icon: Wallet },
  { href: "/settings/salary", label: "Salary", icon: Receipt },
  { href: "/settings/expenses", label: "Expenses", icon: Receipt },
  { href: "/settings/attendance", label: "Attendance", icon: CalendarCheck },
  { href: "/settings/quiz", label: "Online Quiz", icon: ClipboardList },
  { href: "/settings/notifications", label: "Notifications", icon: Bell },
  { href: "/settings/email", label: "Email / SMTP", icon: Mail },
  { href: "/settings/security", label: "Security", icon: Shield },
  { href: "/settings/backup", label: "Backup", icon: Database },
  { href: "/settings/system", label: "System Info", icon: Info },
  { href: "/settings/import-export", label: "Import / Export", icon: FileUp },
  { href: "/settings/subscription", label: "Subscription", icon: Layers },
  { href: "/settings/license", label: "License", icon: KeyRound },
  { href: "/settings/danger-zone", label: "Danger Zone", icon: TriangleAlert },
];

export function SettingsNav() {
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
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
