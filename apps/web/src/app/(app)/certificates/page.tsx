"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Award,
  CheckSquare,
  GraduationCap,
  LayoutTemplate,
  Palette,
  Printer,
  RotateCcw,
  Save,
  Search,
  Square,
  User,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CardDesigner } from "@/components/id-cards/card-designer";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { ApiError } from "@/lib/api";
import { useHydrated } from "@/lib/use-hydrated";
import { useAuth } from "@/lib/auth";
import {
  activeAcademicYear,
  classNamesForYear,
  sectionNamesForClass,
  useAcademicsState,
} from "@/lib/academics/store";
import { useStudentsState } from "@/lib/students/store";
import { designFor, loadPrintSettings, savePrintDesign, usePrintSettings } from "@/lib/print/design-store";
import { FONT_LINK, type CardDesign } from "@/lib/id-cards/elements";
import {
  CERTIFICATE_DESIGNS,
  CERTIFICATE_FIELDS,
  CERTIFICATE_PLACEHOLDERS,
  CERT_H,
  CERT_W,
  accentOf,
  certificateContext,
  defaultLayout,
  defaultSettings,
  frameHtml,
  printCertificates,
  type CertificateDesign,
  type CertificateSettings,
  type CertificateStudent,
} from "@/lib/certificates/designs";

const KEY = "CERTIFICATE";

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** The school's saved certificate, or the default when it has none. */
function savedSettings(): CertificateSettings | null {
  const choice = designFor(KEY);
  if (!choice.fields && !choice.layout && !choice.bodyText) return null;
  const design = CERTIFICATE_DESIGNS.some((d) => d.id === choice.template)
    ? (choice.template as CertificateDesign)
    : "CLASSIC";
  const base = defaultSettings(design);
  const f = choice.fields ?? {};
  const str = (k: string, fallback: string) => (typeof f[k] === "string" ? (f[k] as string) : fallback);
  let layout: CardDesign = base.layout;
  try {
    const parsed = choice.layout ? (JSON.parse(choice.layout) as CardDesign) : null;
    if (parsed && Array.isArray(parsed.elements)) {
      layout = { width: CERT_W, height: CERT_H, accent: parsed.accent || base.layout.accent, elements: parsed.elements };
    }
  } catch {
    /* a damaged layout falls back to the default */
  }
  return {
    design,
    accent: str("accent", ""),
    title: str("title", base.title),
    subtitle: str("subtitle", base.subtitle),
    body: choice.bodyText ?? base.body,
    numberPrefix: str("numberPrefix", base.numberPrefix),
    layout,
  };
}

/**
 * Certificates — a graduation certificate for one student or a whole class.
 *
 * Built on the ID-card designer: every word, line, the logo, the seal,
 * signatures and the student's photo are items the school drags, resizes
 * and restyles on an A4 landscape sheet, over one of four frames. The same
 * renderer prints it, one sheet per student.
 */
