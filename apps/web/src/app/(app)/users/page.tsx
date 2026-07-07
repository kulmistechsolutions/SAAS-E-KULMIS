"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bell, ChevronRight, List, Plus, Shield, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UsersSummaryCards } from "@/components/users/summary-cards";
import { AccountStatusBadge } from "@/components/users/status-badge";
import { UserFormDialog } from "@/components/users/user-form-dialog";
import { dateTime } from "@/lib/users/format";
import { dashboardSummary, listUsers, useUsersState } from "@/lib/users/store";

const QUICK = [
  { href: "/users/list", label: "All Users", desc: "Search, filter & manage accounts", icon: List },
  { href: "/users/roles", label: "Roles & Permissions", desc: "RBAC matrix & custom roles", icon: Shield },
  { href: "/users/reports", label: "User Reports", desc: "Login history & role summary", icon: FileText },
];

export default function UsersDashboardPage() {
  const [mounted, setMounted] = useState(false);
  const state = useUsersState();
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => setMounted(true), []);

  const summary = useMemo(() => (mounted ? dashboardSummary() : null), [mounted, state]);
  const recent = useMemo(() => (mounted ? listUsers().slice(0, 8) : []), [mounted, state]);
  const unread = state.notifications.filter((n) => !n.read).length;

  if (!mounted) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        Loading users…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">User Management</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Centralized control over accounts, roles, and access permissions.
          </p>
        </div>
        <Button className="h-9" onClick={() => setShowCreate(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create User
        </Button>
      </div>

      {summary && <UsersSummaryCards summary={summary} />}

      <div className="grid gap-4 sm:grid-cols-3">
        {QUICK.map((q) => (
          <Link
            key={q.href}
            href={q.href}
            className="group rounded-xl border bg-card p-4 shadow-sm transition hover:border-primary/30 hover:shadow-md"
          >
            <div className="flex items-start justify-between">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <q.icon className="h-5 w-5" />
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
            </div>
            <p className="mt-3 font-semibold">{q.label}</p>
            <p className="mt-1 text-xs text-muted-foreground">{q.desc}</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h2 className="font-semibold">Recent Users</h2>
            <Link href="/users/list" className="text-xs font-medium text-primary hover:underline">
              View all
            </Link>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-secondary text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">User</th>
                <th className="px-4 py-2 font-medium">Role</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-4 py-2.5">
                    <Link href={`/users/${r.id}`} className="font-medium hover:text-primary">
                      {r.fullName}
                    </Link>
                    <p className="text-xs text-muted-foreground">{r.username}</p>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{r.roleLabel}</td>
                  <td className="px-4 py-2.5">
                    <AccountStatusBadge status={r.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-xl border bg-card shadow-sm">
          <div className="flex items-center gap-2 border-b px-4 py-3">
            <Bell className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold">Admin Notifications</h2>
            {unread > 0 && (
              <span className="rounded-full bg-rose-500 px-2 py-0.5 text-xs text-white">
                {unread}
              </span>
            )}
          </div>
          <div className="divide-y">
            {state.notifications.slice(0, 6).map((n) => (
              <div key={n.id} className="px-4 py-3 text-sm">
                <p className={n.read ? "text-muted-foreground" : "font-medium"}>{n.message}</p>
                <p className="mt-1 text-xs text-muted-foreground">{dateTime(n.at)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <UserFormDialog open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  );
}
