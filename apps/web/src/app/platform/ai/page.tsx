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

export default function PlatformAiSettingsPage() {
  const t = useT();
  const [cfg, setCfg] = useState<PlatformAiConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [model, setModel] = useState("gpt-4o-mini");
  const [apiKey, setApiKey] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const c = await fetchPlatformAiConfig();
      setCfg(c);
      setEnabled(c.enabled);
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
            <span>{cfg?.connectionMessage ?? cfg?.connectionStatus ?? "Not tested"}</span>
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
          <Label>{t("platformAi.openaiApiKey")}</Label>
          <Input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={cfg?.hasKey ? `Key set (${cfg.keyHint}) — enter a new key to replace` : "sk-…"}
            autoComplete="off"
          />
          <p className="text-xs text-muted-foreground">
            {t("platformAi.storedSecurelyOnTheServerAnd")}
          </p>
        </div>

        <div className="space-y-2">
          <Label>{t("platformAi.model")}</Label>
          <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder={t("platformAi.gpt4oMini")} />
          <p className="text-xs text-muted-foreground">{t("platformAi.eGGpt4oMiniCheap")}</p>
        </div>

        <div className="flex justify-end">
          <Button className="h-10" disabled={saving} onClick={() => void save()}>
            {saving ? "Saving…" : "Save settings"}
          </Button>
        </div>
      </div>
    </div>
  );
}
