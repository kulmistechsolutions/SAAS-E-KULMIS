"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRightLeft,
  BadgeCheck,
  ChevronDown,
  FileDown,
  FileSpreadsheet,
  FileText,
  FileType2,
  IdCard,
  Printer,
  ScrollText,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { ApiError } from "@/lib/api";
import {
  DOC_TITLES,
  studentDocumentHtml,
  type DocDesign,
  type StudentDocKind,
  type StudentDocOptions,
} from "@/lib/documents/student-docs";
import { designFor } from "@/lib/print/design-store";
import { exportHtmlToWord, exportTable, type ExportFormat } from "@/lib/export/table-export";
import { DEFAULT_STUDENT_EXPORT_FIELDS, studentsExportSpec } from "@/lib/students/print";
import { updateStudent } from "@/lib/students/store";
import type { StudentWithParent } from "@/lib/students/types";

const DOCS: { kind: StudentDocKind; design: string; icon: LucideIcon; tone: string; hint: string }[] = [
  { kind: "TRANSFER", design: "STUDENT_TRANSFER", icon: ArrowRightLeft, tone: "bg-amber-500/10 text-amber-600 dark:text-amber-400", hint: "Warqadda wareejinta — to another school" },
  { kind: "ADMISSION", design: "STUDENT_ADMISSION", icon: ScrollText, tone: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", hint: "Confirms the student was admitted" },
  { kind: "BONAFIDE", design: "STUDENT_BONAFIDE", icon: BadgeCheck, tone: "bg-sky-500/10 text-sky-600 dark:text-sky-400", hint: "Confirms the student studies here" },
  { kind: "INFORMATION", design: "STUDENT_PROFILE", icon: IdCard, tone: "bg-violet-500/10 text-violet-600 dark:text-violet-400", hint: "Everything on the student's record" },
];

const DATA_FORMATS: { id: ExportFormat; label: string; icon: LucideIcon }[] = [
  { id: "xlsx", label: "Excel", icon: FileSpreadsheet },
  { id: "docx", label: "Word", icon: FileType2 },
  { id: "pdf", label: "PDF", icon: FileText },
  { id: "csv", label: "CSV", icon: FileDown },
];

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * "Documents ▾" on a student's page: the certificates a school hands over —
 * above all the Transfer Certificate, with where the student is going and
 * why — previewed, then printed (or saved as PDF from the print dialog) or
 * downloaded as an editable Word file. The student's data is downloadable
 * from the same menu.
 */
export function StudentDocumentsMenu({
  student,
  canEdit,
  label = "Documents",
}: {
  student: StudentWithParent;
  /** Whether this user may mark the student as transferred. */
  canEdit?: boolean;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<StudentDocKind | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Transfer particulars
  const [toSchool, setToSchool] = useState("");
  const [reason, setReason] = useState("");
  const [leavingDate, setLeavingDate] = useState(todayKey());
  const [conduct, setConduct] = useState("Good");
  const [feesCleared, setFeesCleared] = useState(true);
  const [reference, setReference] = useState("");
  const [markInactive, setMarkInactive] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", down);
    return () => document.removeEventListener("mousedown", down);
  }, [open]);

  useEffect(() => {
    if (kind !== "TRANSFER") return;
    setReference(`TC-${student.code}-${new Date().getFullYear()}`);
  }, [kind, student.code]);

  const options = useMemo<StudentDocOptions | null>(() => {
    if (!kind) return null;
    const def = DOCS.find((d) => d.kind === kind)!;
    const design = designFor(def.design);
    return {
      kind,
      design: design.template as DocDesign,
      paper: design.paper ?? "A4",
      landscape: design.landscape ?? false,
      showLogo: true,
      showStamp: true,
      showQr: false,
      showGuardian: true,
      showAcademic: true,
      reference: kind === "TRANSFER" ? reference.trim() || undefined : undefined,
      transfer:
        kind === "TRANSFER"
          ? { toSchool, reason, leavingDate, conduct, feesCleared }
          : undefined,
    };
  }, [kind, reference, toSchool, reason, leavingDate, conduct, feesCleared]);

  const html = useMemo(
    () => (options ? studentDocumentHtml(student, options) : ""),
    [options, student],
  );
  const fileBase = kind ? `${DOC_TITLES[kind]}-${student.code}`.replace(/\s+/g, "-").toLowerCase() : "";

  async function finishTransfer() {
    if (kind !== "TRANSFER" || !markInactive || student.status === "INACTIVE") return;
    const note = [
      `Transferred${toSchool.trim() ? ` to ${toSchool.trim()}` : ""} on ${leavingDate}`,
      reason.trim() ? `Reason: ${reason.trim()}` : "",
    ]
      .filter(Boolean)
      .join(". ");
    const res = await updateStudent(student.id, {
      status: "INACTIVE",
      notes: [student.notes?.trim(), note].filter(Boolean).join("\n"),
    });
    if (res.ok) toast("Student marked as transferred (inactive).", "success");
    else toast(res.error ?? "Could not update the student.", "error");
  }

  function print() {
    const w = window.open("", "_blank", "width=900,height=1200");
    if (!w) return toast("Allow pop-ups to print.", "error");
    w.document.write(html);
    w.document.close();
    w.focus();
    w.onload = () => w.print();
    void finishTransfer();
  }

  async function word() {
    setBusy(true);
    try {
      await exportHtmlToWord(html, fileBase);
      toast("Word document downloaded.", "success");
      void finishTransfer();
    } catch {
      toast("The Word file could not be created.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function data(format: ExportFormat) {
    setOpen(false);
    try {
      const spec = studentsExportSpec([student], DEFAULT_STUDENT_EXPORT_FIELDS, {
        academicYear: student.academicYear,
        className: student.className,
        section: student.section || "All",
      });
      await exportTable(format, { ...spec, title: `Student Record — ${student.fullName}`, fileName: student.code });
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "The export could not be created.", "error");
    }
  }

  return (
    <>
      <div ref={ref} className="relative inline-block">
        <Button variant="outline" onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open}>
          <FileText className="me-2 h-4 w-4" /> {label}
          <ChevronDown className={cn("ms-1.5 h-3.5 w-3.5 opacity-60 transition", open && "rotate-180")} />
        </Button>
        {open && (
          <div role="menu" className="absolute end-0 z-50 mt-1.5 w-72 overflow-hidden rounded-xl border bg-card p-1.5 shadow-xl">
            <p className="px-2 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Certificates & letters
            </p>
            {DOCS.map((d) => {
              const Icon = d.icon;
              return (
                <button
                  key={d.kind}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOpen(false);
                    setKind(d.kind);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-start text-sm hover:bg-muted"
                >
                  <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-md", d.tone)}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-medium">{DOC_TITLES[d.kind]}</span>
                    <span className="block truncate text-xs text-muted-foreground">{d.hint}</span>
                  </span>
                </button>
              );
            })}
            <p className="mt-1 border-t px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Student data
            </p>
            <div className="grid grid-cols-4 gap-1 px-1 pb-1">
              {DATA_FORMATS.map((f) => {
                const Icon = f.icon;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => void data(f.id)}
                    className="flex flex-col items-center gap-1 rounded-lg py-2 text-xs font-medium hover:bg-muted"
                  >
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    {f.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <Dialog
        open={kind !== null}
        onClose={() => setKind(null)}
        title={kind ? `${DOC_TITLES[kind]} — ${student.fullName}` : ""}
        description={kind === "TRANSFER" ? "Fill in the transfer, check the preview, then print or download." : "Check the preview, then print or download."}
        className="max-w-5xl"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={() => setKind(null)}>Close</Button>
            <Button variant="outline" onClick={() => void word()} disabled={busy}>
              <FileType2 className="me-2 h-4 w-4 text-blue-600" /> {busy ? "Preparing…" : "Download Word"}
            </Button>
            <Button onClick={print}>
              <Printer className="me-2 h-4 w-4" /> Print / Save PDF
            </Button>
          </div>
        }
      >
        <div className={cn("grid gap-4", kind === "TRANSFER" && "lg:grid-cols-[300px_1fr]")}>
          {kind === "TRANSFER" && (
            <div className="space-y-3">
              <div>
                <Label>Transferring to (school)</Label>
                <Input value={toSchool} onChange={(e) => setToSchool(e.target.value)} placeholder="e.g. Hormar Secondary School" />
              </div>
              <div>
                <Label>Date of leaving</Label>
                <Input type="date" value={leavingDate} onChange={(e) => setLeavingDate(e.target.value)} />
              </div>
              <div>
                <Label>Reason for leaving</Label>
                <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Family moved to another city" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Conduct</Label>
                  <Input value={conduct} onChange={(e) => setConduct(e.target.value)} />
                </div>
                <div>
                  <Label>Ref. No.</Label>
                  <Input value={reference} onChange={(e) => setReference(e.target.value)} />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={feesCleared} onChange={(e) => setFeesCleared(e.target.checked)} />
                All fees cleared
              </label>
              {canEdit && student.status !== "INACTIVE" && (
                <label className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-sm">
                  <input type="checkbox" className="mt-0.5" checked={markInactive} onChange={(e) => setMarkInactive(e.target.checked)} />
                  <span>
                    Mark the student as <strong>transferred</strong> (Inactive) when printed or downloaded.
                    <span className="block text-xs text-muted-foreground">
                      Their record, fees and results stay; they leave the active lists.
                    </span>
                  </span>
                </label>
              )}
            </div>
          )}
          <iframe title="Document preview" srcDoc={html} className="h-[62vh] w-full rounded-lg border bg-white" />
        </div>
      </Dialog>
    </>
  );
}
