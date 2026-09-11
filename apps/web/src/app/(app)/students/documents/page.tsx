"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BadgeCheck,
  CreditCard,
  FileSpreadsheet,
  FileText,
  IdCard,
  Printer,
  RefreshCw,
  Search,
  UserRound,
} from "lucide-react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useHydrated } from "@/lib/use-hydrated";
import {
  refreshStudents,
  useStudentsState,
  withParents,
} from "@/lib/students/store";
import { PaperPicker } from "@/components/print/paper-picker";
import { StudentsTabs } from "@/components/students/students-tabs";
import type { PaperSize } from "@/lib/print/paper";
import { accentColour } from "@/lib/print/letterhead";
import {
  DOC_TITLES,
  printStudentDocument,
  printStudentDocuments,
  studentDocumentHtml,
  type DocDesign,
  type StudentDocKind,
  type StudentDocOptions,
} from "@/lib/documents/student-docs";

/**
 * The Document Center, for students.
 *
 * One place to turn a student record into the paperwork a school actually
 * hands out. Nothing is typed in here and nothing is saved: the sheet shows
 * the class the student is in today because it reads it when the page builds
 * it, and closing the page leaves the record exactly as it was.
 *
 * The preview is the document. It is the same HTML the print window receives,
 * rendered in a frame — a preview assembled separately from the print is a
 * preview that eventually lies about what comes out of the printer.
 */

const KINDS: {
  id: StudentDocKind;
  label: string;
  icon: typeof FileText;
  note: string;
}[] = [
  {
    id: "INFORMATION",
    label: "Student Information",
    icon: UserRound,
    note: "Everything on record, on one sheet.",
  },
  {
    id: "ADMISSION",
    label: "Admission Letter",
    icon: FileText,
    note: "Confirms a place and a class.",
  },
  {
    id: "TRANSFER",
    label: "Transfer Certificate",
    icon: FileSpreadsheet,
    note: "Releases a student to another school.",
  },
  {
    id: "BONAFIDE",
    label: "Bonafide Certificate",
    icon: BadgeCheck,
    note: "Certifies a student is enrolled here.",
  },
];

const DESIGNS: { id: DocDesign; label: string; note: string }[] = [
  { id: "MODERN", label: "Official Letter (Modern)", note: "Coloured section bands" },
  { id: "SIMPLE", label: "Simple Letter", note: "Grey headings, plain rules" },
  { id: "ELEGANT", label: "Elegant Letter", note: "Rules only, wide letter-spacing" },
  { id: "MINIMAL", label: "Minimal Letter", note: "No boxes, no photo" },
];

