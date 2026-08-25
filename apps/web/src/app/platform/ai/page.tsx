"use client";


import { useT } from "@/lib/i18n/provider";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Sparkles,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  fetchPlatformAiConfig,
  testPlatformAiConnection,
  updatePlatformAiConfig,
  type PlatformAiConfig,
} from "@/lib/platform/api";
import { toast } from "@/lib/toast";

/** The two services the platform can talk to, and what a key for each looks like. */
const PROVIDERS = [
  { id: "openai", name: "OpenAI", host: "api.openai.com", defaultModel: "gpt-4o-mini" },
  { id: "openrouter", name: "OpenRouter", host: "openrouter.ai", defaultModel: "openai/gpt-4o-mini" },
];

export default function PlatformAiSettingsPage() {
  const t = useT();
  const [cfg, setCfg] = useState<PlatformAiConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [provider, setProvider] = useState("openai");
  const [model, setModel] = useState("gpt-4o-mini");
  const [apiKey, setApiKey] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const c = await fetchPlatformAiConfig();
      setCfg(c);
      setEnabled(c.enabled);
      setProvider(c.provider ?? "openai");
      setModel(c.model);
      setApiKey("");
    } catch {
      toast("Could not load AI settings", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    setSaving(true);
    try {
      const c = await updatePlatformAiConfig({
        enabled,
        provider,
        model: model.trim() || "gpt-4o-mini",
        ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
      });
      setCfg(c);
      setApiKey("");
      toast("AI settings saved", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Save failed", "error");
    } finally {
      setSaving(false);
    }
  }

  async function test() {
    setTesting(true);
    try {
      const r = await testPlatformAiConnection();
      toast(r.message, r.ok ? "success" : "error");
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Test failed", "error");
    } finally {
      setTesting(false);
    }
  }

  if (loading) return <p className="p-8 text-muted-foreground">{t("platformAi.loading")}</p>;

  const connected = cfg?.connectionStatus === "CONNECTED";

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <Link href="/platform" className="inline-flex items-center gap-2 text-sm text-primary">
          <ArrowLeft className="h-4 w-4" />{t("platformAi.dashboard")}
        </Link>
        <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold">
          <Sparkles className="h-6 w-6 text-primary" />{t("platformAi.aiGradingOpenai")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("platformAi.platformWideOpenaiKeyUsedTo")}
        </p>
      </div>

      <div className="space-y-5 rounded-xl border bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div className="flex items-center gap-2 text-sm">
            {connected ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            ) : (
              <XCircle className="h-4 w-4 text-muted-foreground" />
            )}
            <span>{cfg?.connectionMessage ?? cfg?.connectionStatus ?? t("platformAi.notTested")}</span>
          </div>
          <Button variant="outline" className="h-9" disabled={testing} onClick={() => void test()}>
            {testing ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}
            {t("platformAi.testConnection")}
          </Button>
        </div>

        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="h-4 w-4" />
          {t("platformAi.enableAiAutoGrading")}
        </label>

        <div className="space-y-2">
          <Label>{t("platformAi.provider")}</Label>
          <div className="grid gap-2 sm:grid-cols-2">
            {PROVIDERS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setProvider(p.id);
                  // The default model name differs per provider; carrying the
                  // old one over is the mistake that makes a good key look
                  // broken, so offer the right shape as soon as they switch.
                  if (p.id !== provider) setModel(p.defaultModel);
                }}
                className={
                  "rounded-lg border p-3 text-start text-sm transition " +
                  (provider === p.id
                    ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                    : "hover:bg-secondary")
                }
              >
                <span className="block font-medium">{p.name}</span>
                <span className="block text-xs text-muted-foreground">{p.host}</span>
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{t("platformAi.providerHelp")}</p>
          {cfg?.provider && cfg.provider !== provider && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              {t("platformAi.providerChanged")}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label>{t("platformAi.openaiApiKey")}</Label>
          <Input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={
              cfg?.hasKey
                ? `Key set (${cfg.keyHint}) — enter a new key to replace`
                : provider === "openrouter"
                  ? "sk-or-v1-…"
                  : "sk-…"
            }
            autoComplete="off"
          />
          <p className="text-xs text-muted-foreground">
            {t("platformAi.storedSecurelyOnTheServerAnd")}
          </p>
          <p className="text-xs text-muted-foreground">
            {provider === "openrouter"
              ? t("platformAi.keyHintOpenrouter")
              : t("platformAi.keyHintOpenai")}
          </p>
        </div>

        <div className="space-y-2">
          <Label>{t("platformAi.model")}</Label>
          <Input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder={provider === "openrouter" ? "openai/gpt-4o-mini" : "gpt-4o-mini"}
          />
          <p className="text-xs text-muted-foreground">
            {provider === "openrouter"
              ? t("platformAi.modelHintOpenrouter")
              : t("platformAi.modelHintOpenai")}
          </p>
        </div>

        <div className="flex justify-end">
          <Button className="h-10" disabled={saving} onClick={() => void save()}>
            {saving ? t("platformAi.saving") : t("platformAi.saveSettings")}
          </Button>
        </div>
      </div>
    </div>
  );
}
