"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { UserRole } from "@ekulmis/shared";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
      <aside className="w-60 shrink-0 border-r bg-card p-4">
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
        <header className="flex items-center justify-between border-b bg-background px-6 py-3">
          <div className="text-sm text-muted-foreground">
            Signed in as{" "}
            <span className="font-medium text-foreground">{user.username}</span>{" "}
            <span className="rounded bg-secondary px-2 py-0.5 text-xs">
              {user.role}
            </span>
          </div>
          <Button variant="outline" onClick={logout}>
            Log out
          </Button>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
