"use client";

import { useState } from "react";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { usePortal, usePortalAudit } from "@/components/parent-portal/portal-context";
import { portalChangePassword } from "@/lib/parent-portal/store";
import { longDate, statusLabel } from "@/lib/students/format";
import { toast } from "@/lib/toast";

export default function ParentProfilePage() {
  const { parent } = usePortal();
  usePortalAudit("PROFILE_VIEWED");

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  function handlePasswordChange() {
    if (next !== confirm) {
      toast("New passwords do not match", "error");
      return;
    }
    setSaving(true);
    const result = portalChangePassword(parent.id, current, next);
    setSaving(false);
    if (!result.ok) {
      toast(result.error ?? "Failed to change password", "error");
      return;
    }
    toast("Password updated successfully", "success");
    setCurrent("");
    setNext("");
    setConfirm("");
  }

  const fields = [
    ["Parent ID", parent.code],
    ["Full Name", parent.name],
    ["Phone", parent.phone],
    ["Alternative Phone", parent.altPhone ?? "—"],
    ["Email", parent.email ?? "—"],
    ["Address", parent.address ?? "—"],
    ["Occupation", parent.occupation ?? "—"],
    ["Registration Date", longDate(parent.registrationDate)],
    ["Account Status", statusLabel(parent.status)],
  ] as const;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">View your account details and change your password.</p>
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">Account Information</h2>
          <Badge tone={parent.status === "ACTIVE" ? "success" : "muted"}>
            {statusLabel(parent.status)}
          </Badge>
        </div>
        <dl className="grid gap-3 sm:grid-cols-2">
          {fields.map(([label, value]) => (
            <div key={label} className="rounded-lg border bg-secondary/30 px-4 py-3">
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="mt-0.5 font-medium">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-primary" />
          <h2 className="font-semibold">Change Password</h2>
        </div>
        <div className="grid max-w-md gap-3">
          <div>
            <label className="mb-1 block text-sm">Current password</label>
            <Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm">New password</label>
            <Input type="password" value={next} onChange={(e) => setNext(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm">Confirm new password</label>
            <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
          <Button onClick={handlePasswordChange} disabled={saving || !current || !next}>
            {saving ? "Updating…" : "Update password"}
          </Button>
        </div>
      </div>
    </div>
  );
}
