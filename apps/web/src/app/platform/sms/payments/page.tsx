"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  Loader2,
  Power,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  fetchPlatformSmsPayments,
  fetchPlatformWaafiConfig,
  testPlatformWaafiConnection,
  updatePlatformWaafiConfig,
  type PlatformSmsPaymentOverview,
  type PlatformWaafiConfig,
  type PlatformWaafiTest,
} from "@/lib/platform/api";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

function StatusBadge({
  status,
}: {
  status: PlatformWaafiConfig["connectionStatus"];
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

function money(n: string | number, currency = "USD") {
  const v = typeof n === "string" ? Number(n) : n;
  return `${currency} ${Number.isFinite(v) ? v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : n}`;
}

export default function PlatformWaafiPaymentsPage() {
  const [tab, setTab] = useState<"gateway" | "transactions">("gateway");
  const [config, setConfig] = useState<PlatformWaafiConfig | null>(null);
  const [overview, setOverview] = useState<PlatformSmsPaymentOverview | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [lastTest, setLastTest] = useState<PlatformWaafiTest | null>(null);

  const [baseUrl, setBaseUrl] = useState("https://sandbox.waafipay.net/asm");
  const [merchantUid, setMerchantUid] = useState("");
  const [apiUserId, setApiUserId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [storeId, setStoreId] = useState("");
  const [hppKey, setHppKey] = useState("");
  const [defaultMethod, setDefaultMethod] = useState<
    "API_PURCHASE" | "HPP_PURCHASE"
  >("API_PURCHASE");
  const [currency, setCurrency] = useState("USD");
  const [callbackBaseUrl, setCallbackBaseUrl] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [simulationMode, setSimulationMode] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cfg, ov] = await Promise.all([
        fetchPlatformWaafiConfig(),
        fetchPlatformSmsPayments(),
      ]);
      setConfig(cfg);
      setOverview(ov);
      setBaseUrl(cfg.baseUrl);
      setMerchantUid(cfg.merchantUid);
      setApiUserId(cfg.apiUserId);
      setStoreId(cfg.storeId);
      setDefaultMethod(cfg.defaultMethod);
      setCurrency(cfg.currency);
      setCallbackBaseUrl(cfg.callbackBaseUrl ?? "");
      setEnabled(cfg.enabled);
      setSimulationMode(cfg.simulationMode);
      setApiKey("");
      setHppKey("");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to load Waafi settings", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function testConnection() {
    if (!merchantUid.trim()) {
      toast("Enter Merchant UID (from Hormuud Waafi) before testing.", "error");
      return;
    }
    if (!apiUserId.trim() && !storeId.trim()) {
      toast(
        "Enter API User ID + API Key, or Store ID + HPP Key, then test again.",
        "error",
      );
      return;
    }
    setTesting(true);
    setLastTest(null);
    try {
      const res = await testPlatformWaafiConnection({
        baseUrl,
        merchantUid,
        apiUserId,
        apiKey: apiKey || undefined,
        storeId,
        hppKey: hppKey || undefined,
        defaultMethod,
        currency,
        callbackBaseUrl: callbackBaseUrl.trim() || null,
        saveOnSuccess: true,
        enabled,
      });
      setConfig(res.config);
      setLastTest(res.test);
      setOverview((prev) => (prev ? { ...prev, config: res.config } : prev));
      if (res.test.ok) {
        toast("WaafiPay connected — credentials saved", "success");
        setApiKey("");
        setHppKey("");
        setEnabled(res.config.enabled);
        setSimulationMode(res.config.simulationMode);
      } else {
        toast(res.test.message, "error");
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : "Connection test failed", "error");
    } finally {
      setTesting(false);
    }
  }

  async function toggleEnabled() {
    if (!config?.connectionVerified && !config?.simulationMode && !enabled) {
      toast(
        "Test connection successfully, or enable Simulation mode for demo.",
        "error",
      );
      return;
    }
    try {
      const next = !enabled;
      const updated = await updatePlatformWaafiConfig({ enabled: next });
      setConfig(updated);
      setEnabled(updated.enabled);
      toast(updated.enabled ? "Waafi payments enabled" : "Waafi payments disabled", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Update failed", "error");
    }
  }

  async function toggleSimulation() {
    try {
      const next = !simulationMode;
      const updated = await updatePlatformWaafiConfig({ simulationMode: next });
      setConfig(updated);
      setSimulationMode(updated.simulationMode);
      setEnabled(updated.enabled);
      toast(
        updated.simulationMode
          ? "Simulation mode ON — schools can buy packages without live Waafi"
          : "Simulation mode OFF — live Waafi credentials required",
        "success",
      );
    } catch (e) {
      toast(e instanceof Error ? e.message : "Update failed", "error");
    }
  }

  if (loading && !config) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading WaafiPay…
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">WaafiPay Payments</h1>
          <p className="mt-1 text-sm text-slate-400">
            Configure Hormuud Waafi gateway and monitor SMS package purchases.{" "}
            <a
              href="https://docs.waafipay.com/"
              target="_blank"
              rel="noreferrer"
              className="text-violet-300 hover:underline"
            >
              Docs
            </a>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {config ? <StatusBadge status={config.connectionStatus} /> : null}
          <Button variant="outline" className="h-8 px-3 text-xs" onClick={() => void load()}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
          </Button>
        </div>
      </div>

      {overview ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs text-slate-400">Successful revenue</p>
            <p className="mt-1 text-xl font-semibold text-white">
              {money(overview.revenue.totalAmount, config?.currency ?? "USD")}
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs text-slate-400">Successful payments</p>
            <p className="mt-1 text-xl font-semibold text-white">
              {overview.revenue.successfulPayments}
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs text-slate-400">Credits sold</p>
            <p className="mt-1 text-xl font-semibold text-white">
              {overview.revenue.totalCredits.toLocaleString()}
            </p>
          </div>
        </div>
      ) : null}

      <div className="flex gap-2 border-b border-white/10 pb-2">
        {(
          [
            ["gateway", "Gateway settings"],
            ["transactions", "All transactions"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm",
              tab === id
                ? "bg-violet-600 text-white"
                : "text-slate-400 hover:bg-white/5 hover:text-white",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "gateway" ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="space-y-4 rounded-2xl border border-white/10 bg-[#0f172a] p-5">
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-violet-300" />
              <h2 className="font-semibold text-white">Waafi credentials</h2>
            </div>
            <p className="text-xs text-slate-400">
              Credentials are saved only after a successful Test Connection.
              Schools never see these values.
            </p>

            <div className="space-y-3">
              <div>
                <Label className="text-slate-300">API base URL</Label>
                <Input
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  className="mt-1 border-white/10 bg-black/20 text-white"
                  placeholder="https://sandbox.waafipay.net/asm"
                />
              </div>
              <div>
                <Label className="text-slate-300">Merchant UID</Label>
                <Input
                  value={merchantUid}
                  onChange={(e) => setMerchantUid(e.target.value)}
                  className="mt-1 border-white/10 bg-black/20 text-white"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label className="text-slate-300">API User ID</Label>
                  <Input
                    value={apiUserId}
                    onChange={(e) => setApiUserId(e.target.value)}
                    className="mt-1 border-white/10 bg-black/20 text-white"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">
                    API Key {config?.hasApiKey ? "(saved)" : ""}
                  </Label>
                  <Input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="mt-1 border-white/10 bg-black/20 text-white"
                    placeholder={config?.hasApiKey ? "••••••••" : ""}
                  />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label className="text-slate-300">Store ID (HPP)</Label>
                  <Input
                    value={storeId}
                    onChange={(e) => setStoreId(e.target.value)}
                    className="mt-1 border-white/10 bg-black/20 text-white"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">
                    HPP Key {config?.hasHppKey ? "(saved)" : ""}
                  </Label>
                  <Input
                    type="password"
                    value={hppKey}
                    onChange={(e) => setHppKey(e.target.value)}
                    className="mt-1 border-white/10 bg-black/20 text-white"
                    placeholder={config?.hasHppKey ? "••••••••" : ""}
                  />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label className="text-slate-300">Default method</Label>
                  <Select
                    value={defaultMethod}
                    onChange={(e) =>
                      setDefaultMethod(
                        e.target.value as "API_PURCHASE" | "HPP_PURCHASE",
                      )
                    }
                    className="mt-1 border-white/10 bg-black/20 text-white"
                  >
                    <option value="API_PURCHASE">Direct API (mobile wallet)</option>
                    <option value="HPP_PURCHASE">Hosted Payment Page</option>
                  </Select>
                </div>
                <div>
                  <Label className="text-slate-300">Currency</Label>
                  <Input
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                    className="mt-1 border-white/10 bg-black/20 text-white"
                  />
                </div>
              </div>
              <div>
                <Label className="text-slate-300">
                  Callback base URL (HTTPS, public)
                </Label>
                <Input
                  value={callbackBaseUrl}
                  onChange={(e) => setCallbackBaseUrl(e.target.value)}
                  className="mt-1 border-white/10 bg-black/20 text-white"
                  placeholder="https://api.yourdomain.com"
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  Required for HPP. Callbacks hit{" "}
                  <code className="text-slate-400">
                    /api/sms/payments/waafi/callback/*
                  </code>
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <Button onClick={() => void testConnection()} disabled={testing}>
                {testing ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-1.5 h-4 w-4" />
                )}
                Test Connection & Save
              </Button>
              <Button
                variant="outline"
                onClick={() => void toggleEnabled()}
                disabled={
                  !config?.connectionVerified &&
                  !config?.simulationMode &&
                  !enabled
                }
              >
                <Power className="mr-1.5 h-4 w-4" />
                {enabled ? "Disable payments" : "Enable payments"}
              </Button>
              <Button variant="outline" onClick={() => void toggleSimulation()}>
                {simulationMode ? "Turn off simulation" : "Enable simulation mode"}
              </Button>
            </div>

            {simulationMode ? (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                Simulation mode is ON. School package purchases succeed instantly
                without calling WaafiPay. Turn this off before production.
              </div>
            ) : null}

            {!config?.paymentsUnlocked && !simulationMode ? (
              <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
                Payments are locked. Either enter real Hormuud Waafi credentials and
                click <strong>Test Connection & Save</strong>, or click{" "}
                <strong>Enable simulation mode</strong> to demo purchases without
                credentials.
              </div>
            ) : null}

            {config?.connectionMessage ? (
              <p className="text-xs text-slate-400">{config.connectionMessage}</p>
            ) : null}
          </section>

          <section className="space-y-4 rounded-2xl border border-white/10 bg-[#0f172a] p-5">
            <h2 className="font-semibold text-white">Last connection test</h2>
            {lastTest ? (
              <div className="space-y-3">
                <p
                  className={cn(
                    "text-sm font-medium",
                    lastTest.ok ? "text-emerald-300" : "text-rose-300",
                  )}
                >
                  {lastTest.message}
                </p>
                <ul className="space-y-2">
                  {lastTest.steps.map((s) => (
                    <li
                      key={s.step}
                      className="flex items-start gap-2 rounded-lg border border-white/5 bg-black/20 px-3 py-2 text-xs"
                    >
                      {s.ok ? (
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                      ) : (
                        <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400" />
                      )}
                      <div>
                        <p className="font-medium text-slate-200">{s.step}</p>
                        <p className="text-slate-400">{s.message}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                Run Test Connection to verify merchant credentials against WaafiPay.
              </p>
            )}

            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-100/80">
              <p className="font-medium text-amber-200">No Waafi credentials yet?</p>
              <p className="mt-1">
                Register at a WAAFI HQ office to get Merchant UID / API keys, then
                paste them here and test. For local demo without credentials, click{" "}
                <strong>Enable simulation mode</strong>.
              </p>
              <p className="mt-2 font-medium text-amber-200">Sandbox test wallets</p>
              <p className="mt-1">EVCPlus 252611111111 PIN 1212 · ZAAD 252631111111 · SAHAL 252901111111</p>
              <p className="mt-2">
                Packages for schools unlock for purchase only when this gateway is
                verified and enabled (or simulation is on).{" "}
                <Link href="/platform/sms" className="text-violet-300 hover:underline">
                  Manage packages →
                </Link>
              </p>
            </div>
          </section>
        </div>
      ) : (
        <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#0f172a]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-white/10 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">School</th>
                  <th className="px-4 py-3">Package</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Reference</th>
                  <th className="px-4 py-3">Waafi Txn</th>
                  <th className="px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {(overview?.orders ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                      No payment transactions yet.
                    </td>
                  </tr>
                ) : (
                  overview?.orders.map((o) => (
                    <tr key={o.id} className="border-b border-white/5 hover:bg-white/[0.03]">
                      <td className="px-4 py-3">
                        <p className="font-medium text-white">{o.school.name}</p>
                        <p className="text-xs text-slate-500">{o.school.subdomain}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {o.package.name}
                        <span className="block text-xs text-slate-500">
                          {o.credits} credits
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-200">
                        {money(o.amount, o.currency)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-xs font-medium",
                            o.status === "SUCCESS"
                              ? "bg-emerald-500/15 text-emerald-300"
                              : o.status === "FAILED" || o.status === "EXPIRED"
                                ? "bg-rose-500/15 text-rose-300"
                                : o.status === "REFUNDED"
                                  ? "bg-amber-500/15 text-amber-300"
                                  : "bg-sky-500/15 text-sky-300",
                          )}
                        >
                          {o.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-400">
                        {o.receiptNumber ?? o.referenceId}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">
                        {o.waafiTransactionId ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">
                        {new Date(o.paidAt ?? o.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
