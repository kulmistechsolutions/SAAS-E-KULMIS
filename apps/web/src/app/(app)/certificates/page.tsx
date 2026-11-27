"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Award,
  CheckSquare,
  GraduationCap,
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
import {
  CERTIFICATE_DESIGNS,
  CERTIFICATE_PLACEHOLDERS,
  DEFAULT_CERTIFICATE,
  certificatesHtml,
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

/** The school's saved certificate, over the system defaults. */
function savedSettings(): CertificateSettings {
  const choice = designFor(KEY);
  const f = choice.fields ?? {};
  const pick = <K extends keyof CertificateSettings>(k: K): CertificateSettings[K] =>
    (f[k] !== undefined ? f[k] : DEFAULT_CERTIFICATE[k]) as CertificateSettings[K];
  const design = CERTIFICATE_DESIGNS.some((d) => d.id === choice.template)
    ? (choice.template as CertificateDesign)
    : DEFAULT_CERTIFICATE.design;
  return {
    design,
    accent: pick("accent"),
    title: pick("title"),
    subtitle: pick("subtitle"),
    body: choice.bodyText ?? DEFAULT_CERTIFICATE.body,
    signatory1Name: pick("signatory1Name"),
    signatory1Title: pick("signatory1Title"),
    signatory2Name: pick("signatory2Name"),
    signatory2Title: pick("signatory2Title"),
    numberPrefix: pick("numberPrefix"),
    showBismillah: pick("showBismillah"),
    showPhoto: pick("showPhoto"),
    showSeal: pick("showSeal"),
  };
}

/**
 * Certificates — a graduation certificate for one student or a whole class,
 * in one of four designs the school dresses with its own words, colour and
 * signatories. Previewed live; printed one sheet per student (A4 landscape),
 * or saved as PDF from the print dialog.
 */
export default function CertificatesPage() {
  const mounted = useHydrated();
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMINISTRATOR" || user?.role === "SUPER_ADMINISTRATOR";
  const studentsState = useStudentsState();
  const academics = useAcademicsState();
  const printSettings = usePrintSettings();

  const [s, setS] = useState<CertificateSettings>(DEFAULT_CERTIFICATE);
  const [loadedSaved, setLoadedSaved] = useState(false);
  const [mode, setMode] = useState<"class" | "single">("class");
  const [year, setYear] = useState("");
  const [klass, setKlass] = useState("");
  const [section, setSection] = useState("");
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [single, setSingle] = useState<string>("");
  const [issueDate, setIssueDate] = useState(todayKey());
  const [grade, setGrade] = useState("");
  const [saving, setSaving] = useState(false);
  const [previewId, setPreviewId] = useState<string>("");

  useEffect(() => {
    if (!mounted) return;
    void loadPrintSettings();
    setYear(activeAcademicYear());
  }, [mounted]);

  // Once the school's settings arrive, start from them (only once, so typing
  // is never overwritten by a late load).
  useEffect(() => {
    if (!mounted || loadedSaved) return;
    if (printSettings[KEY]) {
      setS(savedSettings());
      setLoadedSaved(true);
    }
  }, [mounted, printSettings, loadedSaved]);

  const classes = useMemo(() => (mounted && year ? classNamesForYear(year) : []), [mounted, year, academics.classes]);
  const sections = useMemo(
    () => (klass ? sectionNamesForClass(klass, year) : []),
    [klass, year, academics.sections],
  );

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

  // A new class means a fresh selection: everyone ticked.
  useEffect(() => {
    setPicked(new Set(classStudents.map((st) => st.id)));
  }, [klass, section, year, classStudents.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const searchHits = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q.length < 2) return [];
    return all
      .filter((st) => st.fullName.toLowerCase().includes(q) || st.code.toLowerCase().includes(q))
      .slice(0, 12);
  }, [all, search]);

  const chosen: CertificateStudent[] = useMemo(() => {
    if (mode === "single") return all.filter((st) => st.id === single);
    return classStudents.filter((st) => picked.has(st.id));
  }, [mode, all, single, classStudents, picked]);

  const previewStudent: CertificateStudent =
    chosen.find((c) => c.id === previewId) ??
    chosen[0] ?? {
      id: "sample",
      code: "STD0001",
      fullName: "Student Full Name",
      className: klass || "Grade 12",
      section: section || null,
      academicYear: year || "2026-2027",
    };
  const issue = { date: issueDate, grade };
  const previewHtml = useMemo(
    () => (mounted ? certificatesHtml(s, [previewStudent], issue) : ""),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mounted, s, previewStudent.id, previewStudent.fullName, issueDate, grade],
  );

  const set = <K extends keyof CertificateSettings>(k: K, v: CertificateSettings[K]) =>
    setS((prev) => ({ ...prev, [k]: v }));

  async function save(reset = false) {
    setSaving(true);
    try {
      const next = reset ? DEFAULT_CERTIFICATE : s;
      await savePrintDesign(KEY, {
        template: next.design,
        paper: "A4",
        landscape: true,
        bodyText: next.body,
        fields: {
          accent: next.accent,
          title: next.title,
          subtitle: next.subtitle,
          signatory1Name: next.signatory1Name,
          signatory1Title: next.signatory1Title,
          signatory2Name: next.signatory2Name,
          signatory2Title: next.signatory2Title,
          numberPrefix: next.numberPrefix,
          showBismillah: next.showBismillah,
          showPhoto: next.showPhoto,
          showSeal: next.showSeal,
        },
      });
      if (reset) setS(DEFAULT_CERTIFICATE);
      toast(reset ? "Certificate reset to the default." : "Certificate design saved for the school.", "success");
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Could not save the design.", "error");
    } finally {
      setSaving(false);
    }
  }

  function print() {
    if (chosen.length === 0) return toast("Choose at least one student.", "error");
    if (!printCertificates(s, chosen, issue)) toast("Allow pop-ups to print.", "error");
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
              Graduation certificates for one student or a whole class — four designs, your school&apos;s words.
            </p>
          </div>
        </div>
        <Button onClick={print} disabled={chosen.length === 0} className="shadow-sm shadow-primary/30">
          <Printer className="me-2 h-4 w-4" /> Print {chosen.length > 0 ? `${chosen.length} ` : ""}certificate{chosen.length === 1 ? "" : "s"} / Save PDF
        </Button>
      </div>

      {/* ── Design picker ── */}
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
              <DesignSwatch id={d.id} accent={d.accent} />
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

      <div className="relative grid gap-6 xl:grid-cols-[380px_1fr]">
        {/* ── Left: who and what ── */}
        <div className="space-y-4">
          <Card title="Students" icon={Users}>
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
                        onClick={() =>
                          setPicked(picked.size === classStudents.length ? new Set() : new Set(classStudents.map((x) => x.id)))
                        }
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
                              className="flex w-full items-center gap-2 px-3 py-1.5 text-start text-sm hover:bg-muted"
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
                          onClick={() => {
                            setSingle(st.id);
                            setPreviewId(st.id);
                          }}
                          className={cn(
                            "flex w-full items-center gap-2 px-3 py-1.5 text-start text-sm hover:bg-muted",
                            single === st.id && "bg-primary/5",
                          )}
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

          <Card title="Wording & signatures" icon={Palette}>
            <div className="space-y-2.5">
              <div>
                <Label>Title</Label>
                <Input value={s.title} onChange={(e) => set("title", e.target.value)} />
              </div>
              <div>
                <Label>Line above the name</Label>
                <Input value={s.subtitle} onChange={(e) => set("subtitle", e.target.value)} />
              </div>
              <div>
                <Label>Text under the name</Label>
                <Textarea rows={4} value={s.body} onChange={(e) => set("body", e.target.value)} />
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
                  <Label>Signature 1 — name</Label>
                  <Input value={s.signatory1Name} onChange={(e) => set("signatory1Name", e.target.value)} />
                </div>
                <div>
                  <Label>Signature 1 — title</Label>
                  <Input value={s.signatory1Title} onChange={(e) => set("signatory1Title", e.target.value)} />
                </div>
                <div>
                  <Label>Signature 2 — name</Label>
                  <Input value={s.signatory2Name} onChange={(e) => set("signatory2Name", e.target.value)} />
                </div>
                <div>
                  <Label>Signature 2 — title</Label>
                  <Input value={s.signatory2Title} onChange={(e) => set("signatory2Title", e.target.value)} />
                </div>
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
                      value={/^#[0-9a-fA-F]{6}$/.test(s.accent) ? s.accent : CERTIFICATE_DESIGNS.find((d) => d.id === s.design)!.accent}
                      onChange={(e) => set("accent", e.target.value)}
                      className="h-10 w-12 cursor-pointer rounded border bg-transparent"
                    />
                    {s.accent && (
                      <button type="button" className="text-xs text-primary hover:underline" onClick={() => set("accent", "")}>
                        Design colour
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-1 text-sm">
                <Toggle label="Official seal" on={s.showSeal} set={(v) => set("showSeal", v)} />
                <Toggle label="Student photo" on={s.showPhoto} set={(v) => set("showPhoto", v)} />
                <Toggle label="Bismillah line" on={s.showBismillah} set={(v) => set("showBismillah", v)} />
              </div>
              {isAdmin && (
                <div className="flex flex-wrap gap-2 border-t pt-3">
                  <Button variant="outline" className="h-8 text-xs" disabled={saving} onClick={() => void save(false)}>
                    <Save className="me-1.5 h-3.5 w-3.5" /> Save as school design
                  </Button>
                  <Button variant="ghost" className="h-8 text-xs" disabled={saving} onClick={() => void save(true)}>
                    <RotateCcw className="me-1.5 h-3.5 w-3.5" /> Reset
                  </Button>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* ── Right: live preview ── */}
        <div className="rounded-2xl border bg-card p-3 shadow-sm">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-1">
            <p className="text-sm font-semibold">
              Preview{" "}
              <span className="font-normal text-muted-foreground">
                — {chosen.length > 0 ? previewStudent.fullName : "sample student"}
              </span>
            </p>
            {chosen.length > 1 && (
              <Select className="h-8 w-56 text-xs" value={previewStudent.id} onChange={(e) => setPreviewId(e.target.value)}>
                {chosen.map((c) => <option key={c.id} value={c.id}>{c.fullName}</option>)}
              </Select>
            )}
          </div>
          <div className="relative w-full overflow-hidden rounded-lg border bg-muted" style={{ aspectRatio: "297 / 210" }}>
            <ScaledFrame html={previewHtml} />
          </div>
        </div>
      </div>
    </div>
  );
}

/** The A4-landscape sheet, scaled down to fit the preview box. */
function ScaledFrame({ html }: { html: string }) {
  const [box, setBox] = useState<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(0.5);
  useEffect(() => {
    if (!box) return;
    const fit = () => setScale(box.clientWidth / 1123); // 297mm at 96dpi
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(box);
    return () => ro.disconnect();
  }, [box]);
  return (
    <div ref={setBox} className="absolute inset-0">
      <iframe
        title="Certificate preview"
        srcDoc={html.replace("<body>", '<body style="background:#fff">').replace("@media screen { .cert { margin: 16px auto;", "@media screen { .cert { margin: 0 auto;")}
        style={{ width: 1123, height: 794, transform: `scale(${scale})`, transformOrigin: "top left", border: 0 }}
      />
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

function Toggle({ label, on, set }: { label: string; on: boolean; set: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-1.5">
      <input type="checkbox" checked={on} onChange={(e) => set(e.target.checked)} />
      {label}
    </label>
  );
}

/** A small drawing of each design for the picker. */
function DesignSwatch({ id, accent }: { id: CertificateDesign; accent: string }) {
  const common = "relative flex h-24 items-center justify-center overflow-hidden";
  const lines = (
    <div className="relative flex flex-col items-center gap-1">
      <div className="h-1.5 w-16 rounded" style={{ background: id === "ROYAL" ? "#0f1d3d" : accent }} />
      <div className="h-2.5 w-24 rounded bg-slate-700/70" />
      <div className="h-1 w-20 rounded bg-slate-400/60" />
    </div>
  );
  if (id === "CLASSIC")
    return (
      <div className={cn(common, "bg-[#fdf8ec]")}>
        <div className="absolute inset-2 border-4 border-double" style={{ borderColor: accent }} />
        {lines}
      </div>
    );
  if (id === "MODERN")
    return (
      <div className={cn(common, "bg-white")}>
        <div className="absolute -left-8 -top-8 h-16 w-16 rotate-45" style={{ background: accent }} />
        <div className="absolute -bottom-8 -right-8 h-16 w-16 rotate-45" style={{ background: accent }} />
        {lines}
      </div>
    );
  if (id === "ROYAL")
    return (
      <div className={cn(common, "bg-[#0f1d3d]")}>
        <div className="absolute inset-2 border-2 bg-[#fffdf6]" style={{ borderColor: accent }} />
        {lines}
      </div>
    );
  return (
    <div className={cn(common, "bg-[#fbfaf5]")}>
      <div
        className="absolute inset-1.5"
        style={{
          border: "6px solid transparent",
          borderImage: `repeating-linear-gradient(45deg, ${accent} 0 4px, #d4af37 4px 6px, #fbfaf5 6px 8px) 8`,
        }}
      />
      {lines}
    </div>
  );
}