export default function CertificatesPage() {
  const mounted = useHydrated();
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMINISTRATOR" || user?.role === "SUPER_ADMINISTRATOR";
  const studentsState = useStudentsState();
  const academics = useAcademicsState();
  const printSettings = usePrintSettings();

  const [s, setS] = useState<CertificateSettings>(() => defaultSettings());
  const [fromSaved, setFromSaved] = useState(false);
  const [mode, setMode] = useState<"class" | "single">("class");
  const [year, setYear] = useState("");
  const [klass, setKlass] = useState("");
  const [section, setSection] = useState("");
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [single, setSingle] = useState("");
  const [issueDate, setIssueDate] = useState(todayKey());
  const [grade, setGrade] = useState("");
  const [saving, setSaving] = useState(false);
  const [previewId, setPreviewId] = useState("");

  useEffect(() => {
    if (!mounted) return;
    void loadPrintSettings();
    setYear(activeAcademicYear());
    // The designer canvas needs the certificate typefaces too.
    if (!document.querySelector(`link[href="${FONT_LINK}"]`)) {
      const l = document.createElement("link");
      l.rel = "stylesheet";
      l.href = FONT_LINK;
      document.head.appendChild(l);
    }
  }, [mounted]);

  useEffect(() => {
    if (!mounted || fromSaved || !printSettings[KEY]) return;
    const saved = savedSettings();
    if (saved) setS(saved);
    setFromSaved(true);
  }, [mounted, printSettings, fromSaved]);

  const classes = useMemo(() => (mounted && year ? classNamesForYear(year) : []), [mounted, year, academics.classes]);
  const sections = useMemo(() => (klass ? sectionNamesForClass(klass, year) : []), [klass, year, academics.sections]);

  const all: CertificateStudent[] = useMemo(
    () =>
      studentsState.students
        .filter((st) => st.status !== "INACTIVE")
        .map((st) => ({
          id: st.id,
          code: st.code,
          fullName: st.fullName,
          className: st.className,
          section: st.section,
          academicYear: st.academicYear,
          dob: st.dob,
          photoUrl: st.photoUrl,
        })),
    [studentsState.students],
  );

  const classStudents = useMemo(
    () =>
      all
        .filter((st) => (!year || st.academicYear === year) && st.className === klass)
        .filter((st) => !section || st.section === section)
        .sort((a, b) => a.fullName.localeCompare(b.fullName)),
    [all, year, klass, section],
  );

  useEffect(() => {
    setPicked(new Set(classStudents.map((st) => st.id)));
  }, [klass, section, year, classStudents.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const searchHits = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q.length < 2) return [];
    return all.filter((st) => st.fullName.toLowerCase().includes(q) || st.code.toLowerCase().includes(q)).slice(0, 12);
  }, [all, search]);

  const chosen = useMemo(
    () => (mode === "single" ? all.filter((st) => st.id === single) : classStudents.filter((st) => picked.has(st.id))),
    [mode, all, single, classStudents, picked],
  );

  const previewStudent: CertificateStudent = chosen.find((c) => c.id === previewId) ??
    chosen[0] ?? {
      id: "sample",
      code: "STD0001",
      fullName: "Student Full Name",
      className: klass || "Grade 12",
      section: section || null,
      academicYear: year || "2026-2027",
    };
  const issue = { date: issueDate, grade };
  const accent = accentOf(s);
  const ctx = useMemo(
    () => certificateContext(s, previewStudent, issue),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [s, previewStudent.id, previewStudent.fullName, issueDate, grade],
  );
  const layout = useMemo(() => ({ ...s.layout, accent }), [s.layout, accent]);

  const set = <K extends keyof CertificateSettings>(k: K, v: CertificateSettings[K]) =>
    setS((prev) => ({ ...prev, [k]: v }));

  const onLayoutChange = useCallback(
    (updater: (prev: CardDesign) => CardDesign) => setS((prev) => ({ ...prev, layout: updater(prev.layout) })),
    [],
  );

  async function save(reset = false) {
    setSaving(true);
    try {
      const next = reset ? defaultSettings(s.design) : s;
      await savePrintDesign(KEY, {
        template: next.design,
        paper: "A4",
        landscape: true,
        bodyText: next.body,
        fields: { accent: next.accent, title: next.title, subtitle: next.subtitle, numberPrefix: next.numberPrefix },
        layout: JSON.stringify({ ...next.layout, accent: accentOf(next) }),
      });
      if (reset) setS(next);
      toast(reset ? "Certificate reset to the default." : "Certificate saved as the school's design.", "success");
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Could not save the design.", "error");
    } finally {
      setSaving(false);
    }
  }

  function print() {
    if (chosen.length === 0) return toast("Choose at least one student.", "error");
    if (!printCertificates({ ...s, layout }, chosen, issue)) toast("Allow pop-ups to print.", "error");
    else toast(`${chosen.length} certificate(s) sent to print.`, "success");
  }

  if (!mounted) return null;

  return (
    <div className="relative space-y-6">
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-x-4 -top-4 h-72 rounded-b-[3rem] bg-gradient-to-br from-amber-200/50 via-orange-100/30 to-transparent dark:from-amber-900/25 dark:via-orange-900/10 sm:-inset-x-6"
      />

      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/30">
            <Award className="h-7 w-7" />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Certificates</h1>
            <p className="text-sm text-muted-foreground">
              Design the certificate by dragging its items, then print it for one student or a whole class.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {isAdmin && (
            <Button variant="outline" className="bg-card" disabled={saving} onClick={() => void save(false)}>
              <Save className="me-2 h-4 w-4" /> Save design
            </Button>
          )}
          <Button onClick={print} disabled={chosen.length === 0} className="shadow-sm shadow-primary/30">
            <Printer className="me-2 h-4 w-4" /> Print {chosen.length > 0 ? `${chosen.length} ` : ""}certificate{chosen.length === 1 ? "" : "s"} / PDF
          </Button>
        </div>
      </div>

      {/* ── Frame picker ── */}
      <div className="relative grid grid-cols-2 gap-3 lg:grid-cols-4">
        {CERTIFICATE_DESIGNS.map((d) => {
          const on = s.design === d.id;
          return (
            <button
              key={d.id}
              type="button"
              onClick={() => set("design", d.id)}
              className={cn(
                "group overflow-hidden rounded-2xl border bg-card text-start shadow-sm transition hover:-translate-y-0.5 hover:shadow-md",
                on && "ring-2 ring-primary",
              )}
            >
              <div className="relative h-24 overflow-hidden">
                <div
                  className="absolute left-0 top-0 origin-top-left"
                  style={{ width: `${CERT_W}mm`, height: `${CERT_H}mm`, transform: "scale(0.24)" }}
                  dangerouslySetInnerHTML={{ __html: frameHtml(d.id, s.design === d.id ? accent : d.accent) }}
                />
              </div>
              <div className="p-3">
                <p className="flex items-center gap-1.5 font-semibold">
                  {d.name}
                  {on && <CheckSquare className="h-4 w-4 text-primary" />}
                </p>
                <p className="text-xs text-muted-foreground">{d.hint}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* ── The designer ── */}
      <div className="relative rounded-2xl border bg-card p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <LayoutTemplate className="h-4 w-4 text-primary" /> Design — drag, resize and restyle every item
          </h2>
          <span className="text-xs text-muted-foreground">
            Showing: <strong>{previewStudent.fullName}</strong>
          </span>
        </div>
        <CardDesigner
          design={layout}
          ctx={ctx}
          onChange={onLayoutChange}
          onReset={() => set("layout", defaultLayout(s.design, accent))}
          backgroundHtml={frameHtml(s.design, accent)}
          fields={CERTIFICATE_FIELDS}
          presetScale={4}
        />
      </div>

      <div className="relative grid gap-6 lg:grid-cols-2">
        {/* ── Students ── */}
        <Card title="Who gets a certificate" icon={Users}>
          <div className="mb-3 grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
            {(["class", "single"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={cn(
                  "flex items-center justify-center gap-1.5 rounded-md py-1.5 text-sm font-medium transition",
                  mode === m ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {m === "class" ? <Users className="h-4 w-4" /> : <User className="h-4 w-4" />}
                {m === "class" ? "Whole class" : "One student"}
              </button>
            ))}
          </div>

          {mode === "class" ? (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <Select value={klass} onChange={(e) => { setKlass(e.target.value); setSection(""); }}>
                  <option value="">Choose class</option>
                  {classes.map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
                <Select value={section} onChange={(e) => setSection(e.target.value)} disabled={sections.length === 0}>
                  <option value="">All sections</option>
                  {sections.map((x) => <option key={x} value={x}>{x}</option>)}
                </Select>
              </div>
              {klass && (
                <div className="rounded-lg border">
                  <div className="flex items-center justify-between border-b px-3 py-2 text-xs">
                    <span className="font-medium">{picked.size} of {classStudents.length} selected</span>
                    <button
                      type="button"
                      className="font-medium text-primary hover:underline"
                      onClick={() => setPicked(picked.size === classStudents.length ? new Set() : new Set(classStudents.map((x) => x.id)))}
                    >
                      {picked.size === classStudents.length ? "Clear all" : "Select all"}
                    </button>
                  </div>
                  <ul className="max-h-64 overflow-y-auto scrollbar-slim">
                    {classStudents.length === 0 && (
                      <li className="px-3 py-6 text-center text-xs text-muted-foreground">No students in this class.</li>
                    )}
                    {classStudents.map((st) => {
                      const on = picked.has(st.id);
                      return (
                        <li key={st.id}>
                          <button
                            type="button"
                            onClick={() => {
                              const n = new Set(picked);
                              if (on) n.delete(st.id);
                              else n.add(st.id);
                              setPicked(n);
                              setPreviewId(st.id);
                            }}
                            className={cn("flex w-full items-center gap-2 px-3 py-1.5 text-start text-sm hover:bg-muted", previewStudent.id === st.id && "bg-primary/5")}
                          >
                            {on ? <CheckSquare className="h-4 w-4 shrink-0 text-primary" /> : <Square className="h-4 w-4 shrink-0 text-muted-foreground" />}
                            <span className="min-w-0 flex-1 truncate">{st.fullName}</span>
                            <span className="font-mono text-[11px] text-muted-foreground">{st.code}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="relative">
                <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input className="ps-9" placeholder="Search by name or ID…" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              {searchHits.length > 0 && (
                <ul className="max-h-56 overflow-y-auto rounded-lg border scrollbar-slim">
                  {searchHits.map((st) => (
                    <li key={st.id}>
                      <button
                        type="button"
                        onClick={() => { setSingle(st.id); setPreviewId(st.id); }}
                        className={cn("flex w-full items-center gap-2 px-3 py-1.5 text-start text-sm hover:bg-muted", single === st.id && "bg-primary/5")}
                      >
                        <GraduationCap className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1 truncate">{st.fullName}</span>
                        <span className="text-[11px] text-muted-foreground">{st.className}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {single && (
                <p className="rounded-lg bg-primary/5 px-3 py-2 text-sm">
                  Selected: <strong>{all.find((x) => x.id === single)?.fullName}</strong>
                </p>
              )}
            </div>
          )}

          <div className="mt-3 grid grid-cols-2 gap-2">
            <div>
              <Label>Date of issue</Label>
              <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
            </div>
            <div>
              <Label>Grade / result (optional)</Label>
              <Input value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="e.g. Excellent" />
            </div>
          </div>
        </Card>

        {/* ── Wording ── */}
        <Card title="Words on the certificate" icon={Palette}>
          <div className="space-y-2.5">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Title</Label>
                <Input value={s.title} onChange={(e) => set("title", e.target.value)} />
              </div>
              <div>
                <Label>Line above the name</Label>
                <Input value={s.subtitle} onChange={(e) => set("subtitle", e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Certificate text (under the name)</Label>
              <Textarea rows={3} value={s.body} onChange={(e) => set("body", e.target.value)} />
              <p className="mt-1 text-[11px] text-muted-foreground">
                {CERTIFICATE_PLACEHOLDERS.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    title={p.meaning}
                    onClick={() => set("body", `${s.body}${s.body.endsWith(" ") ? "" : " "}${p.key}`)}
                    className="me-1 mt-0.5 inline-block rounded bg-muted px-1 font-mono text-[10.5px] text-primary hover:bg-primary/10"
                  >
                    {p.key}
                  </button>
                ))}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Certificate No. prefix</Label>
                <Input value={s.numberPrefix} onChange={(e) => set("numberPrefix", e.target.value.toUpperCase())} />
              </div>
              <div>
                <Label>Colour</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={accent}
                    onChange={(e) => set("accent", e.target.value)}
                    className="h-10 w-12 cursor-pointer rounded border bg-transparent"
                  />
                  {s.accent && (
                    <button type="button" className="text-xs text-primary hover:underline" onClick={() => set("accent", "")}>
                      Frame colour
                    </button>
                  )}
                </div>
              </div>
            </div>
            <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              Signature names, the seal, the student photo and any other text or line are items on the design above —
              click one to edit it, or add more from its toolbar (Text, Field, Signature, Photo, Image, Line…).
            </p>
            {isAdmin && (
              <div className="flex flex-wrap gap-2 border-t pt-3">
                <Button variant="outline" className="h-8 text-xs" disabled={saving} onClick={() => void save(false)}>
                  <Save className="me-1.5 h-3.5 w-3.5" /> Save as school design
                </Button>
                <Button variant="ghost" className="h-8 text-xs" disabled={saving} onClick={() => void save(true)}>
                  <RotateCcw className="me-1.5 h-3.5 w-3.5" /> Reset everything
                </Button>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function Card({ title, icon: Icon, children }: { title: string; icon: typeof Users; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <Icon className="h-4 w-4 text-primary" /> {title}
      </h2>
      {children}
    </div>
  );
}
