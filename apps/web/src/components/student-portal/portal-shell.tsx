"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CalendarCheck, FileText, LayoutDashboard, LogOut, Wallet } from "lucide-react";
import { studentPortalLogout } from "@/lib/student-portal/api";
import type { StudentPortalMe } from "@/lib/student-portal/api";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/student-portal", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/student-portal/results", label: "Results", icon: FileText },
  { href: "/student-portal/attendance", label: "Attendance", icon: CalendarCheck },
  { href: "/student-portal/fees", label: "Fees", icon: Wallet },
];

export function StudentPortalShell({
  me,
  children,
}: {
  me: StudentPortalMe;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  function signOut() {
    studentPortalLogout();
    router.replace("/student-portal/login");
  }

  return (
    <div className="min-h-screen bg-secondary/30">
      <header className="border-b bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-sm font-semibold leading-tight">{me.fullName}</p>
            <p className="text-xs text-muted-foreground">
              {me.code} · {me.class.name}
              {me.section ? ` · ${me.section.name}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={signOut}
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
        <nav className="mx-auto flex max-w-4xl gap-1 overflow-x-auto px-4 pb-2">
          {NAV.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-secondary",
                )}
              >
                <item.icon className="h-4 w-4" /> {item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6">{children}</main>
    </div>
  );
}
