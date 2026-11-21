"use client";

import { useState } from "react";
import { Copy, Eye, EyeOff, KeyRound } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";

type Reveal =
  | { known: true; password: string; isDefault: true }
  | { known: false; isDefault: false };

/**
 * "Show password" for an admin looking at a student, teacher, parent or user.
 *
 * Passwords are stored one-way, so the server can only confirm whether the
 * login still opens with the password the school issued (the student ID, the
 * shared 12345). When it does, that is shown; when the person has set their
 * own, it says so and points at Reset — nobody, the admin included, can read
 * a password someone chose for themselves.
 */
export function RevealPassword({
  path,
  className,
}: {
  /** e.g. `/students/<id>/portal-password` */
  path: string;
  className?: string;
}) {
  const [state, setState] = useState<Reveal | null>(null);
  const [visible, setVisible] = useState(true);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setState(await api<Reveal>(path));
      setVisible(true);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Could not check the password.", "error");
    } finally {
      setLoading(false);
    }
  }

  if (!state) {
    return (
      <Button type="button" variant="outline" onClick={load} disabled={loading} className={`h-8 px-3 text-xs ${className ?? ""}`}>
        <Eye className="me-1.5 h-4 w-4" />
        {loading ? "Checking…" : "Show password"}
      </Button>
    );
  }

  if (!state.known) {
    return (
      <div className={`flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-800 dark:text-amber-300 ${className ?? ""}`}>
        <KeyRound className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          The password was changed by its owner, so it cannot be shown. Use
          Reset password to give them a new one.
        </span>
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-1 rounded-lg border bg-secondary/50 px-2.5 py-1.5 ${className ?? ""}`}>
      <span className="text-xs text-muted-foreground">Password:</span>
      <code className="font-mono text-sm font-semibold tracking-wide">
        {visible ? state.password : "••••••"}
      </code>
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        title={visible ? "Hide" : "Show"}
        aria-label={visible ? "Hide" : "Show"}
        className="rounded p-1 text-muted-foreground hover:text-foreground"
      >
        {visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </button>
      <button
        type="button"
        title="Copy"
        aria-label="Copy"
        onClick={() => {
          void navigator.clipboard?.writeText(state.password).then(
            () => toast("Password copied", "success"),
            () => undefined,
          );
        }}
        className="rounded p-1 text-muted-foreground hover:text-foreground"
      >
        <Copy className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
