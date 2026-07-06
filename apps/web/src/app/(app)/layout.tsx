"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { UserRole } from "@ekulmis/shared";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { cn } from "@/lib/utils";

function Clock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!now) return null;
  return (
    <span className="hidden text-sm text-muted-foreground sm:inline">
      {now.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
      })}{" "}
      · {now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
    </span>
  );
}

const NAV: { href: string; label: string; roles?: UserRole[] }[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/students", label: "Students", roles: ["ADMINISTRATOR"] },
  { href: "/teachers", label: "Teachers", roles: ["ADMINISTRATOR"] },
  {
    href: "/finance",
    label: "Finance",
    roles: ["ADMINISTRATOR", "FINANCE_OFFICER"],
  },
  { href: "/users", label: "Users", roles: ["ADMINISTRATOR"] },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading)
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  if (!user) return null;

  const items = NAV.filter((n) => !n.roles || n.roles.includes(user.role));

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 border-r bg-card p-4 md:block">
        <div className="mb-6 px-2">
          <span className="text-xl font-bold text-primary">eKulmis</span>
        </div>
        <nav className="space-y-1">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "block rounded-md px-3 py-2 text-sm font-medium transition-colors",
                pathname === item.href
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground hover:bg-secondary",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-background/80 px-6 py-3 backdrop-blur">
          <Clock />
          <div className="flex items-center gap-3">
            <div className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">
                {user.username}
              </span>{" "}
              <span className="rounded bg-secondary px-2 py-0.5 text-xs">
                {user.role}
              </span>
            </div>
            <ThemeToggle />
            <Button variant="outline" onClick={logout}>
              Log out
            </Button>
          </div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
