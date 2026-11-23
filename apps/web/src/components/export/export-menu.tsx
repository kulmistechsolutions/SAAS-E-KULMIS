"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, FileDown, FileSpreadsheet, FileText, FileType2, Loader2, Sheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { ApiError } from "@/lib/api";
import { EXPORT_FORMATS, exportTable, type ExportFormat, type ExportSpec } from "@/lib/export/table-export";

const ICON = {
  xlsx: { icon: FileSpreadsheet, tone: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  docx: { icon: FileType2, tone: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  pdf: { icon: FileText, tone: "bg-rose-500/10 text-rose-600 dark:text-rose-400" },
  csv: { icon: Sheet, tone: "bg-slate-500/10 text-slate-600 dark:text-slate-300" },
} as const;

/**
 * "Export ▾" — Excel, Word, PDF or CSV, from any table.
 *
 * Give it `spec` (what to export) and it does the rest, or give it
 * `onPick` when the page first needs to ask something (which columns) and
 * will call exportTable itself.
 */
export function ExportMenu({
  spec,
  onPick,
  disabled,
  label = "Export",
  className,
  formats = ["xlsx", "docx", "pdf", "csv"],
}: {
  spec?: () => ExportSpec;
  onPick?: (format: ExportFormat) => void;
  disabled?: boolean;
  label?: string;
  className?: string;
  formats?: ExportFormat[];
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<ExportFormat | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", down);
      document.removeEventListener("keydown", key);
    };
  }, [open]);

  async function choose(f: ExportFormat) {
    setOpen(false);
    if (onPick) return onPick(f);
    if (!spec) return;
    const s = spec();
    setBusy(f);
    try {
      await exportTable(f, s);
      toast(`Exported ${s.rows.length} rows.`, "success");
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "The export could not be created.", "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div ref={ref} className={cn("relative inline-block", className)}>
      <Button
        type="button"
        variant="outline"
        className="bg-card"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled || busy !== null}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {busy ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <FileDown className="me-2 h-4 w-4" />}
        {label}
        <ChevronDown className={cn("ms-1.5 h-3.5 w-3.5 opacity-60 transition", open && "rotate-180")} />
      </Button>
      {open && (
        <div
          role="menu"
          className="absolute end-0 z-50 mt-1.5 w-56 overflow-hidden rounded-xl border bg-card p-1.5 shadow-xl"
        >
          {EXPORT_FORMATS.filter((f) => formats.includes(f.id)).map((f) => {
            const { icon: Icon, tone } = ICON[f.id];
            return (
              <button
                key={f.id}
                type="button"
                role="menuitem"
                onClick={() => void choose(f.id)}
                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-start text-sm hover:bg-muted"
              >
                <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-md", tone)}>
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block font-medium">{f.label}</span>
                  <span className="block text-xs text-muted-foreground">{f.hint}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
