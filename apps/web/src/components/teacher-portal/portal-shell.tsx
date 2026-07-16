"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  Bell,
  BookOpen,
  CalendarCheck,
  CalendarDays,
  ClipboardList,
  FileText,
  LayoutDashboard,
  LogOut,
  Megaphone,
  UserCircle,
  Users,
} from "lucide-react";
import { useSchoolBranding } from "@/lib/settings/use-school-branding";
import { logoutTeacher } from "@/lib/teacher-portal/store";
import { TEACHER_PORTAL_NAV } from "@/lib/teacher-portal/routes";
import { useTeacherPortal } from "./portal-context";
import { cn } from "@/lib/utils";

const ICONS: Record<string, typeof LayoutDashboard> = {
  Dashboard: LayoutDashboard,
  "My Profile": UserCircle,
  "My Assignments": CalendarDays,
  "My Students": Users,
  Attendance: CalendarCheck,
  Examinations: FileText,
  "Online Quiz": ClipboardList,
  Results: BarChart3,
  Announcements: Megaphone,
  Notifications: Bell,
};

export function TeacherPortalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { teacher, canViewStudents } = useTeacherPortal();
  const branding = useSchoolBranding();

  const nav = TEACHER_PORTAL_NAV.filter(
    (item) => !("requiresStudents" in item && item.requiresStudents) || canViewStudents,
  );

  function handleLogout() {
    logoutTeacher();
    router.push("/teacher-portal/login");
  }

  return (
    <div className="flex min-h-screen bg-secondary/30">
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-card lg:flex">
        <div className="border-b p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-sm font-bold text-white">
              {branding.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={branding.logoUrl} alt="" className="h-full w-full object-contain" />
              ) : (
                <BookOpen className="h-5 w-5" />
              )}
            </div>
            <div>
              <p className="text-sm font-bold text-primary">{branding.name}</p>
              <p className="text-[11px] text-muted-foreground">Teacher Portal</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
          {nav.map((item) => {
            const Icon = ICONS[item.label] ?? LayoutDashboard;
            const active =
              "exact" in item && item.exact
                ? pathname === item.href
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-emerald-500/10 font-medium text-emerald-700 dark:text-emerald-400"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t p-3">
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 lg:px-6">
            <div>
              <p className="text-xs text-muted-foreground">Teacher Portal</p>
              <p className="font-semibold">{teacher.fullName}</p>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <p>{teacher.code}</p>
              <p>{teacher.shift} shift</p>
            </div>
          </div>
          <nav className="flex gap-1 overflow-x-auto border-t px-2 py-2 lg:hidden">
            {nav.slice(0, 7).map((item) => {
              const active =
                "exact" in item && item.exact
                  ? pathname === item.href
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "shrink-0 rounded-md px-2.5 py-1.5 text-xs font-medium",
                    active
                      ? "bg-emerald-600 text-white"
                      : "bg-secondary text-muted-foreground",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </header>
        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
