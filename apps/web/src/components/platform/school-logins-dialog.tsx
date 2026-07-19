"use client";

import { useCallback, useEffect, useState } from "react";
import { KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  fetchPlatformSchoolUsers,
  resetPlatformSchoolUserPassword,
  type PlatformSchoolUser,
} from "@/lib/platform/api";
import { toast } from "@/lib/toast";

interface Props {
  open: boolean;
  onClose: () => void;
  school: { id: string; name: string } | null;
}

/**
 * Super Admin password recovery for a school that has locked itself out.
 * Only the chosen login's password changes — the school's data is untouched.
 */
export function SchoolLoginsDialog({ open, onClose, school }: Props) {
  const [users, setUsers] = useState<PlatformSchoolUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!school) return;
    setLoading(true);
    try {
      const res = await fetchPlatformSchoolUsers(school.id);
      setUsers(res.users);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not load logins", "error");
    } finally {
      setLoading(false);
    }
  }, [school]);

  useEffect(() => {
    if (!open) {
      setTargetId(null);
      setPw1("");
      setPw2("");
      return;
    }
    void load();
  }, [open, load]);

  async function reset() {
    if (!school || !targetId) return;
    if (pw1.length < 6) return toast("Password must be at least 6 characters", "error");
    if (pw1 !== pw2) return toast("The two passwords do not match", "error");

    setSaving(true);
    try {
      const res = await resetPlatformSchoolUserPassword(school.id, targetId, pw1);
      toast(`Password reset for "${res.username}"`, "success");
      setTargetId(null);
      setPw1("");
      setPw2("");
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Reset failed", "error");
    } finally {
      setSaving(false);
    }
  }

  const target = users.find((u) => u.id === targetId) ?? null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={school ? `Logins — ${school.name}` : "Logins"}
      description="Reset a password for a school that is locked out. School data is not affected."
      className="sm:max-w-lg"
      footer={<Button variant="outline" onClick={onClose}>Close</Button>}
    >
      {loading ? (
        <div className="flex items-center gap-2 py-10 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading logins…
        </div>
      ) : target ? (
        <div className="space-y-4">
          <div className="rounded-lg border bg-secondary/40 px-3 py-2 text-sm">
            <p className="font-medium">{target.username}</p>
            <p className="text-xs text-muted-foreground">{target.role}</p>
          </div>
          <div>
            <Label htmlFor="pw1">New password</Label>
            <Input
              id="pw1"
              type="password"
              className="mt-1.5"
              value={pw1}
              onChange={(e) => setPw1(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <Label htmlFor="pw2">Confirm password</Label>
            <Input
              id="pw2"
              type="password"
              className="mt-1.5"
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
            />
          </div>
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            This signs the user out everywhere. Tell them the new password and
            ask them to change it from their Profile page.
          </div>
          <div className="flex gap-2">
            <Button onClick={() => void reset()} disabled={saving}>
              {saving ? "Resetting…" : "Set new password"}
            </Button>
            <Button variant="outline" onClick={() => setTargetId(null)}>
              Back
            </Button>
          </div>
        </div>
      ) : users.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          This school has no logins yet.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {users.map((u) => (
            <li key={u.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{u.username}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {u.role}
                  {u.status !== "ACTIVE" ? ` · ${u.status}` : ""}
                  {u.lastLoginAt
                    ? ` · last login ${new Date(u.lastLoginAt).toLocaleDateString()}`
                    : " · never signed in"}
                </p>
              </div>
              <Button
                variant="outline"
                className="h-8 shrink-0 px-2.5 text-xs"
                onClick={() => setTargetId(u.id)}
              >
                <KeyRound className="mr-1.5 h-3.5 w-3.5" /> Reset
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}
