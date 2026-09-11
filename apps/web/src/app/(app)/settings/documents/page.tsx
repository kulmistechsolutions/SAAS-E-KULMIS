"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, Printer, RotateCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { toast } from "@/lib/toast";
import { useHydrated } from "@/lib/use-hydrated";
import {
  CATEGORIES,
  CATEGORY_LABEL,
  DOC_TYPES,
  type DocCategory,
  type DocTypeDef,
} from "@/lib/print/catalogue";
import {
  designFor,
  isCustomised,
  loadPrintSettings,
  resetPrintDesign,
  savePrintDesign,
  usePrintSettings,
} from "@/lib/print/design-store";
import { PAPER_ORDER, PAPER_SIZES, type PaperSize } from "@/lib/print/paper";
import { receiptDocumentHtml } from "@/lib/fees/print";
import { invoiceDocumentHtml } from "@/lib/fees/invoice";
import { premiumResultCardHtml } from "@/lib/examinations/print";
import { studentDocumentHtml } from "@/lib/documents/student-docs";
import {
  sampleInvoicePosition,
  samplePayment,
  sampleResultCard,
  sampleStudent,
} from "./samples";

/**
 * Print & Document Designs — where a school decides how its paperwork looks.
 *
 * Configure once, use everywhere: every Print button in the system asks this
 * school's settings which design to use, so a receipt collected at the desk,
 * reprinted from history, or printed by a different clerk on a different
 * machine all come out the same.
 *
 * The choice lives on the school record, which is what makes it a school's
 * decision rather than a browser's. It is presentation and nothing else — a
 * template id selects a layout the code already contains. Changing it changes
 * how future documents look and never what any of them say, so a receipt
 * printed in September stays the receipt it was.
 *
 * Previews are the real templates rendered with stand-in data, not pictures of
 * them. A mock-up that drifts from what prints is worse than no preview: a
 * school picks from the mock-up and finds out at the desk.
 */

type Filter = "ALL" | DocCategory;

export default function PrintDesignsPage() {
  const hydrated = useHydrated();
  const settings = usePrintSettings();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("ALL");
  const [preview, setPreview] = useState<{ title: string; html: string } | null>(
    null,
  );

  useEffect(() => {
    void loadPrintSettings();
  }, []);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return DOC_TYPES.filter(
      (d) =>
        (filter === "ALL" || d.category === filter) &&
        (!needle ||
          d.label.toLowerCase().includes(needle) ||
          d.note.toLowerCase().includes(needle)),
    );
  }, [q, filter]);

  const byCategory = useMemo(() => {
    return CATEGORIES.map((c) => ({
      category: c,
      docs: visible.filter((d) => d.category === c),
    })).filter((g) => g.docs.length > 0);
  }, [visible]);

  /**
   * The real template, rendered with stand-in data.
   *
   * Documents whose preview needs data this page cannot invent — a whole
   * class's marks, a term's payment history — say so rather than showing a
   * half-filled sheet that misrepresents the design.
   */
  const buildPreview = useCallback(
    (def: DocTypeDef, template: string, paper: PaperSize): string | null => {
      switch (def.id) {
        case "FEE_RECEIPT":
          return receiptDocumentHtml(
            samplePayment(),
            paper,
            template as "CLASSIC" | "PREMIUM",
          );
        case "FEE_INVOICE":
          return invoiceDocumentHtml(
            sampleInvoicePosition(),
            new Date().toISOString().slice(0, 7),
            paper,
            template as "CLASSIC" | "PREMIUM",
          );
        case "EXAM_RESULT_CARD":
          // No QR on a sample: the code would carry a student id that is not
          // one, and a scannable sample is a sample somebody trusts.
          return template === "PREMIUM"
            ? premiumResultCardHtml(sampleResultCard(), null, paper)
            : null;
        case "STUDENT_PROFILE":
        case "STUDENT_ADMISSION":
        case "STUDENT_TRANSFER":
        case "STUDENT_BONAFIDE":
          return studentDocumentHtml(sampleStudent(), {
            kind:
              def.id === "STUDENT_PROFILE"
                ? "INFORMATION"
                : def.id === "STUDENT_ADMISSION"
                  ? "ADMISSION"
                  : def.id === "STUDENT_TRANSFER"
                    ? "TRANSFER"
                    : "BONAFIDE",
            design: template as "MODERN" | "SIMPLE" | "ELEGANT" | "MINIMAL",
            paper,
            landscape: false,
            showLogo: true,
            showStamp: true,
            showQr: false,
            showGuardian: true,
            showAcademic: true,
          });
        default:
          // Teacher, parent and staff documents share the student engine's
          // four designs, so the student sheet above is a faithful preview of
          // the layout even though the facts on it differ.
          return studentDocumentHtml(sampleStudent(), {
            kind: "INFORMATION",
            design: template as "MODERN" | "SIMPLE" | "ELEGANT" | "MINIMAL",
            paper,
            landscape: false,
            showLogo: true,
            showStamp: true,
            showQr: false,
            showGuardian: true,
            showAcademic: true,
          });
      }
    },
    [],
  );

  if (!hydrated) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Printer className="h-6 w-6 text-primary" />
          Print &amp; Document Designs
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure and manage the appearance of every printable document your
          school produces. Choosing a design changes how future documents look,
          never what they say.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border bg-card p-4 shadow-sm">
        <div className="relative min-w-[220px] flex-1">
          <Label>Search</Label>
          <Search className="pointer-events-none absolute start-3 top-[34px] h-4 w-4 text-muted-foreground" />
          <Input
            className="mt-1 ps-9"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Receipt, result card, information sheet..."
          />
        </div>
        <div className="min-w-[180px]">
          <Label>Category</Label>
          <Select
            className="mt-1"
            value={filter}
            onChange={(e) => setFilter(e.target.value as Filter)}
          >
            <option value="ALL">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {byCategory.length === 0 && (
        <p className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground shadow-sm">
          No document matches that.
        </p>
      )}

      {byCategory.map((group) => (
        <section key={group.category} className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {CATEGORY_LABEL[group.category]}
          </h2>
          <div className="space-y-3">
            {group.docs.map((def) => (
              <DocRow
                key={def.id}
                def={def}
                onPreview={(template, paper) => {
                  const html = buildPreview(def, template, paper);
                  if (!html) {
                    toast(
                      "This design has no preview — it is rendered from live exam data.",
                      "info",
                    );
                    return;
                  }
                  setPreview({ title: def.label, html });
                }}
              />
            ))}
          </div>
        </section>
      ))}

      {preview && (
        <PreviewDialog
          title={preview.title}
          html={preview.html}
          onClose={() => setPreview(null)}
        />
      )}

      {/* Referenced so a settings change re-renders the rows below it. */}
      <span className="hidden">{Object.keys(settings).length}</span>
    </div>
  );
}

