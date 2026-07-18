"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Lock,
  PlugZap,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  apiSmsGateway,
  apiTestSmsGateway,
  apiToggleSmsGateway,
  type SchoolSmsGateway,
} from "@/lib/sms/api";
import { toast } from "@/lib/toast";

function fmtDate(v: string | null | undefined) {
  return v ? new Date(v).toLocaleDateString() : "—";
}

function daysLeft(endDate: string): number {
  return Math.ceil(
    (new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );
}

export function GatewaySettings() {
  const [gw, setGw] = useState<SchoolSmsGateway | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [toggling, setToggling] = useState(false);

  const [baseUrl, setBaseUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [senderId, setSenderId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiSmsGateway();
      setGw(res);
      setBaseUrl(res.baseUrl);
      setUsername(res.username);
      setSenderId(res.senderId ?? "");
      setPassword("");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not load gateway", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function testAndSave() {
    if (!username.trim()) return toast("Enter your Hormuud username", "error");
    if (!gw?.hasPassword && !password.trim()) {
      return toast("Enter your Hormuud API password", "error");
    }
    setTesting(true);
    try {
      const res = await apiTestSmsGateway({
        baseUrl: baseUrl.trim() || undefined,
        username: username.trim(),
        password: password.trim() || undefined,
        senderId: senderId.trim() || null,
      });
      setGw(res.gateway);
      setPassword("");
      toast(
        res.test.ok ? "Connected — your account is now in use." : res.test.message,
        res.test.ok ? "success" : "error",
      );
    } catch (e) {
      toast(e instanceof Error ? e.message : "Connection test failed", "error");
    } finally {
      setTesting(false);
    }
  }

  async function toggle(next: boolean) {
    setToggling(true);
    try {
      setGw(await apiToggleSmsGateway(next));
      toast(
        next
          ? "Now sending through your own account"
          : "Switched back to the platform SMS credits",
        "success",
      );
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not change this", "error");
    } finally {
      setToggling(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-10 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
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
              <h2 className="font-semibold">Use your own SMS account</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Connect your school&apos;s own Hormuud account so messages are sent
                and billed through it directly, instead of using SMS credits bought
                from the platform.
              </p>
              <p className="mt-3 text-sm">
                This is a paid add-on.{" "}
                <span className="font-medium">
                  Contact the platform administrator to activate it for your school.
                </span>
              </p>
              {gw.history.length > 0 && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Last licence ended {fmtDate(gw.history[0]?.endDate)}.
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
                : "Connect and switch on your own account below to stop using platform credits."}
            </p>
            {gw.license && (
              <p className="mt-2 text-xs text-muted-foreground">
                Licence valid until{" "}
                <strong className="text-foreground">
                  {fmtDate(gw.license.endDate)}
                </strong>
                {expiring && (
                  <span className="ml-1 font-medium text-amber-700 dark:text-amber-300">
                    · expires in {daysLeft(gw.license.endDate)} day(s)
                  </span>
                )}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Credentials */}
      <div className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm">
        <div>
          <h2 className="font-semibold">Your Hormuud credentials</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Saved only after a successful connection test.
          </p>
        </div>

        <div>
          <Label htmlFor="gw-user">Username</Label>
          <Input
            id="gw-user"
            className="mt-1.5"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>

        <div>
          <Label htmlFor="gw-pass">API password</Label>
          <Input
            id="gw-pass"
            type="password"
            className="mt-1.5"
            placeholder={gw.hasPassword ? "•••••••• (leave blank to keep)" : ""}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            The “API PASSWORD” from your Hormuud portal. It is never shown again
            once saved.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="gw-sender">Sender ID (optional)</Label>
            <Input
              id="gw-sender"
              className="mt-1.5"
              maxLength={20}
              value={senderId}
              onChange={(e) => setSenderId(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="gw-url">API URL</Label>
            <Input
              id="gw-url"
              className="mt-1.5"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
            />
          </div>
        </div>

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
              Last tested: {fmtDate(gw.lastTestedAt)}
              {gw.providerBalance ? ` · Balance: ${gw.providerBalance}` : ""}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void testAndSave()} disabled={testing}>
            <PlugZap className="mr-2 h-4 w-4" />
            {testing ? "Testing…" : "Test & save"}
          </Button>
          {gw.connectionVerified && (
            <Button
              variant="outline"
              onClick={() => void toggle(!gw.enabled)}
              disabled={toggling}
            >
              {gw.enabled ? "Switch back to platform credits" : "Use my own account"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
