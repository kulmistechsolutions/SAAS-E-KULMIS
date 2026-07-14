"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Bell, ChevronDown, LogOut, Menu, Search, User } from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useAuth } from "@/lib/auth";
import { activeAcademicYear, ensureAcademicsLoaded, useAcademicsState } from "@/lib/academics/store";
import { toast } from "@/lib/toast";

interface TopbarProps {
  onMenuClick: () => void;
  userName: string;
  userRole: string;
}

export function Topbar({ onMenuClick, userName, userRole }: TopbarProps) {
  const router = useRouter();
  const { logout, user } = useAuth();
  const academics = useAcademicsState();
  const isTeacher = user?.role === "TEACHER";
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const activeYear =
    academics.academicYears.find((y) => y.status === "ACTIVE")?.name ||
    activeAcademicYear() ||
    "—";

  useEffect(() => {
    void ensureAcademicsLoaded();
  }, []);

  function onSearchKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && query.trim()) {
      router.push(`/students?q=${encodeURIComponent(query.trim())}`);
    }
  }

  function handleLogout() {
    setMenuOpen(false);
    logout();
    router.replace("/login");
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur-md sm:px-6">
      {/* Mobile menu */}
      <button
        onClick={onMenuClick}
        aria-label="Open menu"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Search */}
      <div className="relative hidden max-w-md flex-1 items-center sm:flex">
        <Search className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onSearchKey}
          placeholder="Search students, teachers, parents..."
          className="h-10 w-full rounded-lg border border-input bg-secondary/50 pl-9 pr-16 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:bg-background"
        />
        <kbd className="absolute right-3 hidden items-center gap-0.5 rounded border bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground md:inline-flex">
          Ctrl + K
        </kbd>
      </div>

      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        {/* Academic year */}
        <button
          onClick={() => toast(`Active academic year: ${activeYear}`, "info")}
          className="hidden items-center gap-2 rounded-lg border border-input bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary md:inline-flex"
        >
          <span className="text-muted-foreground">Academic Year:</span>
          <span>{activeYear}</span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </button>

        <ThemeToggle />

        {/* Notifications */}
        <button
          onClick={() => toast("You have 12 unread notifications", "info")}
          aria-label="Notifications"
          className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-input text-muted-foreground transition-colors hover:bg-secondary"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
            12
          </span>
        </button>

        {/* User */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center gap-2 rounded-lg px-1.5 py-1 transition-colors hover:bg-secondary"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-sm font-semibold text-white">
              {userName.charAt(0).toUpperCase()}
            </span>
            <span className="hidden text-left leading-tight sm:block">
              <span className="block text-sm font-semibold text-foreground">
                {userName}
              </span>
              <span className="block text-[11px] text-muted-foreground">
                {userRole}
              </span>
            </span>
            <ChevronDown className="hidden h-4 w-4 text-muted-foreground sm:block" />
          </button>

          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute right-0 top-full z-50 mt-2 w-48 overflow-hidden rounded-lg border bg-card py-1 shadow-lg">
                <div className="border-b px-3 py-2">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {userName}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {userRole}
                  </p>
                </div>
                {isTeacher ? (
                  <Link
                    href="/profile"
                    onClick={() => setMenuOpen(false)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground transition-colors hover:bg-secondary"
                  >
                    <User className="h-4 w-4 text-muted-foreground" />
                    My Profile
                  </Link>
                ) : (
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      toast("Profile page — coming soon", "info");
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground transition-colors hover:bg-secondary"
                  >
                    <User className="h-4 w-4 text-muted-foreground" />
                    My Profile
                  </button>
                )}
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-rose-600 transition-colors hover:bg-secondary dark:text-rose-400"
                >
                  <LogOut className="h-4 w-4" />
                  Log out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
