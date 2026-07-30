"use client";


import { useT } from "@/lib/i18n/provider";
import { useEffect, useState } from "react";
import { Eye, EyeOff, Key, Loader2, RotateCcw } from "lucide-react";
import {
  fetchPlatformSchoolUsers,
  resetPlatformSchoolUserPassword,
  type PlatformSchoolUser,
} from "@/lib/platform/api";
import { toast } from "@/lib/toast";

function when(iso: string | null): string {
  if (!iso) return "Never";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function randomPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 10; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

/**
 * Super Admin password recovery — set a new password for a locked-out school
 * user. Only the password hash is touched; no other school data is read or
 * changed, and the user's active sessions are revoked on reset.
 */
export function SchoolPasswordReset({ schoolId }: { schoolId: string }) {
  const t = useT();
  const [users, setUsers] = useState<PlatformSchoolUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [openUserId, setOpenUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [justReset, setJustReset] = useState<{ username: string; password: string } | null>(null);

  function load() {
    setLoading(true);
    void fetchPlatformSchoolUsers(schoolId)
      .then((res) => {
        setUsers(res.users);
        setError(null);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "Could not load users");
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId]);

  function openFor(userId: string) {
    setOpenUserId(openUserId === userId ? null : userId);
    setNewPassword("");
    setShowPassword(false);
    setJustReset(null);
  }

  async function handleReset(user: PlatformSchoolUser) {
    if (newPassword.trim().length < 8) {
      toast("Password must be at least 8 characters", "error");
      return;
    }
    setBusy(true);
    try {
      await resetPlatformSchoolUserPassword(schoolId, user.id, newPassword.trim());
      setJustReset({ username: user.username, password: newPassword.trim() });
      toast(`Password reset for ${user.username}`, "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Reset failed", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-center gap-2">
        <Key className="h-4 w-4 text-amber-400" />
        <h2 className="font-semibold text-white">{t("platformSchoolPasswordReset.passwordRecovery")}</h2>
      </div>
      <p className="mt-1 text-sm text-white/60">
        {t("platformSchoolPasswordReset.setANewPasswordForALockedOut")}
      </p>

      {loading ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-white/60">
          <Loader2 className="h-4 w-4 animate-spin" /> {t("platformSchoolPasswordReset.loading")}
        </p>
      ) : error ? (
        <p className="mt-4 text-sm text-rose-300">{error}</p>
      ) : (
        <div className="mt-4 space-y-2">
          {users.map((u) => (
            <div key={u.id} className="rounded-lg border border-white/10 bg-white/5">
              <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="font-medium text-white">{u.username}</p>
                  <p className="text-xs text-white/50">
                    {u.role.replace(/_/g, " ")} · {t("platformSchoolPasswordReset.lastSignIn")} {when(u.lastLoginAt)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => openFor(u.id)}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/10"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  {t("platformSchoolPasswordReset.resetPassword")}
                </button>
              </div>

              {openUserId === u.id && (
                <div className="border-t border-white/10 px-3 py-3">
                  {justReset && justReset.username === u.username ? (
                    <div className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm text-emerald-200">
                      <p className="font-medium">
                        {t("platformSchoolPasswordReset.newPasswordFor")} {justReset.username}:
                      </p>
                      <p className="mt-1 select-all break-all rounded bg-black/20 px-2 py-1 font-mono text-emerald-100">
                        {justReset.password}
                      </p>
                      <p className="mt-1.5 text-xs text-emerald-200/70">
                        {t("platformSchoolPasswordReset.shareThisWithTheSchoolItWont")}
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="relative flex-1 min-w-[10rem]">
                        <input
                          type={showPassword ? "text" : "password"}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder={t("platformSchoolPasswordReset.newPasswordMin8Chars")}
                          autoComplete="new-password"
                          className="h-9 w-full rounded-lg border border-white/15 bg-white/5 px-3 pe-9 text-sm text-white placeholder:text-white/40 outline-none focus:border-violet-400"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          className="absolute inset-y-0 end-0 flex items-center px-2.5 text-white/50 hover:text-white"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => setNewPassword(randomPassword())}
                        className="h-9 rounded-lg border border-white/15 bg-white/5 px-3 text-xs font-medium text-white hover:bg-white/10"
                      >
                        {t("platformSchoolPasswordReset.generate")}
                      </button>
                      <button
                        type="button"
                        disabled={busy || newPassword.trim().length < 8}
                        onClick={() => void handleReset(u)}
                        className="h-9 rounded-lg bg-violet-600 px-4 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
                      >
                        {busy ? "…" : t("platformSchoolPasswordReset.confirmReset")}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          {users.length === 0 && (
            <p className="py-6 text-center text-sm text-white/50">
              {t("platformSchoolPasswordReset.noLoginsFoundForThisSchool")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
