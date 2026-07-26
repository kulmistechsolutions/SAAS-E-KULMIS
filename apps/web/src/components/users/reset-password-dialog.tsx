"use client";


import { useT } from "@/lib/i18n/provider";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resetPassword } from "@/lib/users/store";
import { toast } from "@/lib/toast";

interface ResetPasswordDialogProps {
  open: boolean;
  userId: string | null;
  userName?: string;
  onClose: () => void;
}

export function ResetPasswordDialog({
  open,
  userId,
  userName,
  onClose,
}: ResetPasswordDialogProps) {
  const t = useT();
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) setPassword("");
  }, [open]);

  async function handleSubmit() {
    if (!userId) return;
    setSubmitting(true);
    const res = await resetPassword(userId, password);
    setSubmitting(false);
    if (!res.ok) {
      toast(res.error ?? "Reset failed", "error");
      return;
    }
    toast("Password reset — user must change on next login", "success");
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("usersResetPasswordDialog.resetPassword")}
      description={userName ? `Reset password for ${userName}` : undefined}
      className="max-w-sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>{t("usersResetPasswordDialog.cancel")}</Button>
          <Button onClick={handleSubmit} disabled={submitting || !userId}>{t("usersResetPasswordDialog.resetPassword")}</Button>
        </>
      }
    >
      <div className="space-y-2">
        <Label htmlFor="new-pass">{t("usersResetPasswordDialog.newPassword")}</Label>
        <Input
          id="new-pass"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t("usersResetPasswordDialog.min8CharsUppercaseNumber")}
        />
      </div>
    </Dialog>
  );
}
