"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Download,
  Eye,
  KeyRound,
  Lock,
  Pencil,
  Plus,
  Printer,
  Trash2,
  Unlock,
  UserX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { Select } from "@/components/ui/select";
import { AccountStatusBadge } from "@/components/users/status-badge";
import { UserFormDialog } from "@/components/users/user-form-dialog";
import { ResetPasswordDialog } from "@/components/users/reset-password-dialog";
import { ConfirmDialog } from "@/components/students/confirm-dialog";
import { BUILT_IN_ROLES, dateTime, roleLabel } from "@/lib/users/format";
import { printUserListReport } from "@/lib/users/print";
import {
  deleteUser,
  exportUsersCsv,
  getUser,
  listUsers,
  setAccountStatus,
  useUsersState,
} from "@/lib/users/store";
import type { AccountStatus } from "@/lib/users/types";
import { toast } from "@/lib/toast";

const PAGE_SIZE = 15;

export default function UsersListPage() {
  const [mounted, setMounted] = useState(false);
  const state = useUsersState();
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState<AccountStatus | "">("");
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [resetId, setResetId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);

  const rows = useMemo(
    () =>
      mounted
        ? listUsers({
            search,
            role: role || undefined,
            status: status || undefined,
          })
        : [],
    [mounted, search, role, status, state],
  );

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const editUser = editId ? getUser(editId) ?? null : null;
  const resetUser = resetId ? getUser(resetId) : null;

  const roleOptions = [
    ...BUILT_IN_ROLES.map((r) => ({ id: r, label: roleLabel(r) })),
    ...state.roles.filter((r) => !r.builtIn).map((r) => ({ id: r.name, label: r.label })),
  ];

  if (!mounted) {
    return <div className="flex h-64 items-center justify-center text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">All Users</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage system accounts, roles, and access status.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="h-9"
            onClick={() => printUserListReport(rows, "User List Report")}
          >
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
          <Button variant="outline" className="h-9" onClick={() => exportUsersCsv(rows)}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Button className="h-9" onClick={() => setShowCreate(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create User
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search user ID, username, name…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="h-9 max-w-xs"
        />
        <Select
          value={role}
          onChange={(e) => {
            setRole(e.target.value);
            setPage(1);
          }}
          className="h-9 min-w-[180px]"
        >
          <option value="">All roles</option>
          {roleOptions.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </Select>
        <Select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as AccountStatus | "");
            setPage(1);
          }}
          className="h-9 min-w-[140px]"
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
          <option value="LOCKED">Locked</option>
        </Select>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-sm">
            <thead className="sticky top-0 bg-secondary text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">#</th>
                <th className="px-4 py-2.5 font-medium">User ID</th>
                <th className="px-4 py-2.5 font-medium">Full Name</th>
                <th className="px-4 py-2.5 font-medium">Username</th>
                <th className="px-4 py-2.5 font-medium">Role</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Last Login</th>
                <th className="px-4 py-2.5 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-4 py-2.5 text-muted-foreground">{r.serial}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">{r.userId}</td>
                  <td className="px-4 py-2.5 font-medium">{r.fullName}</td>
                  <td className="px-4 py-2.5">{r.username}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{r.roleLabel}</td>
                  <td className="px-4 py-2.5">
                    <AccountStatusBadge status={r.status} />
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {r.lastLogin ? dateTime(r.lastLogin) : "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex gap-1">
                      <Link
                        href={`/users/${r.id}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-secondary"
                      >
                        <Eye className="h-4 w-4" />
                      </Link>
                      <Button variant="ghost" className="h-8 w-8 p-0" onClick={() => setEditId(r.id)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" className="h-8 w-8 p-0" onClick={() => setResetId(r.id)}>
                        <KeyRound className="h-4 w-4" />
                      </Button>
                      {r.status === "ACTIVE" ? (
                        <>
                          <Button
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            onClick={() => {
                              setAccountStatus(r.id, "INACTIVE");
                              toast("User deactivated", "success");
                            }}
                          >
                            <UserX className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            onClick={() => {
                              setAccountStatus(r.id, "LOCKED");
                              toast("Account locked", "success");
                            }}
                          >
                            <Lock className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <Button
                          variant="ghost"
                          className="h-8 w-8 p-0 text-emerald-600"
                          onClick={() => {
                            setAccountStatus(r.id, "ACTIVE");
                            toast("Account activated", "success");
                          }}
                        >
                          <Unlock className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        className="h-8 w-8 p-0 text-rose-600"
                        onClick={() => setDeleteId(r.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length > PAGE_SIZE && (
          <div className="border-t px-4 py-3">
            <Pagination
              page={page}
              pageCount={pageCount}
              total={rows.length}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>

      <UserFormDialog open={showCreate} onClose={() => setShowCreate(false)} />
      <UserFormDialog
        open={!!editUser}
        user={editUser}
        onClose={() => setEditId(null)}
      />
      <ResetPasswordDialog
        open={!!resetId}
        userId={resetId}
        userName={resetUser?.fullName}
        onClose={() => setResetId(null)}
      />
      <ConfirmDialog
        open={!!deleteId}
        title="Delete User"
        message="This action removes the user account. Super Administrator accounts cannot be deleted if they are the last one."
        onConfirm={() => {
          if (!deleteId) return;
          const res = deleteUser(deleteId);
          if (!res.ok) toast(res.error ?? "Delete failed", "error");
          else toast("User deleted", "success");
          setDeleteId(null);
        }}
        onClose={() => setDeleteId(null)}
      />
    </div>
  );
}
