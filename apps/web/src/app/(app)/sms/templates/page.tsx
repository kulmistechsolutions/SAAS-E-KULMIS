"use client";

import { useCallback, useEffect, useState } from "react";
import { useT } from "@/lib/i18n/provider";
import { useHydrated } from "@/lib/use-hydrated";
import { TemplateManager } from "@/components/sms/template-manager";
import { apiSmsTemplates, type SmsTemplate } from "@/lib/sms/api";

/**
 * The school's reusable messages.
 *
 * The editor already existed and works — it counts characters, costs the
 * segments and guards the variables. What it lacked was an address: it lived
 * as a tab inside the send screen, so writing a template meant starting to
 * compose a message you did not intend to send. Reused rather than rebuilt, so
 * there is one editor and not two that can drift apart.
 */
export default function SmsTemplatesPage() {
  const t = useT();
  const mounted = useHydrated();
  const [templates, setTemplates] = useState<SmsTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    if (!mounted) return;
    setFailed(false);
    try {
      setTemplates(await apiSmsTemplates());
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [mounted]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("smsTemplates.title")}</h1>
        <p className="mt-1 max-w-prose text-sm text-muted-foreground">
          {t("smsTemplates.intro")}
        </p>
      </div>

      <div className="rounded-2xl border bg-card p-5 shadow-sm">
        {failed ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {t("smsTemplates.couldNotLoad")}
          </p>
        ) : loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-9 animate-pulse rounded bg-secondary/60" />
            ))}
          </div>
        ) : (
          <TemplateManager templates={templates} onChanged={load} />
        )}
      </div>
    </div>
  );
}
