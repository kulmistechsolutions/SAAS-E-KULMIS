"use client";


import { useT } from "@/lib/i18n/provider";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { ASSIGNABLE_ROLES, roleLabel } from "@/lib/users/format";
import { createUser, updateUser } from "@/lib/users/store";
import type { AccountStatus, SystemRole, SystemUser } from "@/lib/users/types";
import { toast } from "@/lib/toast";

interface UserFormDialogProps {
  open: boolean;
  user?: SystemUser | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export function UserFormDialog({
  open,
  user,
  onClose,
  onSuccess,
}: UserFormDialogProps) {
  const t = useT();
  const isEdit = !!user;

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

  // Parent/Student logins come with student registration and Super
  // Administrator is the owner's own account — none of them are handed out here.
  // Custom roles created on the Roles & Permissions page aren't included: the
  // backend only accepts the fixed built-in role values, so offering them here
  // would let an admin "assign" a role that then fails to save.
  const roleOptions: { id: SystemRole; label: string }[] = [
    ...ASSIGNABLE_ROLES.map((r) => ({ id: r, label: roleLabel(r) })),
  ];
  // A user can carry a role no longer offered above (e.g. the legacy
  // "RECEPTION" value from before Reception Officer existed). Without this,
  // the <select> falls back to whichever option is first and silently
  // reassigns the user's real role the moment the form is saved.
  if (role && !roleOptions.some((r) => r.id === role)) {
    roleOptions.push({ id: role, label: roleLabel(role) });
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit User" : "Create User"}
      className="max-w-md"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t("usersUserFormDialog.cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Saving…" : isEdit ? "Update" : "Create User"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="u-name">{t("usersUserFormDialog.fullName")}</Label>
          <Input
            id="u-name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="u-username">{t("usersUserFormDialog.username")}</Label>
          <Input
            id="u-username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>
        {!isEdit && (
          <div className="space-y-2">
            <Label htmlFor="u-pass">{t("usersUserFormDialog.password")}</Label>
            <Input
              id="u-pass"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="u-role">{t("usersUserFormDialog.role")}</Label>
            <Select
              id="u-role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              {roleOptions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="u-status">{t("usersUserFormDialog.status")}</Label>
            <Select
              id="u-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as AccountStatus)}
            >
              <option value="ACTIVE">{t("usersUserFormDialog.active")}</option>
              <option value="INACTIVE">{t("usersUserFormDialog.inactive")}</option>
              <option value="LOCKED">{t("usersUserFormDialog.locked")}</option>
            </Select>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
