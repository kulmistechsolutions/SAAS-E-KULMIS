"use client";

import { useEffect, useState } from "react";
import { KeyRound, Loader2, ShieldAlert } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/provider";
import { toast } from "@/lib/toast";
import { signInToSchool } from "@/lib/platform/api";
import { tenantUrl } from "@/lib/platform/format";

/**
 * Open a support session on a school.
 *
 * The reason field is the point of this dialog. Without it the audit line
 * reads "the platform signed in to your school" and stops, which tells a
 * school that it happened and nothing about whether it should have. With it,
 * the school can read why — in its own audit trail, beside its own staff's
 * activity — and challenge it if the answer is wrong.
 *
 * The session opens on the school's own subdomain with the token in the URL
 * fragment, which browsers do not send to servers, so it does not land in an
 * access log on the way in.
 */
export function SchoolSignInDialog({
  school,
  onClose,
}: {
  school: { id: string; name: string; subdomain: string } | null;
  onClose: () => void;
}) {
  const t = useT();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (school) setReason("");
  }, [school]);

  async function go() {
    if (!school) return;
    setBusy(true);
    try {
      const res = await signInToSchool(school.id, reason.trim());
      const base = tenantUrl(school.subdomain).split("?")[0]!;
      const url = `${base.replace(/\/$/, "")}/support-session#token=${encodeURIComponent(
        res.accessToken,
      )}`;
      window.open(url, "_blank", "noopener,noreferrer");
      toast(
        t("platformSchools.signInOpened")
          .replace("{user}", res.signedInAs.username)
          .replace("{minutes}", String(res.expiresInMinutes)),
        "success",
      );
      onClose();
    } catch (e) {
      toast(
        e instanceof Error ? e.message : "Could not open the session.",
        "error",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={!!school}
      onClose={onClose}
      title={t("platformSchools.signInAs")}
      className="max-w-md"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {t("common.cancel")}
          </Button>
          <Button disabled={busy || reason.trim().length < 5} onClick={() => void go()}>
            {busy ? (
              <Loader2 className="me-2 h-4 w-4 animate-spin" />
            ) : (
              <KeyRound className="me-2 h-4 w-4" />
            )}
            {t("platformSchools.signInOpen")}
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-sm">
        <p className="font-medium">{school?.name}</p>

        <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{t("platformSchools.signInWarning")}</p>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            {t("platformSchools.signInReason")} *
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder={t("platformSchools.signInReasonHint")}
            className="w-full rounded-lg border bg-background p-3 text-sm outline-none focus:border-primary"
          />
        </div>
      </div>
    </Dialog>
  );
}
