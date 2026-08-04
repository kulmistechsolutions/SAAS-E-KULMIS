"use client";


import { useT } from "@/lib/i18n/provider";
import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Lock,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { apiSmsGateway, type SchoolSmsGateway } from "@/lib/sms/api";
import { toast } from "@/lib/toast";

function fmtDate(v: string | null | undefined) {
  return v ? new Date(v).toLocaleDateString() : "—";
}

function daysLeft(endDate: string): number {
  return Math.ceil(
    (new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );
}

/**
 * Read-only. A school can see whether its own Hormuud account is connected
 * and in use, but entering the credentials, testing the connection, and
 * switching it on/off is a Platform Super Admin action (Platform > SMS >
 * Own gateways) — a school has no path to set or change its own sending
 * credentials.
 */
export function GatewaySettings() {
  const t = useT();
  const [gw, setGw] = useState<SchoolSmsGateway | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setGw(await apiSmsGateway());
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not load gateway", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-10 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> {t("smsGatewaySettings.loading")}
      </div>
    );
  }
  if (!gw) return null;

  // Not sold to this school yet — explain rather than show a dead form.
  if (!gw.licensed) {
    return (
      <div className="max-w-2xl space-y-4">
        <div className="rounded-2xl border bg-card p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <Lock className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
            <div>
              <h2 className="font-semibold">{t("smsGatewaySettings.useYourOwnSmsAccount")}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("smsGatewaySettings.connectYourSchoolAposSOwn")}
              </p>
              <p className="mt-3 text-sm">
                {t("smsGatewaySettings.thisIsAPaidAddOn")}{" "}
                <span className="font-medium">
                  {t("smsGatewaySettings.contactThePlatformAdministratorToActivate")}
                </span>
              </p>
              {gw.history.length > 0 && (
                <p className="mt-3 text-xs text-muted-foreground">
                  {t("smsGatewaySettings.lastLicenceEnded")} {fmtDate(gw.history[0]?.endDate)}.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const expiring = gw.license && daysLeft(gw.license.endDate) <= 14;

  return (
    <div className="max-w-2xl space-y-4">
      {/* Licence + routing status */}
      <div
        className={`rounded-2xl border p-4 ${
          gw.active
            ? "border-emerald-500/30 bg-emerald-500/10"
            : "border-amber-500/30 bg-amber-500/10"
        }`}
      >
        <div className="flex items-start gap-3">
          {gw.active ? (
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          )}
          <div className="min-w-0 flex-1">
            <p className="font-medium">
              {gw.active
                ? "Your own Hormuud account is in use"
                : "Currently using platform SMS credits"}
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {gw.active
                ? "Messages are sent through your account and billed by Hormuud — platform credits are not used."
                : t("smsGatewaySettings.contactThePlatformAdministratorToActivate")}
            </p>
            {gw.license && (
              <p className="mt-2 text-xs text-muted-foreground">
                {t("smsGatewaySettings.licenceValidUntil")}{" "}
                <strong className="text-foreground">
                  {fmtDate(gw.license.endDate)}
                </strong>
                {expiring && (
                  <span className="ms-1 font-medium text-amber-700 dark:text-amber-300">
                    {t("smsGatewaySettings.expiresIn")} {daysLeft(gw.license.endDate)} {t("smsGatewaySettings.dayS")}
                  </span>
                )}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Read-only status — no credential fields, no Test & Save. */}
      <div className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm">
        <div>
          <h2 className="font-semibold">{t("smsGatewaySettings.yourHormuudCredentials")}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t("smsGatewaySettings.managedByThePlatformAdministrator")}
          </p>
        </div>

        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">{t("smsGatewaySettings.username")}</dt>
            <dd className="mt-0.5 font-medium">{gw.username || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t("smsGatewaySettings.senderIdOptional")}</dt>
            <dd className="mt-0.5 font-medium">{gw.senderId || "—"}</dd>
          </div>
        </dl>

        {/* Connection result */}
        <div className="flex items-start gap-2 rounded-lg border bg-secondary/40 px-3 py-2 text-xs">
          {gw.connectionVerified && gw.connectionStatus === "CONNECTED" ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          ) : gw.connectionStatus === "ERROR" ? (
            <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
          ) : (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          )}
          <div className="min-w-0">
            <p className="font-medium">
              {gw.connectionVerified && gw.connectionStatus === "CONNECTED"
                ? "Connection verified"
                : gw.connectionStatus === "ERROR"
                  ? "Connection failed"
                  : "Not tested yet"}
            </p>
            {gw.connectionMessage && (
              <p className="mt-0.5 text-muted-foreground">{gw.connectionMessage}</p>
            )}
            <p className="mt-0.5 text-muted-foreground">
              {t("smsGatewaySettings.lastTested")} {fmtDate(gw.lastTestedAt)}
              {gw.providerBalance ? ` · Balance: ${gw.providerBalance}` : ""}
            </p>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          {t("smsGatewaySettings.contactThePlatformAdministratorToActivate")}
        </p>
      </div>
    </div>
  );
}
