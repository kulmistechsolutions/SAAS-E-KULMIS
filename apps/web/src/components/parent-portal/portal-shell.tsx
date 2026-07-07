"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  BookOpen,
  CalendarCheck,
  ClipboardList,
  Download,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Receipt,
  ScrollText,
  User,
  Users,
  Wallet,
} from "lucide-react";
import { useSchoolBranding } from "@/lib/settings/use-school-branding";
import { ChildSelector } from "@/components/parents/child-selector";
import { logoutParent, unreadNotificationCount } from "@/lib/parent-portal/store";
import { usePortal } from "./portal-context";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const NAV = [
  { href: "/parent-portal", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/parent-portal/profile", label: "My Profile", icon: User },
  { href: "/parent-portal/children", label: "My Children", icon: Users },
  { href: "/parent-portal/attendance", label: "Attendance", icon: CalendarCheck },
  { href: "/parent-portal/exams", label: "Exam Results", icon: BookOpen },
  { href: "/parent-portal/quizzes", label: "Online Quizzes", icon: ClipboardList },
  { href: "/parent-portal/fees", label: "Fee Information", icon: Wallet },
  { href: "/parent-portal/payments", label: "Payment History", icon: Receipt },
  { href: "/parent-portal/invoices", label: "Invoices", icon: ScrollText },
  { href: "/parent-portal/history", label: "Academic History", icon: GraduationCap },
  { href: "/parent-portal/announcements", label: "Announcements", icon: Megaphone },
  { href: "/parent-portal/notifications", label: "Notifications", icon: Bell },
  { href: "/parent-portal/downloads", label: "Download Center", icon: Download },
];

export function PortalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { parent, children: childList, selectedChild, selectedChildId, setChild } = usePortal();
  const branding = useSchoolBranding();

  const unread = unreadNotificationCount(parent.id);

  function handleLogout() {
    logoutParent();
    router.push("/parent-portal/login");
  }

  return (
    <div className="flex min-h-screen bg-secondary/30">
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-card lg:flex">
        <div className="border-b p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-sm font-bold text-white">
              {branding.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={branding.logoUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                branding.name.slice(0, 2).toUpperCase()
              )}
            </div>
            <div>
              <p className="text-sm font-bold text-primary">{branding.name}</p>
              <p className="text-[11px] text-muted-foreground">Parent Portal</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
          {NAV.map((item) => {
            const active = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span className="flex-1">{item.label}</span>
                {item.href.includes("notifications") && unread > 0 && (
                  <Badge className="h-5 min-w-5 justify-center px-1 text-[10px]">{unread}</Badge>
                )}
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
              <p className="text-xs text-muted-foreground">Welcome back</p>
              <p className="font-semibold">{parent.name}</p>
            </div>
            <div className="flex items-center gap-3">
              {unread > 0 && (
                <Link
                  href="/parent-portal/notifications"
                  className="relative rounded-lg border p-2 hover:bg-secondary"
                >
                  <Bell className="h-4 w-4" />
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] text-white">
                    {unread}
                  </span>
                </Link>
              )}
              <div className="text-right text-xs text-muted-foreground">
                <p>{parent.code}</p>
                <p>{selectedChild?.fullName ?? "Select a child"}</p>
              </div>
            </div>
          </div>
          {childList.length > 1 && selectedChildId && (
            <div className="border-t px-4 py-2 lg:px-6">
              <ChildSelector
                students={childList}
                selectedId={selectedChildId}
                onChange={setChild}
              />
            </div>
          )}
          <nav className="flex gap-1 overflow-x-auto border-t px-2 py-2 lg:hidden">
            {NAV.slice(0, 8).map((item) => {
              const active = item.exact
                ? pathname === item.href
                : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "shrink-0 rounded-md px-2.5 py-1.5 text-xs font-medium",
                    active ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground",
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
