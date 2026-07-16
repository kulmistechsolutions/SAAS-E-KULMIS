"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { refreshAcademics } from "@/lib/academics/store";
import { refreshStudents } from "@/lib/students/store";
import { refreshSettings } from "@/lib/settings/store";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { Toaster } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { SubscriptionBanner } from "@/components/subscriptions/subscription-banner";
import {
  isFullAccessRole,
  isRouteAllowedForRole,
  landingRouteForRole,
} from "@/lib/rbac/routes";

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMINISTRATOR: "Super Administrator",
  ADMINISTRATOR: "Administrator",
  ACADEMIC_MANAGER: "Academic Manager",
  FINANCE_OFFICER: "Finance Officer",
  ATTENDANCE_OFFICER: "Attendance Officer",
  EXAM_MANAGER: "Exam Manager",
  RECEPTION_OFFICER: "Reception Officer",
  LIBRARIAN: "Librarian",
  TEACHER: "Teacher",
  PARENT: "Parent",
  STUDENT: "Student",
};

export default function AppLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setMounted(true);
    setCollapsed(localStorage.getItem("sidebar-collapsed") === "true");
  }, []);

  useEffect(() => {
    if (!mounted || loading || user) return;
    router.replace("/login");
  }, [mounted, loading, user, router]);

  useEffect(() => {
    if (!user || user.role !== "TEACHER") return;
    router.replace("/teacher-portal");
  }, [user, router]);

  useEffect(() => {
    if (user && user.role !== "TEACHER") {
      void refreshAcademics();
      void refreshStudents();
      // The settings store may have already been touched by an unauthenticated
      // page (e.g. /login) before this session existed, fetching only public
      // branding. Re-fetch now that we have a token so the full school
      // settings (used by every receipt/PDF) load, not just the seed cache.
      void refreshSettings();
    }
  }, [user]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!user || !pathname || isFullAccessRole(user.role) || user.role === "TEACHER") return;
    if (!isRouteAllowedForRole(user.role, pathname)) {
      router.replace(landingRouteForRole(user.role));
    }
  }, [user, pathname, router]);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar-collapsed", String(next));
      return next;
    });
  }

  if (!mounted || loading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-muted/40"
        suppressHydrationWarning
        aria-busy="true"
        aria-label="Loading"
      >
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"
          suppressHydrationWarning
        />
      </div>
    );
  }

  if (!user || user.role === "TEACHER") return null;

  const routeBlocked =
    pathname != null &&
    !isFullAccessRole(user.role) &&
    !isRouteAllowedForRole(user.role, pathname);

  const roleLabel = ROLE_LABEL[user.role] ?? user.role;
  const sidebarWidth = collapsed ? "w-20" : "w-64";

  return (
    <div
      className={cn(
        "flex min-h-screen bg-muted/40 [--app-sidebar-w:0px]",
        collapsed ? "lg:[--app-sidebar-w:5rem]" : "lg:[--app-sidebar-w:16rem]",
      )}
      suppressHydrationWarning
    >
      <aside
        className={cn(
          "hidden shrink-0 transition-[width] duration-300 ease-in-out lg:block",
          sidebarWidth,
        )}
      >
        <div
          className={cn(
            "fixed inset-y-0 left-0 z-40 transition-[width] duration-300 ease-in-out",
            sidebarWidth,
          )}
        >
          <Sidebar collapsed={collapsed} onToggleCollapse={toggleCollapsed} />
        </div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            onClick={() => setMobileOpen(false)}
            className="absolute inset-0 bg-black/50"
            aria-hidden
          />
          <div className="absolute inset-y-0 left-0 w-64 shadow-xl">
            <Sidebar onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <div className="relative z-0 flex min-w-0 flex-1 flex-col">
        <Topbar
          onMenuClick={() => setMobileOpen(true)}
          userName={user.username}
          userRole={roleLabel}
        />
        <main className="flex-1 p-4 sm:p-6">
          {routeBlocked ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <p className="text-sm">Redirecting to your dashboard…</p>
            </div>
          ) : (
            <>
              <SubscriptionBanner />
              {children}
            </>
          )}
        </main>
      </div>
      <Toaster />
    </div>
  );
}
