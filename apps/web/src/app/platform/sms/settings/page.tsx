"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  PlugZap,
  Power,
  RefreshCw,
  Settings2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  fetchPlatformSmsConfig,
  fetchPlatformSmsConnectionLogs,
  testPlatformSmsConnection,
  updatePlatformSmsConfig,
  type PlatformSmsConfig,
  type PlatformSmsConnectionLog,
  type PlatformSmsConnectionTest,
} from "@/lib/platform/api";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

function StatusBadge({
  status,
}: {
  status: PlatformSmsConfig["connectionStatus"];
}) {
  const map = {
    CONNECTED: {
      label: "Connected",
      className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
      icon: CheckCircle2,
    },
    DISCONNECTED: {
      label: "Disconnected",
      className: "bg-slate-500/15 text-slate-300 border-slate-500/30",
      icon: XCircle,
    },
    ERROR: {
      label: "Error",
      className: "bg-rose-500/15 text-rose-300 border-rose-500/30",
      icon: AlertTriangle,
    },
  } as const;
  const m = map[status] ?? map.DISCONNECTED;
  const Icon = m.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold",
        m.className,
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {m.label}
    </span>
  );
}

export default function PlatformSmsSettingsPage() {
  const [config, setConfig] = useState<PlatformSmsConfig | null>(null);
  const [logs, setLogs] = useState<PlatformSmsConnectionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [lastTest, setLastTest] = useState<PlatformSmsConnectionTest | null>(
    null,
  );

  const [baseUrl, setBaseUrl] = useState("https://smsapi.hormuud.com");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [defaultSenderId, setDefaultSenderId] = useState("");
  const [enabled, setEnabled] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cfg, connectionLogs] = await Promise.all([
        fetchPlatformSmsConfig(),
        fetchPlatformSmsConnectionLogs(40),
      ]);
      setConfig(cfg);
      setLogs(connectionLogs);
      setBaseUrl(cfg.baseUrl || "https://smsapi.hormuud.com");
      setUsername(cfg.username);
      setDefaultSenderId(cfg.defaultSenderId ?? "");
      setEnabled(cfg.enabled);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to load SMS settings", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function runTestAndSave() {
    if (!username.trim()) {
      toast("API username is required", "error");
      return;
    }
    if (!password && !config?.hasPassword) {
      toast("API password is required", "error");
      return;
    }
    setTesting(true);
    setLastTest(null);
    try {
      const res = await testPlatformSmsConnection({
        baseUrl,
        username,
        password: password || undefined,
        saveOnSuccess: true,
        enabled,
        defaultSenderId: defaultSenderId || null,
      });
      setConfig(res.config);
      setLastTest(res.test);
      setPassword("");
      if (res.test.ok) {
        toast("Hormuud connection verified and settings saved", "success");
      } else {
        toast(res.test.message || "Connection test failed", "error");
      }
      const connectionLogs = await fetchPlatformSmsConnectionLogs(40);
      setLogs(connectionLogs);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Connection test failed", "error");
    } finally {
      setTesting(false);
    }
  }

  async function toggleEnabled(next: boolean) {
    if (next && !config?.connectionVerified) {
      toast("Test the Hormuud connection successfully before enabling SMS.", "error");
      return;
    }
    try {
      const cfg = await updatePlatformSmsConfig({ enabled: next });
      setConfig(cfg);
      setEnabled(cfg.enabled);
      toast(next ? "SMS service enabled" : "SMS service disabled", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Update failed", "error");
    }
  }

  if (loading && !config) {
    return <p className="text-slate-400">Loading SMS settings…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
            <Settings2 className="h-6 w-6 text-violet-400" />
            SMS Settings
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Configure and verify the Hormuud SMS API before managing packages.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => void load()}
            className="border-white/20 text-slate-200"
          >
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
          <Link
            href="/platform/sms"
            className={cn(
              "inline-flex h-10 items-center rounded-lg px-4 text-sm font-medium",
              config?.packagesUnlocked
                ? "bg-violet-600 text-white hover:bg-violet-500"
                : "cursor-not-allowed bg-white/5 text-slate-500",
            )}
            onClick={(e) => {
              if (!config?.packagesUnlocked) {
                e.preventDefault();
                toast(
                  "Packages unlock after a successful Hormuud connection test.",
                  "error",
                );
              }
            }}
          >
            SMS Packages
          </Link>
        </div>
      </div>

      {/* Status strip */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-[#0f172a] p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Connection status
          </p>
          <div className="mt-2">
            <StatusBadge
              status={config?.connectionStatus ?? "DISCONNECTED"}
            />
          </div>
          <p className="mt-2 text-sm text-slate-400">
            {config?.connectionMessage || "Not tested yet."}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#0f172a] p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Verification
          </p>
          <p className="mt-2 text-lg font-semibold text-white">
            {config?.connectionVerified ? "Verified" : "Not verified"}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Last success:{" "}
            {config?.lastSuccessAt
              ? new Date(config.lastSuccessAt).toLocaleString()
              : "—"}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#0f172a] p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Provider balance
          </p>
          <p className="mt-2 text-lg font-semibold text-violet-300">
            {config?.providerBalance ?? "—"}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Packages:{" "}
            {config?.packagesUnlocked ? (
              <span className="text-emerald-400">Unlocked</span>
            ) : (
              <span className="text-amber-400">Locked</span>
            )}
          </p>
        </div>
      </div>

      {!config?.packagesUnlocked && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            SMS packages, school purchases, and outbound sending stay locked
            until you successfully test and save the Hormuud API connection
            below.
          </p>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-[#0f172a] p-5">
          <h2 className="flex items-center gap-2 font-semibold text-white">
            <PlugZap className="h-4 w-4 text-violet-400" />
            Hormuud API credentials
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            From the Hormuud business portal (API username + API password).
          </p>

          <div className="mt-4 space-y-3">
            <div>
              <Label className="text-slate-400">Base URL</Label>
              <Input
                className="mt-1 border-white/10 bg-[#0b1120] text-white"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-slate-400">API Username</Label>
              <Input
                className="mt-1 border-white/10 bg-[#0b1120] text-white"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div>
              <Label className="text-slate-400">
                API Password
                {config?.hasPassword
                  ? " (saved — enter again to change)"
                  : ""}
              </Label>
              <Input
                type="password"
                className="mt-1 border-white/10 bg-[#0b1120] text-white"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={config?.hasPassword ? "••••••••" : "Hormuud API password"}
                autoComplete="new-password"
              />
            </div>
            <div>
              <Label className="text-slate-400">
                Default sender ID (fallback)
              </Label>
              <Input
                className="mt-1 border-white/10 bg-[#0b1120] text-white"
                value={defaultSenderId}
                onChange={(e) => setDefaultSenderId(e.target.value)}
                maxLength={20}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-white/10 px-3 py-2">
              <div>
                <p className="text-sm text-slate-200">Enable SMS service</p>
                <p className="text-xs text-slate-500">
                  Applied after a successful test (or toggled when already verified).
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const next = !enabled;
                  setEnabled(next);
                  if (config?.connectionVerified) void toggleEnabled(next);
                }}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
                  enabled
                    ? "bg-emerald-500/20 text-emerald-300"
                    : "bg-rose-500/20 text-rose-300",
                )}
              >
                <Power className="h-3 w-3" />
                {enabled ? "ON" : "OFF"}
              </button>
            </div>

            <Button
              onClick={() => void runTestAndSave()}
              disabled={testing}
              className="w-full"
            >
              {testing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Testing Hormuud API…
                </>
              ) : (
                <>
                  <PlugZap className="mr-2 h-4 w-4" />
                  Test Connection & Save
                </>
              )}
            </Button>
            <p className="text-xs text-slate-500">
              Credentials are saved only when authentication succeeds. No SMS is
              sent during the test (token + optional balance check only).
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-[#0f172a] p-5">
            <h2 className="font-semibold text-white">Last test details</h2>
            {!lastTest && (
              <p className="mt-3 text-sm text-slate-500">
                Run “Test Connection & Save” to see step-by-step results here.
              </p>
            )}
            {lastTest && (
              <div className="mt-3 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <StatusBadge status={lastTest.status} />
                  <span className="text-xs text-slate-500">
                    {new Date(lastTest.testedAt).toLocaleString()}
                  </span>
                </div>
                <p className="text-sm text-slate-300">{lastTest.message}</p>
                <ul className="space-y-2">
                  {lastTest.steps.map((step, i) => (
                    <li
                      key={`${step.step}-${i}`}
                      className="rounded-lg border border-white/5 px-3 py-2 text-sm"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium capitalize text-white">
                          {step.step.replace(/_/g, " ")}
                        </span>
                        <span
                          className={
                            step.ok ? "text-emerald-400" : "text-rose-400"
                          }
                        >
                          {step.ok ? "OK" : "FAIL"}
                          {step.httpStatus != null
                            ? ` · HTTP ${step.httpStatus}`
                            : ""}
                          {` · ${step.durationMs}ms`}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-400">{step.message}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#0f172a] p-5">
            <h2 className="font-semibold text-white">Connection logs</h2>
            <ul className="mt-3 max-h-80 space-y-2 overflow-y-auto text-sm">
              {logs.map((log) => (
                <li
                  key={log.id}
                  className="rounded-lg border border-white/5 px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-slate-200">
                      {log.action} · {log.status}
                    </span>
                    <span className="text-xs text-slate-500">
                      {new Date(log.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p
                    className={cn(
                      "mt-1 text-xs",
                      log.success ? "text-slate-400" : "text-rose-300",
                    )}
                  >
                    {log.message}
                  </p>
                </li>
              ))}
              {logs.length === 0 && (
                <li className="text-slate-500">No connection attempts yet.</li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
