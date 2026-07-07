"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { Toaster } from "@/lib/toast";
import { cn } from "@/lib/utils";

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMINISTRATOR: "Super Administrator",
  ADMINISTRATOR: "Administrator",
  ACADEMIC_MANAGER: "Academic Manager",
  FINANCE_OFFICER: "Finance Officer",
  ATTENDANCE_OFFICER: "Attendance Officer",
  EXAM_MANAGER: "Exam Manager",
  RECEPTION_OFFICER: "Reception Officer",
  TEACHER: "Teacher",
  PARENT: "Parent",
  STUDENT: "Student",
};

export default function AppLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem("sidebar-collapsed") === "true");
  }, []);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar-collapsed", String(next));
      return next;
    });
  }

  if (loading)
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  if (!user) return null;

  const roleLabel = ROLE_LABEL[user.role] ?? user.role;
  const sidebarWidth = collapsed ? "w-20" : "w-64";

  return (
    <div className="flex min-h-screen bg-muted/40">
      {/* Desktop sidebar */}
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

      {/* Mobile drawer */}
      <div
        className={cn(
          "fixed inset-0 z-50 lg:hidden",
          mobileOpen ? "pointer-events-auto" : "pointer-events-none",
        )}
      >
        <div
          onClick={() => setMobileOpen(false)}
          className={cn(
            "absolute inset-0 bg-black/50 transition-opacity",
            mobileOpen ? "opacity-100" : "opacity-0",
          )}
        />
        <div
          className={cn(
            "absolute inset-y-0 left-0 w-64 shadow-xl transition-transform duration-300",
            mobileOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <Sidebar onNavigate={() => setMobileOpen(false)} />
        </div>
      </div>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          onMenuClick={() => setMobileOpen(true)}
          userName={user.username}
          userRole={roleLabel}
        />
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
      <Toaster />
    </div>
  );
}
