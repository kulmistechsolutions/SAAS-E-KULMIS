"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { BUILT_IN_ROLES, roleLabel } from "@/lib/users/format";
import { createUser, getUsersState, updateUser } from "@/lib/users/store";
import type { AccountStatus, SystemRole, SystemUser } from "@/lib/users/types";
import { toast } from "@/lib/toast";

interface UserFormDialogProps {
  open: boolean;
  user?: SystemUser | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export function UserFormDialog({ open, user, onClose, onSuccess }: UserFormDialogProps) {
  const isEdit = !!user;
  const roles = getUsersState().roles;

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<SystemRole>("ADMINISTRATOR");
  const [status, setStatus] = useState<AccountStatus>("ACTIVE");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (user) {
      setFullName(user.fullName);
      setUsername(user.username);
      setPassword("");
      setRole(user.role);
      setStatus(user.status);
    } else {
      setFullName("");
      setUsername("");
      setPassword("");
      setRole("ADMINISTRATOR");
      setStatus("ACTIVE");
    }
  }, [open, user]);

  async function handleSubmit() {
    setSubmitting(true);
    const res = isEdit
      ? await updateUser({ id: user!.id, fullName, username, role, status })
      : await createUser({ fullName, username, password, role, status });
    setSubmitting(false);
    if (!res.ok) {
      toast(res.error ?? "Failed", "error");
      return;
    }
    toast(isEdit ? "User updated" : "User created", "success");
    onSuccess?.();
    onClose();
  }

  const roleOptions = [
    ...BUILT_IN_ROLES.map((r) => ({ id: r, label: roleLabel(r) })),
    ...roles.filter((r) => !r.builtIn).map((r) => ({ id: r.name, label: r.label })),
  ];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit User" : "Create User"}
      className="max-w-md"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Saving…" : isEdit ? "Update" : "Create User"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="u-name">Full Name</Label>
          <Input id="u-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="u-username">Username</Label>
          <Input id="u-username" value={username} onChange={(e) => setUsername(e.target.value)} />
        </div>
        {!isEdit && (
          <div className="space-y-2">
            <Label htmlFor="u-pass">Password</Label>
            <Input id="u-pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="u-role">Role</Label>
            <Select id="u-role" value={role} onChange={(e) => setRole(e.target.value)}>
              {roleOptions.map((r) => (
                <option key={r.id} value={r.id}>{r.label}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="u-status">Status</Label>
            <Select id="u-status" value={status} onChange={(e) => setStatus(e.target.value as AccountStatus)}>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="LOCKED">Locked</option>
            </Select>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