export default function StudentDocumentsPage() {
  const hydrated = useHydrated();
  const state = useStudentsState();
  const students = useMemo(() => withParents(state), [state]);

  const [kind, setKind] = useState<StudentDocKind>("INFORMATION");
  const [design, setDesign] = useState<DocDesign>("MODERN");
  const [studentId, setStudentId] = useState("");
  const [q, setQ] = useState("");
  const [paper, setPaper] = useState<PaperSize>();
  const [landscape, setLandscape] = useState(false);
  const [reference, setReference] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  // One student, or a whole class in one stack of paper.
  const [batch, setBatch] = useState(false);
  const [batchClass, setBatchClass] = useState("");
  const [batchSection, setBatchSection] = useState("");
  const [printing, setPrinting] = useState(false);

  const [showLogo, setShowLogo] = useState(true);
  const [showStamp, setShowStamp] = useState(true);
  const [showQr, setShowQr] = useState(false);
  const [showGuardian, setShowGuardian] = useState(true);
  const [showAcademic, setShowAcademic] = useState(true);

  useEffect(() => {
    void refreshStudents();
  }, []);

  const matches = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const active = students.filter((s) => s.status === "ACTIVE");
    if (!needle) return active.slice(0, 50);
    return active
      .filter(
        (s) =>
          s.fullName.toLowerCase().includes(needle) ||
          s.code.toLowerCase().includes(needle) ||
          s.className.toLowerCase().includes(needle),
      )
      .slice(0, 50);
  }, [students, q]);

  const student = useMemo(
    () => students.find((s) => s.id === studentId) ?? null,
    [students, studentId],
  );

  /** Classes with at least one active student, in the order a school reads them. */
  const classes = useMemo(() => {
    const names = new Set(
      students.filter((s) => s.status === "ACTIVE").map((s) => s.className),
    );
    return [...names].sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true }),
    );
  }, [students]);

  const sections = useMemo(() => {
    const names = new Set(
      students
        .filter((s) => s.status === "ACTIVE" && s.className === batchClass && s.section)
        .map((s) => s.section as string),
    );
    return [...names].sort();
  }, [students, batchClass]);

  // Who the batch would actually print, in list order.
  const batchStudents = useMemo(() => {
    if (!batchClass) return [];
    return students
      .filter(
        (s) =>
          s.status === "ACTIVE" &&
          s.className === batchClass &&
          (!batchSection || s.section === batchSection),
      )
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [students, batchClass, batchSection]);

  // The class list changes under a chosen section when the class changes.
  useEffect(() => {
    if (batchSection && !sections.includes(batchSection)) setBatchSection("");
  }, [sections, batchSection]);

  useEffect(() => {
    if (!batchClass && classes.length > 0) setBatchClass(classes[0]);
  }, [classes, batchClass]);

  // Pick the first match rather than leaving the page empty on arrival.
  useEffect(() => {
    if (!studentId && matches.length > 0) setStudentId(matches[0].id);
  }, [matches, studentId]);

  // In batch mode the preview is the first sheet of the batch: rendering all
  // forty into a frame nobody scrolls costs a second for no one's benefit.
  const previewOf = batch ? (batchStudents[0] ?? null) : student;

  // The QR carries the Student ID and nothing else — the same rule the ID
  // card follows. A scanner reveals nothing a person holding the sheet cannot
  // already read off it.
  useEffect(() => {
    if (!showQr || !previewOf) {
      setQrDataUrl(null);
      return;
    }
    let live = true;
    void QRCode.toDataURL(previewOf.code, {
      errorCorrectionLevel: "M",
      margin: 0,
      width: 240,
      color: { dark: "#0f172a", light: "#ffffff" },
    })
      .then((url) => {
        if (live) setQrDataUrl(url);
      })
      .catch(() => {
        if (live) setQrDataUrl(null);
      });
    return () => {
      live = false;
    };
  }, [showQr, previewOf]);

  const options: StudentDocOptions = {
    kind,
    design,
    paper: paper ?? "A4",
    landscape,
    showLogo,
    showStamp,
    showQr,
    showGuardian,
    showAcademic,
    qrDataUrl,
    reference: reference.trim() || undefined,
  };

  const html = useMemo(
    () => (previewOf ? studentDocumentHtml(previewOf, options) : ""),
    // The document is rebuilt whenever anything it draws from changes, which
    // is what makes the preview trustworthy.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [previewOf, kind, design, paper, landscape, showLogo, showStamp, showQr,
     showGuardian, showAcademic, qrDataUrl, reference],
  );

  const print = useCallback(async () => {
    if (!batch) {
      if (student) printStudentDocument(student, options);
      return;
    }
    if (batchStudents.length === 0) return;
    setPrinting(true);
    try {
      // Each sheet carries its own student's code, so the codes are rendered
      // up front rather than inside the string builder — which stays pure so
      // the preview and the print can both call it.
      let qrByStudent: Record<string, string | null> | undefined;
      if (showQr) {
        const pairs = await Promise.all(
          batchStudents.map(async (st) => {
            try {
              return [
                st.id,
                await QRCode.toDataURL(st.code, {
                  errorCorrectionLevel: "M",
                  margin: 0,
                  width: 240,
                  color: { dark: "#0f172a", light: "#ffffff" },
                }),
              ] as const;
            } catch {
              return [st.id, null] as const;
            }
          }),
        );
        qrByStudent = Object.fromEntries(pairs);
      }
      printStudentDocuments(batchStudents, options, qrByStudent);
    } finally {
      setPrinting(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batch, student, batchStudents, showQr, html]);

  if (!hydrated) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Printer className="h-6 w-6 text-primary" />
            Student Documents
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Generate and print official student documents. Nothing here changes
            a student record.
          </p>
        </div>
        <Button variant="outline" onClick={() => void refreshStudents()}>
          <RefreshCw className="me-2 h-4 w-4" /> Refresh
        </Button>
      </div>

      <StudentsTabs />

      <div className="grid items-start gap-4 xl:grid-cols-[320px,minmax(0,1fr),260px]">
        {/* ── Left: what, for whom, how ─────────────────────────────── */}
        <div className="space-y-4">
          <Panel n={1} title="Select Document Type">
            <div className="grid grid-cols-2 gap-2">
              {KINDS.map((k) => (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => setKind(k.id)}
                  className={`rounded-xl border p-3 text-start transition-colors ${
                    kind === k.id
                      ? "border-primary bg-primary/5"
                      : "hover:bg-secondary/50"
                  }`}
                >
                  <k.icon
                    className={`h-5 w-5 ${kind === k.id ? "text-primary" : "text-muted-foreground"}`}
                  />
                  <p className="mt-1.5 text-xs font-semibold leading-tight">
                    {k.label}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {k.note}
                  </p>
                </button>
              ))}
            </div>
          </Panel>

          <Panel n={2} title="Select Student">
            <div className="mb-3 grid grid-cols-2 gap-2 rounded-xl bg-secondary/50 p-1">
              <ModeTab active={!batch} onClick={() => setBatch(false)}>
                One student
              </ModeTab>
              <ModeTab active={batch} onClick={() => setBatch(true)}>
                Whole class
              </ModeTab>
            </div>

            {batch ? (
              <div className="space-y-2">
                <div>
                  <Label>Class</Label>
                  <Select
                    className="mt-1"
                    value={batchClass}
                    onChange={(e) => setBatchClass(e.target.value)}
                  >
                    {classes.length === 0 && <option value="">No classes</option>}
                    {classes.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Select>
                </div>
                {sections.length > 0 && (
                  <div>
                    <Label>Section</Label>
                    <Select
                      className="mt-1"
                      value={batchSection}
                      onChange={(e) => setBatchSection(e.target.value)}
                    >
                      <option value="">All sections</option>
                      {sections.map((sec) => (
                        <option key={sec} value={sec}>
                          {sec}
                        </option>
                      ))}
                    </Select>
                  </div>
                )}
                <p className="rounded-lg bg-secondary/60 px-3 py-2 text-xs">
                  <strong>{batchStudents.length}</strong>{" "}
                  {batchStudents.length === 1 ? "student" : "students"} ·{" "}
                  {batchStudents.length}{" "}
                  {batchStudents.length === 1 ? "page" : "pages"}, one each.
                </p>
              </div>
            ) : (
            <>
            <div className="relative">
              <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Name, student ID or class"
                className="ps-9"
              />
            </div>
            <Select
              className="mt-2"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
            >
              {matches.length === 0 && <option value="">No match</option>}
              {matches.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.fullName} — {s.code} — {s.className}
                  {s.section ? ` ${s.section}` : ""}
                </option>
              ))}
            </Select>
            {student && (
              <p className="mt-2 text-xs text-muted-foreground">
                {student.className}
                {student.section ? ` · ${student.section}` : ""} ·{" "}
                {student.academicYear}
              </p>
            )}
            </>
            )}
          </Panel>

          <Panel n={3} title="Document Options">
            <div className="space-y-3">
              <div>
                <Label>Design</Label>
                <Select
                  className="mt-1"
                  value={design}
                  onChange={(e) => setDesign(e.target.value as DocDesign)}
                >
                  {DESIGNS.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <PaperPicker value={paper} onChange={setPaper} />
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
              {kind !== "INFORMATION" && (
                <div>
                  <Label>Reference number (optional)</Label>
                  <Input
                    className="mt-1"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="LTR-2026-000001"
                  />
                </div>
              )}

              <div className="space-y-1 border-t pt-3">
                <Toggle label="Show school logo" checked={showLogo} onChange={setShowLogo} />
                <Toggle label="Show school stamp" checked={showStamp} onChange={setShowStamp} />
                <Toggle label="Show QR code" checked={showQr} onChange={setShowQr} />
                <Toggle
                  label="Include guardian information"
                  checked={showGuardian}
                  onChange={setShowGuardian}
                />
                <Toggle
                  label="Include academic information"
                  checked={showAcademic}
                  onChange={setShowAcademic}
                />
              </div>
            </div>
          </Panel>

          <Panel n={4} title="Actions">
            <Button
              className="w-full"
              onClick={() => void print()}
              disabled={printing || (batch ? batchStudents.length === 0 : !student)}
            >
              <Printer className="me-2 h-4 w-4" />
              {printing
                ? "Preparing..."
                : batch
                  ? `Print ${batchStudents.length} \u00d7 ${DOC_TITLES[kind]}`
                  : `Print ${DOC_TITLES[kind]}`}
            </Button>
            <p className="mt-2 text-xs text-muted-foreground">
              {/* Browsers save to PDF from the same dialog, so a separate
                  download button would be a second name for one action. */}
              Choose &ldquo;Save as PDF&rdquo; in the print dialog to download.
            </p>
          </Panel>
        </div>

        {/* ── Middle: the document itself ───────────────────────────── */}
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="font-semibold">Document Preview</h2>
            <span className="text-xs text-muted-foreground">
              {options.paper} · {landscape ? "Landscape" : "Portrait"}
              {batch && batchStudents.length > 0
                ? ` · showing 1 of ${batchStudents.length}`
                : ""}
            </span>
          </div>
          {previewOf ? (
            <iframe
              title="Document preview"
              srcDoc={html}
              className="h-[820px] w-full rounded-xl border bg-white"
            />
          ) : (
            <p className="py-20 text-center text-sm text-muted-foreground">
              {batch
                ? "That class has no active students."
                : "Choose a student to see the document."}
            </p>
          )}
        </div>

        {/* ── Right: designs and the documents that live elsewhere ──── */}
        <div className="space-y-4">
          <div className="rounded-2xl border bg-card p-4 shadow-sm">
            <h2 className="font-semibold">Document Templates</h2>
            <div className="mt-3 space-y-2">
              {DESIGNS.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setDesign(d.id)}
                  className={`w-full rounded-xl border p-3 text-start transition-colors ${
                    design === d.id
                      ? "border-primary bg-primary/5"
                      : "hover:bg-secondary/50"
                  }`}
                >
                  <p className="text-sm font-medium">{d.label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{d.note}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border bg-card p-4 shadow-sm">
            <h2 className="font-semibold">Quick Documents</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {/* Built elsewhere and linked rather than rebuilt here: a second
                  receipt generator is a second set of figures to disagree. */}
              These print from the module that owns their data.
            </p>
            <div className="mt-3 space-y-1.5">
              <QuickLink href="/id-cards" icon={IdCard} label="ID Card" />
              <QuickLink
                href="/finance/collect"
                icon={CreditCard}
                label="Receipt & Fee Statement"
              />
              <QuickLink
                href="/examinations"
                icon={FileSpreadsheet}
                label="Result Card"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Panel({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
          {n}
        </span>
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 py-1 text-sm">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

function QuickLink({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: typeof IdCard;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 rounded-lg border p-2.5 text-sm transition-colors hover:bg-secondary/50"
    >
      <Icon className="h-4 w-4 text-muted-foreground" />
      {label}
    </Link>
  );
}

/** One half of the one-student / whole-class switch. */
function ModeTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? "bg-card text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