function DocRow({
  def,
  onPreview,
}: {
  def: DocTypeDef;
  onPreview: (template: string, paper: PaperSize) => void;
}) {
  const current = designFor(def.id);
  const customised = isCustomised(def.id);

  const [template, setTemplate] = useState(current.template);
  const [paper, setPaper] = useState<PaperSize>(current.paper ?? def.defaultPaper);
  const [landscape, setLandscape] = useState(current.landscape ?? false);
  const [saving, setSaving] = useState(false);

  // The row follows the store: after a save or a reset the values below are
  // the ones that will actually print.
  useEffect(() => {
    setTemplate(current.template);
    setPaper(current.paper ?? def.defaultPaper);
    setLandscape(current.landscape ?? false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current.template, current.paper, current.landscape]);

  const dirty =
    template !== current.template ||
    paper !== (current.paper ?? def.defaultPaper) ||
    landscape !== (current.landscape ?? false);

  async function save() {
    setSaving(true);
    try {
      await savePrintDesign(def.id, { template, paper, landscape });
      toast(`${def.label} will now print in ${templateLabel(def, template)}.`, "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save", "error");
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    setSaving(true);
    try {
      await resetPrintDesign(def.id);
      toast(`${def.label} is back to the system default.`, "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not reset", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold">
            {def.label}
            {!customised && (
              <span className="ms-2 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                Default
              </span>
            )}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">{def.note}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Printed from {def.printedFrom}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            className="h-9"
            onClick={() => onPreview(template, paper)}
          >
            <Eye className="me-2 h-4 w-4" /> Preview
          </Button>
          {customised && (
            <Button
              variant="outline"
              className="h-9"
              onClick={() => void reset()}
              disabled={saving}
            >
              <RotateCcw className="me-2 h-4 w-4" /> Reset
            </Button>
          )}
          <Button className="h-9" onClick={() => void save()} disabled={saving || !dirty}>
            {saving ? "Saving..." : dirty ? "Save" : "Saved"}
          </Button>
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <div>
          <Label>Template</Label>
          <Select
            className="mt-1"
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
          >
            {def.templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </Select>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {def.templates.find((t) => t.id === template)?.note}
          </p>
        </div>
        <div>
          <Label>Paper size</Label>
          <Select
            className="mt-1"
            value={paper}
            onChange={(e) => setPaper(e.target.value as PaperSize)}
          >
            {PAPER_ORDER.map((id) => (
              <option key={id} value={id}>
                {PAPER_SIZES[id].id}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Orientation</Label>
          <Select
            className="mt-1"
            value={landscape ? "L" : "P"}
            onChange={(e) => setLandscape(e.target.value === "L")}
          >
            <option value="P">Portrait</option>
            <option value="L">Landscape</option>
          </Select>
        </div>
      </div>
    </div>
  );
}

function templateLabel(def: DocTypeDef, id: string): string {
  return def.templates.find((t) => t.id === id)?.label ?? id;
}

function PreviewDialog({
  title,
  html,
  onClose,
}: {
  title: string;
  html: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex h-[90vh] w-full max-w-3xl flex-col rounded-2xl border bg-card shadow-xl">
        <div className="flex items-center justify-between gap-3 border-b px-5 py-3">
          <div>
            <h2 className="font-semibold">{title}</h2>
            <p className="text-xs text-muted-foreground">
              {/* Said out loud so nobody reads the sample as a real record. */}
              Sample data — the real document uses the record you print it from.
            </p>
          </div>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
        <iframe
          title={`${title} preview`}
          srcDoc={html}
          className="min-h-0 flex-1 rounded-b-2xl bg-white"
        />
      </div>
    </div>
  );
}
