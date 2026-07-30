"use client";


import { useT } from "@/lib/i18n/provider";
import { use, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, KeyRound, Pencil, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AccountStatusBadge } from "@/components/users/status-badge";
import { UserFormDialog } from "@/components/users/user-form-dialog";
import { ResetPasswordDialog } from "@/components/users/reset-password-dialog";
import { PermissionMatrix } from "@/components/users/permission-matrix";
import { dateTime, roleLabel } from "@/lib/users/format";
import { printUserProfile } from "@/lib/users/print";
import { getRole, getUser, sessionsForUser } from "@/lib/users/store";

export default function UserProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = useT();
  const { id } = use(params);
  const [editing, setEditing] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);

  const user = useMemo(() => getUser(id), [id]);
  const role = useMemo(() => (user ? getRole(user.role) : undefined), [user]);
  const sessions = useMemo(() => (user ? sessionsForUser(user.id) : []), [user]);

  if (!user) {
    return (
      <div className="space-y-4">
        <Link href="/users/list" className="inline-flex items-center gap-2 text-sm text-primary">
          <ArrowLeft className="h-4 w-4" />
          {t("users.back")}
        </Link>
        <p className="text-muted-foreground">{t("users.userNotFound")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link href="/users/list" className="inline-flex items-center gap-2 text-sm text-primary">
            <ArrowLeft className="h-4 w-4" />
            {t("users.allUsers")}
          </Link>
          <h1 className="mt-2 text-2xl font-bold">{user.fullName}</h1>
          <p className="mt-1 font-mono text-sm text-muted-foreground">{user.userId}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="h-9" onClick={() => setEditing(true)}>
            <Pencil className="me-2 h-4 w-4" />
            {t("users.edit")}
          </Button>
          <Button variant="outline" className="h-9" onClick={() => setResetOpen(true)}>
            <KeyRound className="me-2 h-4 w-4" />
            {t("users.resetPassword")}
          </Button>
          <Button variant="outline" className="h-9" onClick={() => printUserProfile(user)}>
            <Printer className="me-2 h-4 w-4" />
            {t("users.printProfile")}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <h2 className="font-semibold">{t("users.personalLoginInformation")}</h2>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2 text-sm">
              <Item label={t("users.username")} value={user.username} />
              <Item label={t("users.role")} value={roleLabel(user.role)} />
              <Item label={t("users.status")} value={<AccountStatusBadge status={user.status} />} />
              <Item label={t("users.lastLogin")} value={user.lastLogin ? dateTime(user.lastLogin) : "Never"} />
              <Item label={t("users.created")} value={dateTime(user.createdAt)} />
              <Item label={t("users.lastUpdated")} value={dateTime(user.updatedAt)} />
            </dl>
          </div>

          {role && (
            <div className="space-y-3">
              <h2 className="font-semibold">{t("users.rolePermissions")}</h2>
              <PermissionMatrix permissions={role.permissions} readOnly />
            </div>
          )}
        </div>

        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h2 className="font-semibold">{t("users.recentSessions")}</h2>
          <div className="mt-4 space-y-3">
            {sessions.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("users.noSessionHistory")}</p>
            ) : (
              sessions.slice(0, 6).map((s) => (
                <div key={s.id} className="rounded-lg border bg-secondary/30 p-3 text-xs">
                  <p className="font-medium">{dateTime(s.loginAt)}</p>
                  <p className="mt-1 text-muted-foreground">
                    {s.device} · {s.browser}
                  </p>
                  <p className="text-muted-foreground">{t("users.ip")} {s.ipAddress}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <UserFormDialog open={editing} user={user} onClose={() => setEditing(false)} />
      <ResetPasswordDialog
        open={resetOpen}
        userId={user.id}
        userName={user.fullName}
        onClose={() => setResetOpen(false)}
      />
    </div>
  );
}

function Item({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-medium">{value}</dd>
    </div>
  );
}
