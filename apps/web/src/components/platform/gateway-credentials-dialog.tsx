"use client";


import { useEffect, useState } from "react";
import { CheckCircle2, PlugZap, XCircle } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { toast } from "@/lib/toast";
import {
  fetchPlatformSchoolGateway,
  testPlatformSchoolGateway,
  togglePlatformSchoolGateway,
  type PlatformSchoolGateway,
} from "@/lib/platform/api";

interface Props {
  open: boolean;
  onClose: () => void;
  schoolId: string;
  schoolName: string;
}

/**
 * Enter and test a school's own Hormuud credentials on their behalf. This is
 * the only place these can be set — the school's own SMS settings page only
 * displays whatever is configured here, read-only.
 */
export function GatewayCredentialsDialog({
  open,
  onClose,
  schoolId,
  schoolName,
}: Props) {
  const [gw, setGw] = useState<PlatformSchoolGateway | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [toggling, setToggling] = useState(false);

  const [provider, setProvider] = useState<"HORMUUD" | "DHAMBAAL">("HORMUUD");
  const [baseUrl, setBaseUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [senderId, setSenderId] = useState("");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetchPlatformSchoolGateway(schoolId)
      .then((res) => {
        setGw(res);
        setProvider(res.provider);
        setBaseUrl(res.baseUrl);
        setUsername(res.username);
        setSenderId(res.senderId ?? "");
        setPassword("");
        setApiToken("");
      })
      .catch((e) =>
        toast(e instanceof Error ? e.message : "Could not load gateway", "error"),
      )
      .finally(() => setLoading(false));
  }, [open, schoolId]);

  function switchProvider(next: "HORMUUD" | "DHAMBAAL") {
    setProvider(next);
    // Different provider = a different default endpoint, unless the stored
    // gateway is already on that provider (then keep its saved baseUrl).
    if (gw && gw.provider !== next) {
      setBaseUrl(next === "DHAMBAAL" ? "https://dhambaal.golis.so" : "https://smsapi.hormuud.com");
    }
  }

  async function testAndSave() {
    if (provider === "DHAMBAAL") {
      if (!gw?.hasApiToken && !apiToken.trim()) {
        return toast("Enter the Dhambaal API token", "error");
      }
    } else {
      if (!username.trim()) return toast("Enter the Hormuud username", "error");
      if (!gw?.hasPassword && !password.trim()) {
        return toast("Enter the Hormuud API password", "error");
      }
    }
    setTesting(true);
    try {
      const res = await testPlatformSchoolGateway(schoolId, {
        provider,
        baseUrl: baseUrl.trim() || undefined,
        username: provider === "HORMUUD" ? username.trim() : undefined,
        password: provider === "HORMUUD" ? password.trim() || undefined : undefined,
        apiToken: provider === "DHAMBAAL" ? apiToken.trim() || undefined : undefined,
        senderId: senderId.trim() || null,
      });
      setGw(res.gateway);
      setPassword("");
      setApiToken("");
      toast(
        res.test.ok ? "Connected — the school's account is now in use." : res.test.message,
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
      setGw(await togglePlatformSchoolGateway(schoolId, next));
      toast(
        next
          ? "Now sending through the school's own account"
          : "Switched back to platform SMS credits",
        "success",
      );
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not change this", "error");
    } finally {
      setToggling(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Own gateway credentials"
      description={`${schoolName} — entered here on the school's behalf.`}
      className="max-w-lg"
    >
      {loading || !gw ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="space-y-4">
          <div>
            <Label htmlFor="pgw-provider">Provider</Label>
            <Select
              id="pgw-provider"
              className="mt-1.5"
              value={provider}
              onChange={(e) => switchProvider(e.target.value as "HORMUUD" | "DHAMBAAL")}
            >
              <option value="HORMUUD">Hormuud</option>
              <option value="DHAMBAAL">Dhambaal</option>
            </Select>
          </div>
          {provider === "HORMUUD" ? (
            <>
              <div>
                <Label htmlFor="pgw-user">Username</Label>
                <Input
                  id="pgw-user"
                  className="mt-1.5"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="pgw-pass">API password</Label>
                <Input
                  id="pgw-pass"
                  type="password"
                  className="mt-1.5"
                  placeholder={gw.hasPassword ? "•••••••• (leave blank to keep)" : ""}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </>
          ) : (
            <div>
              <Label htmlFor="pgw-token">API token</Label>
              <Input
                id="pgw-token"
                type="password"
                className="mt-1.5"
                placeholder={gw.hasApiToken ? "•••••••• (leave blank to keep)" : ""}
                value={apiToken}
                onChange={(e) => setApiToken(e.target.value)}
              />
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="pgw-sender">Sender ID (optional)</Label>
              <Input
                id="pgw-sender"
                className="mt-1.5"
                maxLength={provider === "DHAMBAAL" ? 11 : 20}
                value={senderId}
                onChange={(e) => setSenderId(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="pgw-url">API URL</Label>
              <Input
                id="pgw-url"
                className="mt-1.5"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-lg border bg-secondary/40 px-3 py-2 text-xs">
            {gw.connectionVerified && gw.connectionStatus === "CONNECTED" ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            ) : gw.connectionStatus === "ERROR" ? (
              <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
            ) : null}
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
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void testAndSave()} disabled={testing}>
              <PlugZap className="me-2 h-4 w-4" />
              {testing ? "Testing…" : "Test & save"}
            </Button>
            {gw.connectionVerified && (
              <Button
                variant="outline"
                onClick={() => void toggle(!gw.enabled)}
                disabled={toggling}
              >
                {gw.enabled ? "Switch back to platform credits" : "Use this school's own account"}
              </Button>
            )}
          </div>
        </div>
      )}
    </Dialog>
  );
}
