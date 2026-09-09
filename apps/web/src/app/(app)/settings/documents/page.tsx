"use client";

import { useState } from "react";
import { Check, Eye, FileText, Printer, Receipt, GraduationCap } from "lucide-react";
import { useT, type TranslationKey } from "@/lib/i18n/provider";
import { Button } from "@/components/ui/button";
import { PaperPicker } from "@/components/print/paper-picker";
import { useHydrated } from "@/lib/use-hydrated";
import {
  DOC_TEMPLATES,
  getStoredTemplate,
  setStoredTemplate,
  type DocTemplate,
} from "@/lib/print/template";
import type { PaperSize } from "@/lib/print/paper";
import { receiptDocumentHtml } from "@/lib/fees/print";
import { invoiceDocumentHtml } from "@/lib/fees/invoice";
import { premiumResultCardHtml } from "@/lib/examinations/print";
import { sampleInvoicePosition, samplePayment, sampleResultCard } from "./samples";

/**
 * Which design this school's documents print in.
 *
 * The preview is the real template rendered with stand-in data, not a picture
 * of one. A mock-up that drifts from what actually prints is worse than no
 * preview: a school picks a design from the mock-up and finds out at the desk.
 *
 * One thing this page has to be honest about, and says on it: the choice is
 * remembered for this browser. Storing it for the whole school means a column
 * on the school record, which is a change to the system rather than to how it
 * prints — so a second machine picks its own until that exists.
 */

type DocKind = "RECEIPT" | "INVOICE" | "RESULT";

const KINDS: {
  id: DocKind;
  icon: typeof Receipt;
  titleKey: TranslationKey;
  noteKey: TranslationKey;
}[] = [
  {
    id: "RECEIPT",
    icon: Receipt,
    titleKey: "docTemplates.receipt",
    noteKey: "docTemplates.receiptNote",
  },
  {
    id: "INVOICE",
    icon: FileText,
    titleKey: "docTemplates.invoice",
    noteKey: "docTemplates.invoiceNote",
  },
  {
    id: "RESULT",
    icon: GraduationCap,
    titleKey: "docTemplates.resultCard",
    noteKey: "docTemplates.resultCardNote",
  },
];

export default function DocumentTemplatesPage() {
  const t = useT();
  const mounted = useHydrated();
  const [active, setActive] = useState<DocTemplate>("PREMIUM");
  const [paper, setPaper] = useState<PaperSize>();
  const [seeded, setSeeded] = useState(false);

  // Read on mount, not at render: the server has no localStorage and a
  // mismatch here would be a hydration error rather than a wrong default.
  if (mounted && !seeded) {
    setSeeded(true);
    setActive(getStoredTemplate());
  }

  function choose(next: DocTemplate) {
    setStoredTemplate(next);
    setActive(next);
  }

  function preview(kind: DocKind, template: DocTemplate) {
    const w = window.open("", "_blank", "width=880,height=1000");
    if (!w) return;
    let html: string;
    if (kind === "RECEIPT") {
      html = receiptDocumentHtml(samplePayment(), paper, template);
    } else if (kind === "INVOICE") {
      html = invoiceDocumentHtml(sampleInvoicePosition(), "2026-09", paper, template);
    } else {
      // The classic result card writes its own window and has no HTML to
      // return, so only the branded one can be previewed here.
      html = premiumResultCardHtml(sampleResultCard(), null, paper);
    }
    w.document.write(html);
    w.document.close();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("docTemplates.title")}</h1>
        <p className="mt-1 max-w-prose text-sm text-muted-foreground">
          {t("docTemplates.intro")}
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-4 rounded-2xl border bg-card p-5 shadow-sm">
        <PaperPicker value={paper} onChange={setPaper} />
        <p className="max-w-md text-xs text-muted-foreground">
          {t("docTemplates.thisBrowserNote")}
        </p>
      </div>

      <div className="rounded-2xl border bg-card shadow-sm">
        <div className="border-b p-5">
          <h2 className="font-semibold">{t("docTemplates.designs")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("docTemplates.designsNote")}
          </p>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          {DOC_TEMPLATES.map((d) => {
            const isActive = mounted && active === d.id;
            return (
              <div
                key={d.id}
                className={
                  isActive
                    ? "rounded-xl border-2 border-primary bg-primary/5 p-4"
                    : "rounded-xl border p-4"
                }
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{t(d.labelKey as TranslationKey)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t(d.descriptionKey as TranslationKey)}
                    </p>
                  </div>
                  {isActive && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground">
                      <Check className="h-3 w-3" />
                      {t("docTemplates.active")}
                    </span>
                  )}
                </div>
                <Button
                  variant={isActive ? "outline" : "default"}
                  className="mt-4 h-9 w-full"
                  disabled={!mounted || isActive}
                  onClick={() => choose(d.id)}
                >
                  {isActive ? t("docTemplates.inUse") : t("docTemplates.setDefault")}
                </Button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {KINDS.map((k) => (
          <div key={k.id} className="rounded-2xl border bg-card p-5 shadow-sm">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <k.icon className="h-5 w-5" />
            </span>
            <h3 className="mt-3 font-semibold">{t(k.titleKey)}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{t(k.noteKey)}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                variant="outline"
                className="h-9"
                disabled={!mounted}
                onClick={() => preview(k.id, active)}
              >
                <Eye className="me-2 h-4 w-4" />
                {t("docTemplates.preview")}
              </Button>
              {/* Both designs, side by side, is the comparison a school is
                  actually trying to make when it opens this page. */}
              {k.id !== "RESULT" && (
                <Button
                  variant="outline"
                  className="h-9"
                  disabled={!mounted}
                  onClick={() =>
                    preview(k.id, active === "PREMIUM" ? "CLASSIC" : "PREMIUM")
                  }
                >
                  <Printer className="me-2 h-4 w-4" />
                  {t("docTemplates.previewOther")}
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">{t("docTemplates.sampleNote")}</p>
    </div>
  );
}
