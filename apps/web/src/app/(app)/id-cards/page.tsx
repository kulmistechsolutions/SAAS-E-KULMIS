"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import {
  BadgeCheck,
  CreditCard,
  FileCheck2,
  FileDown,
  History,
  Layers,
  Loader2,
  Pencil,
  Printer,
  ScanLine,
  Search,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/lib/i18n/provider";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import {
  activeAcademicYear,
  classByName,
  classNamesForYear,
  sectionsForClass,
  useAcademicsState,
} from "@/lib/academics/store";
import { useStudentsState } from "@/lib/students/store";
import { useExaminationsState } from "@/lib/examinations/store";
import type { Student } from "@/lib/students/types";
import {
  CARD_SIZES,
  CARD_TYPES,
  DEFAULT_LAYOUT,
  type CardContext,
  type CardType,
  type PrintLayoutSettings,
} from "@/lib/id-cards/types";
import { CARD_CSS } from "@/lib/id-cards/templates";
import { presetDesign, presetById, presetsForType } from "@/lib/id-cards/presets";
import type { CardDesign } from "@/lib/id-cards/elements";
import {
  apiDeleteCardDesign,
  apiListCardDesigns,
  apiMarkBatchPrinted,
  apiClearanceFor,
  apiRecordCardIssues,
  apiSaveCardDesign,
  toDesignMap,
} from "@/lib/id-cards/api";
import { CardDesigner } from "@/components/id-cards/card-designer";
import { PAGE_A4, paginate, resolveGrid } from "@/lib/id-cards/layout";
import {
  buildCardContexts,
  studentsMissingPhotos,
} from "@/lib/id-cards/data";
import {
  downloadCardsPdf,
  openFullPreview,
  pageCount,
  printCards,
  renderCard,
} from "@/lib/id-cards/print";

/** Millimetres → CSS pixels at the 96dpi the browser lays out with. */
const MM = 96 / 25.4;

/**
 * Card edits fire many times a second while an element is being dragged, so
 * the save is debounced per design and only the final state is sent. The
 * canvas never waits on the network.
 */
const saveTimers = new Map<string, ReturnType<typeof setTimeout>>();

function queueDesignSave(
  key: string,
  styleId: string,
  orientation: string,
  design: CardDesign,
) {
  const pending = saveTimers.get(key);
  if (pending) clearTimeout(pending);
  saveTimers.set(
    key,
    setTimeout(() => {
      saveTimers.delete(key);
      void apiSaveCardDesign(key, styleId, orientation, design).catch(() =>
        toast("Could not save the design to the school", "error"),
      );
    }, 700),
  );
}


const CARD_TYPE_ICONS: Record<CardType, typeof CreditCard> = {
  STUDENT_ID: CreditCard,
  EXAM_CARD: FileCheck2,
  CLEARANCE_CARD: BadgeCheck,
  CUSTOM_CARD: Layers,
};

const DEFAULT_TITLES: Record<CardType, string> = {
  STUDENT_ID: "Student ID Card",
  EXAM_CARD: "Examination Card",
  CLEARANCE_CARD: "Clearance Card",
  CUSTOM_CARD: "Access Card",
};

type SelectionMode = "INDIVIDUAL" | "CLASS" | "MULTIPLE";

export default function IdCardsPage() {
  const t = useT();
  const academics = useAcademicsState();
  const studentsState = useStudentsState();
  const examinations = useExaminationsState();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const year = activeAcademicYear();

  // ── Card type + design ──
  const [cardType, setCardType] = useState<CardType>("STUDENT_ID");
  const templates = useMemo(() => presetsForType(cardType), [cardType]);
  const [templateId, setTemplateId] = useState("modern-blue");
  const template = presetById(templateId) ?? templates[0];
  const [designerOpen, setDesignerOpen] = useState(false);

  useEffect(() => {
    if (!templates.some((tpl) => tpl.id === templateId)) {
      setTemplateId(templates[0]?.id ?? "");
    }
  }, [templates, templateId]);

  // ── Labels (admin may relabel, never the ID value itself) ──
  const [cardTitle, setCardTitle] = useState(DEFAULT_TITLES.STUDENT_ID);
  const [idLabel, setIdLabel] = useState("Student ID");
  const [footerText, setFooterText] = useState("");
  useEffect(() => {
    setCardTitle(DEFAULT_TITLES[cardType]);
    setIdLabel(cardType === "EXAM_CARD" ? "Exam ID" : "Student ID");
  }, [cardType]);

  const [accent, setAccent] = useState("");
  const effectiveAccent = accent || template?.accent || "#1d4ed8";

  // ── Type-specific meta ──
  const [examName, setExamName] = useState("");
  const [examDate, setExamDate] = useState("");
  const [examSession, setExamSession] = useState("");
  const [examOffice, setExamOffice] = useState("Exam Office");
  const [examId, setExamId] = useState("");
  const [clearanceStatus, setClearanceStatus] = useState("Cleared");
  const [clearanceByStudent, setClearanceByStudent] = useState<
    Map<string, { status: string; detail: string }>
  >(new Map());
  const [clearanceLoading, setClearanceLoading] = useState(false);
  const [customLine1, setCustomLine1] = useState("");
  const [customLine2, setCustomLine2] = useState("");

  // ── Student selection ──
  const [mode, setMode] = useState<SelectionMode>("CLASS");
  const [klass, setKlass] = useState("");
  const [section, setSection] = useState("");
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<string[]>([]);

  const classOptions = useMemo(() => classNamesForYear(year), [year, academics.classes]);
  const sectionOptions = useMemo(() => {
    const cls = classByName(klass, year);
    return cls ? sectionsForClass(cls.id) : [];
  }, [klass, year, academics.sections]);

  // Exams the school has actually scheduled, so an exam card does not have to
  // be typed out by hand for every batch (PRD §22).
  const examOptions = useMemo(
    () =>
      examinations.exams
        .filter((e) => !year || e.academicYear === year)
        .slice()
        .sort((a, b) => b.startDate.localeCompare(a.startDate)),
    [examinations.exams, year],
  );

  const allStudents = studentsState.students;

  const classFiltered = useMemo(() => {
    return allStudents.filter(
      (s) =>
        s.status === "ACTIVE" &&
        (!klass || s.className === klass) &&
        (!section || s.section === section),
    );
  }, [allStudents, klass, section]);

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [] as Student[];
    return allStudents
      .filter(
        (s) =>
          s.status === "ACTIVE" &&
          (s.fullName.toLowerCase().includes(q) || s.code.toLowerCase().includes(q)),
      )
      .slice(0, 25);
  }, [allStudents, search]);

  const selected: Student[] = useMemo(() => {
    if (mode === "CLASS") return classFiltered;
    const byId = new Map(allStudents.map((s) => [s.id, s]));
    const rows = picked.map((id) => byId.get(id)).filter((s): s is Student => !!s);
    return mode === "INDIVIDUAL" ? rows.slice(0, 1) : rows;
  }, [mode, classFiltered, picked, allStudents]);

  const guardians = useMemo(() => {
    const byParent = new Map(studentsState.parents.map((p) => [p.id, p]));
    const out = new Map<string, { name: string; phone: string }>();
    for (const s of allStudents) {
      const p = byParent.get(s.parentId);
      if (p) out.set(s.id, { name: p.name, phone: p.phone });
    }
    return out;
  }, [allStudents, studentsState.parents]);

  // Real clearance for the selected students, so the card states what the fee
  // and library modules actually say rather than what someone picked from a
  // dropdown (PRD §23).
  useEffect(() => {
    if (!mounted || cardType !== "CLEARANCE_CARD" || selected.length === 0) {
      setClearanceByStudent(new Map());
      return;
    }
    let cancelled = false;
    setClearanceLoading(true);
    void apiClearanceFor(selected.map((s) => s.id))
      .then((rows) => {
        if (cancelled) return;
        setClearanceByStudent(
          new Map(rows.map((r) => [r.studentId, { status: r.status, detail: r.detail }])),
        );
      })
      .catch(() => {
        if (!cancelled) setClearanceByStudent(new Map());
      })
      .finally(() => {
        if (!cancelled) setClearanceLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mounted, cardType, selected]);

  // ── Layout ──
  // Orientation is the admin's choice and is never overridden by the template:
  // every template renders in both, so picking a design must not silently
  // change the shape of the card.
  const [layout, setLayout] = useState<PrintLayoutSettings>(DEFAULT_LAYOUT);

  const grid = useMemo(() => resolveGrid(layout), [layout]);

  // ── The editable design ──
  // Keyed by style + orientation + physical size, because a layout laid out for
  // 54×86mm means nothing on an 86×54mm card. Edits are kept per key so
  // switching orientation and back does not throw the work away.
  const designKey = `${templateId}|${layout.orientation}|${round(grid.cardWidth)}x${round(grid.cardHeight)}`;
  const [designs, setDesigns] = useState<Record<string, CardDesign>>({});

  useEffect(() => {
    void apiListCardDesigns()
      .then((rows) => setDesigns(toDesignMap(rows)))
      .catch(() => {
        /* the presets still work, so a failed load must not block printing */
      });
  }, []);

  const design: CardDesign = useMemo(
    () =>
      designs[designKey] ??
      presetDesign(templateId, layout.orientation, grid.cardWidth, grid.cardHeight),
    [designs, designKey, templateId, layout.orientation, grid.cardWidth, grid.cardHeight],
  );

  // Takes an updater and applies it to whatever is current, so two edits in the
  // same tick compose instead of the second discarding the first.
  const saveDesign = useCallback(
    (updater: (prev: CardDesign) => CardDesign) => {
      setDesigns((prev) => {
        const base =
          prev[designKey] ??
          presetDesign(templateId, layout.orientation, grid.cardWidth, grid.cardHeight);
        const next = updater(base);
        // Persist in the background: a drag fires many updates a second, and
        // the canvas must never wait on the network to stay responsive.
        queueDesignSave(designKey, templateId, layout.orientation, next);
        return { ...prev, [designKey]: next };
      });
    },
    [designKey, templateId, layout.orientation, grid.cardWidth, grid.cardHeight],
  );

  const resetDesign = useCallback(() => {
    setDesigns((prev) => {
      const merged = { ...prev };
      delete merged[designKey];
      return merged;
    });
    void apiDeleteCardDesign(designKey).catch(() =>
      toast("Could not reset the saved design", "error"),
    );
  }, [designKey]);

  const isCustomised = !!designs[designKey];

  const setLayoutField = <K extends keyof PrintLayoutSettings>(
    key: K,
    value: PrintLayoutSettings[K],
  ) => setLayout((l) => ({ ...l, [key]: value }));

  // ── Generated cards ──
  const [contexts, setContexts] = useState<CardContext[]>([]);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [previewCtx, setPreviewCtx] = useState<CardContext | null>(null);
  const [page, setPage] = useState(0);

  const buildOptions = useCallback(
    () => ({
      template: template!,
      labels: { cardTitle, idLabel, footerText },
      accent: effectiveAccent,
      includePhotos: true,
      includeQr: true,
      exam: { examName, examDate, examSession, examOffice },
      clearance: { status: clearanceStatus },
      custom: { line1: customLine1, line2: customLine2 },
      guardians,
      clearanceByStudent,
    }),
    [
      template, cardTitle, idLabel, footerText, effectiveAccent, examName, examDate,
      examSession, examOffice, clearanceStatus, customLine1, customLine2, guardians,
      clearanceByStudent,
    ],
  );

  // A single-card preview, so the design can be judged before committing to a
  // full batch (which fetches a photo per student).
  useEffect(() => {
    if (!mounted || !template) return;
    const sample = selected[0];
    if (!sample) {
      setPreviewCtx(null);
      return;
    }
    let cancelled = false;
    void buildCardContexts([sample], buildOptions()).then((ctxs) => {
      if (!cancelled) setPreviewCtx(ctxs[0] ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [mounted, template, selected, buildOptions]);

  // Any change to what would be printed invalidates an earlier batch, so the
  // Print button can never send a stale set of cards to the printer.
  useEffect(() => {
    setContexts([]);
    setBatchId(null);
    setPage(0);
  }, [selected, template, cardTitle, idLabel, footerText, effectiveAccent]);

  async function handleGenerate() {
    if (!template) return;
    if (selected.length === 0) {
      toast(t("idCards.selectStudentsFirst"), "error");
      return;
    }
    setGenerating(true);
    try {
      const ctxs = await buildCardContexts(selected, buildOptions());
      setContexts(ctxs);
      setPage(0);

      // Record what was issued. A failure here must not lose the cards the
      // admin just waited for, so it only costs them the history entry.
      try {
        const res = await apiRecordCardIssues({
          cardType,
          styleId: templateId,
          orientation: layout.orientation,
          academicYear: year || undefined,
          students: selected.map((s) => ({
            studentId: s.id,
            studentCode: s.code,
            studentName: s.fullName,
            className: s.className || undefined,
            section: s.section || undefined,
          })),
        });
        setBatchId(res.batchId);
      } catch {
        setBatchId(null);
        toast("Cards generated, but the history entry could not be saved", "info");
      }
      const missing = studentsMissingPhotos(selected).length;
      toast(
        missing > 0
          ? `${ctxs.length} cards generated · ${missing} without a photo`
          : `${ctxs.length} cards generated`,
        missing > 0 ? "info" : "success",
      );
    } catch {
      toast("Could not generate cards", "error");
    } finally {
      setGenerating(false);
    }
  }

  const printReq = {
    contexts,
    design,
    grid,
    border: layout.showCardBorder,
    cutLines: layout.showCutLines,
  };

  /** Flag the last generated batch as sent to a printer. */
  function markPrinted() {
    if (!batchId) return;
    void apiMarkBatchPrinted(batchId).catch(() => {
      /* the cards still printed — only the status flag is lost */
    });
  }

  function guard(): boolean {
    if (contexts.length === 0) {
      toast(t("idCards.generateFirst"), "error");
      return false;
    }
    return true;
  }

  const pages = useMemo(() => paginate(contexts, grid.perPage), [contexts, grid.perPage]);
  const totalPages = pageCount(contexts.length, grid.perPage);
  const missingPhotoCount = studentsMissingPhotos(selected).length;

  if (!mounted) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        <Loader2 className="me-2 h-5 w-5 animate-spin" /> {t("idCards.loading")}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* The card markup is raw HTML from the template engine, so the same
          stylesheet the print window uses is injected here for a true preview. */}
      <style dangerouslySetInnerHTML={{ __html: CARD_CSS + PREVIEW_EXTRA_CSS }} />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t("idCards.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("idCards.subtitle")}</p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/id-cards/history">
            <History className="me-2 h-4 w-4" /> {t("idCards.history")}
          </Link>
        </Button>
      </div>

      {designerOpen && (
        <Section
          title={t("idCards.designer")}
          right={
            <span className="text-xs text-muted-foreground">
              {round(design.width)} × {round(design.height)} mm
            </span>
          }
        >
          <CardDesigner
            design={design}
            ctx={previewCtx ?? PLACEHOLDER_CTX}
            onChange={saveDesign}
            onReset={resetDesign}
          />
        </Section>
      )}

      <div className="grid gap-5 xl:grid-cols-12">
        {/* ── Configuration ── */}
        <div className="space-y-5 xl:col-span-7">
          <Section title={`1. ${t("idCards.selectCardType")}`}>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {CARD_TYPES.map((ct) => {
                const Icon = CARD_TYPE_ICONS[ct.id];
                const active = ct.id === cardType;
                return (
                  <button
                    key={ct.id}
                    type="button"
                    onClick={() => setCardType(ct.id)}
                    title={ct.description}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center text-xs font-medium transition",
                      active
                        ? "border-primary bg-primary/10 text-primary"
                        : "hover:border-primary/40 hover:bg-secondary/40",
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    {ct.label}
                  </button>
                );
              })}
            </div>
          </Section>

          <Section
            title={`2. ${t("idCards.selectTemplate")}`}
            right={
              <div className="flex rounded-lg border p-0.5">
                {(
                  [
                    ["PORTRAIT", t("idCards.portrait")],
                    ["LANDSCAPE", t("idCards.landscape")],
                  ] as [PrintLayoutSettings["orientation"], string][]
                ).map(([o, label]) => (
                  <button
                    key={o}
                    type="button"
                    onClick={() => setLayoutField("orientation", o)}
                    className={cn(
                      "rounded-md px-2.5 py-1 text-xs font-medium transition",
                      layout.orientation === o
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            }
          >
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {templates.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => setTemplateId(tpl.id)}
                  className={cn(
                    "rounded-xl border p-2 text-start transition",
                    tpl.id === templateId
                      ? "border-primary ring-2 ring-primary/30"
                      : "hover:border-primary/40",
                  )}
                >
                  <MiniCard
                    ctx={previewCtx}
                    styleId={tpl.id}
                    accent={accent}
                    grid={grid}
                    orientation={layout.orientation}
                    saved={
                      designs[
                        `${tpl.id}|${layout.orientation}|${round(grid.cardWidth)}x${round(grid.cardHeight)}`
                      ]
                    }
                  />
                  <p className="mt-1.5 truncate text-xs font-medium">{tpl.name}</p>
                </button>
              ))}
            </div>
          </Section>

          <Section title={`3. ${t("idCards.selectStudents")}`}>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["INDIVIDUAL", t("idCards.individualStudent")],
                  ["CLASS", t("idCards.byClassSection")],
                  ["MULTIPLE", t("idCards.multipleStudents")],
                ] as [SelectionMode, string][]
              ).map(([m, label]) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-xs font-medium transition",
                    mode === m ? "border-primary bg-primary/10 text-primary" : "hover:bg-secondary/50",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {mode === "CLASS" ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>{t("idCards.class")}</Label>
                  <Select value={klass} onChange={(e) => { setKlass(e.target.value); setSection(""); }}>
                    <option value="">{t("idCards.allClasses")}</option>
                    {classOptions.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label>{t("idCards.section")}</Label>
                  <Select
                    value={section}
                    onChange={(e) => setSection(e.target.value)}
                    disabled={!klass || sectionOptions.length === 0}
                  >
                    <option value="">{t("idCards.allSections")}</option>
                    {sectionOptions.map((s) => (
                      <option key={s.id} value={s.name}>{s.name}</option>
                    ))}
                  </Select>
                </div>
              </div>
            ) : (
              <div className="mt-3 space-y-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={t("idCards.searchStudent")}
                    className="ps-9"
                  />
                </div>
                {searchResults.length > 0 && (
                  <div className="max-h-44 overflow-auto rounded-lg border scrollbar-slim">
                    {searchResults.map((s) => {
                      const on = picked.includes(s.id);
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() =>
                            setPicked((p) =>
                              mode === "INDIVIDUAL"
                                ? [s.id]
                                : on
                                  ? p.filter((x) => x !== s.id)
                                  : [...p, s.id],
                            )
                          }
                          className={cn(
                            "flex w-full items-center justify-between gap-2 border-b px-3 py-2 text-start text-xs last:border-b-0",
                            on ? "bg-primary/10 text-primary" : "hover:bg-secondary/50",
                          )}
                        >
                          <span className="truncate">{s.fullName}</span>
                          <span className="font-mono text-[11px] opacity-70">{s.code}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
                {picked.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setPicked([])}
                    className="text-xs text-muted-foreground underline"
                  >
                    {t("idCards.clearSelection")}
                  </button>
                )}
              </div>
            )}

            <div className="mt-3 flex items-center justify-between rounded-lg bg-secondary/40 px-3 py-2 text-xs">
              <span className="text-muted-foreground">{t("idCards.totalStudents")}</span>
              <span className="font-semibold">{selected.length}</span>
            </div>
            {missingPhotoCount > 0 && (
              <p className="mt-2 text-xs text-amber-600 dark:text-amber-500">
                {missingPhotoCount} {t("idCards.missingPhotos")}
              </p>
            )}
          </Section>

          {cardType === "EXAM_CARD" && (
            <Section title={t("idCards.examDetails")}>
              <div className="mb-3">
                <Label>{t("idCards.pickExam")}</Label>
                <Select
                  value={examId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setExamId(id);
                    const ex = examOptions.find((x) => x.id === id);
                    if (!ex) return;
                    // Pull the details straight from the Examinations module
                    // rather than making the office retype them.
                    setExamName(ex.name);
                    setExamDate(ex.startDate?.slice(0, 10) ?? "");
                    setExamSession(ex.term || "");
                    // Scope the batch to the class the exam is actually for.
                    if (ex.className) {
                      setMode("CLASS");
                      setKlass(ex.className);
                      setSection(ex.section || "");
                    }
                  }}
                >
                  <option value="">{t("idCards.enterManually")}</option>
                  {examOptions.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      {ex.name} — {ex.className}
                      {ex.section ? ` ${ex.section}` : ""} ({ex.startDate?.slice(0, 10)})
                    </option>
                  ))}
                </Select>
                {examOptions.length === 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("idCards.noExams")}
                  </p>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={t("idCards.examName")} value={examName} onChange={setExamName} />
                <Field label={t("idCards.examDate")} value={examDate} onChange={setExamDate} type="date" />
                <Field label={t("idCards.examSession")} value={examSession} onChange={setExamSession} />
                <Field label={t("idCards.examOffice")} value={examOffice} onChange={setExamOffice} />
              </div>
            </Section>
          )}

          {cardType === "CLEARANCE_CARD" && (
            <Section title={t("idCards.clearanceStatus")}>
              {selected.length > 0 && (
                <div className="mb-3 rounded-lg bg-secondary/40 p-3 text-xs">
                  {clearanceLoading ? (
                    <span className="text-muted-foreground">
                      <Loader2 className="me-2 inline h-3.5 w-3.5 animate-spin" />
                      {t("idCards.checkingClearance")}
                    </span>
                  ) : clearanceByStudent.size > 0 ? (
                    <>
                      <p className="font-medium">{t("idCards.checkedAgainst")}</p>
                      <p className="mt-1 text-muted-foreground">
                        {[...clearanceByStudent.values()].filter((c) => c.status === "Cleared").length}{" "}
                        {t("idCards.cleared").toLowerCase()} ·{" "}
                        {[...clearanceByStudent.values()].filter((c) => c.status !== "Cleared").length}{" "}
                        {t("idCards.pending").toLowerCase()}
                      </p>
                    </>
                  ) : (
                    <span className="text-muted-foreground">{t("idCards.clearanceFallback")}</span>
                  )}
                </div>
              )}
              <Label>{t("idCards.manualFallback")}</Label>
              <Select value={clearanceStatus} onChange={(e) => setClearanceStatus(e.target.value)}>
                <option value="Cleared">{t("idCards.cleared")}</option>
                <option value="Pending">{t("idCards.pending")}</option>
                <option value="Restricted">{t("idCards.restricted")}</option>
              </Select>
            </Section>
          )}

          {cardType === "CUSTOM_CARD" && (
            <Section title={t("idCards.customDetails")}>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={t("idCards.line1")} value={customLine1} onChange={setCustomLine1} />
                <Field label={t("idCards.line2")} value={customLine2} onChange={setCustomLine2} />
              </div>
            </Section>
          )}

          <Section title={t("idCards.labels")}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t("idCards.cardTitle")} value={cardTitle} onChange={setCardTitle} />
              <Field label={t("idCards.idLabel")} value={idLabel} onChange={setIdLabel} />
              <Field label={t("idCards.footerText")} value={footerText} onChange={setFooterText} />
              <div>
                <Label>{t("idCards.accentColor")}</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={effectiveAccent}
                    onChange={(e) => setAccent(e.target.value)}
                    className="h-10 w-14 cursor-pointer rounded-lg border bg-background p-1"
                  />
                  {accent && (
                    <button
                      type="button"
                      onClick={() => setAccent("")}
                      className="text-xs text-muted-foreground underline"
                    >
                      {t("idCards.reset")}
                    </button>
                  )}
                </div>
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{t("idCards.studentIdPermanent")}</p>
          </Section>

          <Section title={`4. ${t("idCards.cardLayoutSettings")}`}>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>{t("idCards.cardsPerA4")}</Label>
                <Select
                  value={String(layout.cardsPerPage)}
                  onChange={(e) => setLayoutField("cardsPerPage", Number(e.target.value))}
                >
                  {[4, 6, 8, 9, 10, 12].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>{t("idCards.orientation")}</Label>
                <Select
                  value={layout.orientation}
                  onChange={(e) =>
                    setLayoutField("orientation", e.target.value as PrintLayoutSettings["orientation"])
                  }
                >
                  <option value="PORTRAIT">{t("idCards.portrait")}</option>
                  <option value="LANDSCAPE">{t("idCards.landscape")}</option>
                </Select>
              </div>
              <div>
                <Label>{t("idCards.cardSize")}</Label>
                <Select value={layout.sizeId} onChange={(e) => setLayoutField("sizeId", e.target.value)}>
                  {CARD_SIZES.map((s) => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                  <option value="CUSTOM">{t("idCards.customSize")}</option>
                </Select>
              </div>
              {layout.sizeId === "CUSTOM" && (
                <div className="grid grid-cols-2 gap-2">
                  <NumField
                    label={t("idCards.width")}
                    value={layout.customWidth}
                    onChange={(v) => setLayoutField("customWidth", v)}
                  />
                  <NumField
                    label={t("idCards.height")}
                    value={layout.customHeight}
                    onChange={(v) => setLayoutField("customHeight", v)}
                  />
                </div>
              )}
              <NumField
                label={t("idCards.spacing")}
                value={layout.gap}
                onChange={(v) => setLayoutField("gap", v)}
              />
              <NumField
                label={t("idCards.pageMargin")}
                value={layout.margin}
                onChange={(v) => setLayoutField("margin", v)}
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-xs">
              <Check
                label={t("idCards.cutLines")}
                checked={layout.showCutLines}
                onChange={(v) => setLayoutField("showCutLines", v)}
              />
              <Check
                label={t("idCards.cardBorder")}
                checked={layout.showCardBorder}
                onChange={(v) => setLayoutField("showCardBorder", v)}
              />
            </div>
            {grid.clamped && (
              <p className="mt-2 text-xs text-amber-600 dark:text-amber-500">
                {t("idCards.cardsDoNotFit")} {grid.capacity}.
              </p>
            )}
          </Section>
        </div>

        {/* ── Previews: one column, so neither panel is squeezed ── */}
        <div className="space-y-5 xl:col-span-5 xl:sticky xl:top-4 xl:self-start">
          <Section
            title={t("idCards.templatePreview")}
            right={
              <div className="flex items-center gap-2">
                {isCustomised && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                    {t("idCards.edited")}
                  </span>
                )}
                <Button variant="outline" onClick={() => setDesignerOpen((v) => !v)}>
                  <Pencil className="me-2 h-4 w-4" />
                  {designerOpen ? t("idCards.closeDesigner") : t("idCards.editDesign")}
                </Button>
              </div>
            }
          >
            {previewCtx ? (
              <ScaledCard ctx={previewCtx} design={design} border={layout.showCardBorder} />
            ) : (
              <p className="py-10 text-center text-xs text-muted-foreground">
                {t("idCards.selectStudentsFirst")}
              </p>
            )}
          </Section>

          <Section
            title={`${t("idCards.printLayout")} (A4 — ${grid.perPage} ${t("idCards.cardsPerPage")})`}
            right={
              totalPages > 0 ? (
                <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  {t("idCards.page")} {page + 1} / {totalPages}
                </span>
              ) : null
            }
          >
            {pages.length > 0 && template ? (
              <>
                <SheetPreview
                  contexts={pages[Math.min(page, pages.length - 1)] ?? []}
                  design={design}
                  layout={layout}
                />
                {totalPages > 1 && (
                  <div className="mt-3 flex items-center justify-center gap-2">
                    <Button
                      variant="outline"
                      disabled={page === 0}
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                    >
                      ‹
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      {page + 1} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      disabled={page >= totalPages - 1}
                      onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                    >
                      ›
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="flex h-64 items-center justify-center rounded-lg border border-dashed text-center text-xs text-muted-foreground">
                {t("idCards.generateFirst")}
              </div>
            )}
          </Section>
        </div>
      </div>

      {/* ── Actions ── */}
      <div className="rounded-2xl border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => void handleGenerate()} disabled={generating || selected.length === 0}>
            {generating ? (
              <Loader2 className="me-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="me-2 h-4 w-4" />
            )}
            {t("idCards.generateCards")}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              if (guard()) openFullPreview(printReq);
            }}
          >
            <ScanLine className="me-2 h-4 w-4" /> {t("idCards.previewFullPage")}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              if (!guard()) return;
              downloadCardsPdf(printReq);
              markPrinted();
              toast(t("idCards.pdfHint"), "info");
            }}
          >
            <FileDown className="me-2 h-4 w-4" /> {t("idCards.downloadPdf")}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              if (guard()) {
                printCards(printReq);
                markPrinted();
              }
            }}
          >
            <Printer className="me-2 h-4 w-4" /> {t("idCards.printDirectly")}
          </Button>
        </div>

        <div className="mt-5 grid gap-2 rounded-xl bg-secondary/40 p-4 text-xs sm:grid-cols-2 lg:grid-cols-3">
          <Info label={t("idCards.eachCardSize")} value={`${round(grid.cardWidth)} × ${round(grid.cardHeight)} mm`} />
          <Info label={t("idCards.paperSize")} value={`A4 (${PAGE_A4.width} × ${PAGE_A4.height} mm)`} />
          <Info label={t("idCards.totalPages")} value={String(totalPages)} />
          <Info label={t("idCards.spacingBetween")} value={`${round(grid.gap)} mm`} />
          <Info label={t("idCards.cardsPerPageInfo")} value={`${grid.perPage} (${grid.cols} × ${grid.rows})`} />
          <Info label={t("idCards.totalCards")} value={String(contexts.length)} />
        </div>
      </div>
    </div>
  );
}

// ── Small presentational helpers ──────────────────────────────────────────

const PREVIEW_EXTRA_CSS = `
.idc-bordered { border: 0.3mm solid rgba(15,23,42,.18); border-radius: 1.6mm; }
.idc-cut { outline: 0.2mm dashed #cbd5e1; outline-offset: 1.5mm; }
.idc-preview-wrap { position: relative; }
.idc-scaled { transform-origin: top left; }
`;

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

function Section({
  title,
  children,
  sticky,
  right,
}: {
  title: string;
  children: React.ReactNode;
  sticky?: boolean;
  right?: React.ReactNode;
}) {
  return (
    <div className={cn("rounded-2xl border bg-card p-4 shadow-sm", sticky && "xl:sticky xl:top-4")}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        {right}
      </div>
      {children}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Input
        type="number"
        step="0.5"
        min="0"
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
      />
    </div>
  );
}

function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-input accent-primary"
      />
      {label}
    </label>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-emerald-600 dark:text-emerald-400">✓</span>
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}


/**
 * Scales its children down (or up) to exactly fill the width it is given.
 *
 * The previews used fixed zoom factors, which meant guessing how wide each
 * panel would be — and the guesses were wrong: portrait thumbnails overflowed
 * their tile by 25px and landscape ones by 100px, and the card preview spilled
 * under the neighbouring panel. Measuring the real container removes the guess,
 * so a card of any size or orientation fits any panel at any viewport width.
 */
function FitBox({
  contentWidth,
  contentHeight,
  html,
  maxScale = 3,
  className,
}: {
  contentWidth: number;
  contentHeight: number;
  html: string;
  maxScale?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [avail, setAvail] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setAvail(el.getBoundingClientRect().width);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scale = avail > 0 ? Math.min(maxScale, avail / contentWidth) : 0;

  return (
    <div ref={ref} className={cn("w-full", className)}>
      {/* Hidden until measured, so nothing flashes at the wrong size. */}
      <div
        className="relative mx-auto overflow-hidden"
        style={{
          width: contentWidth * scale,
          height: contentHeight * scale,
          visibility: scale > 0 ? "visible" : "hidden",
        }}
      >
        <div
          className="absolute left-0 top-0 origin-top-left"
          style={{ width: contentWidth, height: contentHeight, transform: `scale(${scale})` }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </div>
  );
}

/** The selected design at full size, filling the preview panel. */
function ScaledCard({
  ctx,
  design,
  border,
}: {
  ctx: CardContext;
  design: CardDesign;
  border: boolean;
}) {
  return (
    <FitBox
      contentWidth={design.width * MM}
      contentHeight={design.height * MM}
      maxScale={2.4}
      html={renderCard(ctx, design, { border, cutLines: false })}
    />
  );
}

/**
 * Template thumbnail, rendered in the orientation currently selected — the
 * chooser shows the shape that will actually be printed, not a fixed one.
 */
function MiniCard({
  ctx,
  styleId,
  accent,
  grid,
  orientation,
  saved,
}: {
  ctx: CardContext | null;
  styleId: string;
  accent: string;
  grid: { cardWidth: number; cardHeight: number };
  orientation: PrintLayoutSettings["orientation"];
  /** The school's own layout for this style, when it has customised one. */
  saved?: CardDesign;
}) {
  // Show the school's saved layout rather than the stock preset, so the chooser
  // shows the card that will actually print.
  const design = saved ?? presetDesign(styleId, orientation, grid.cardWidth, grid.cardHeight);
  const sample: CardContext = ctx ?? PLACEHOLDER_CTX;
  return (
    <FitBox
      contentWidth={design.width * MM}
      contentHeight={design.height * MM}
      maxScale={1}
      html={renderCard({ ...sample, accent: accent || design.accent }, design, {
        border: true,
        cutLines: false,
      })}
    />
  );
}

/** A full A4 sheet scaled to the panel — a true print preview. */
function SheetPreview({
  contexts,
  design,
  layout,
}: {
  contexts: CardContext[];
  design: CardDesign;
  layout: PrintLayoutSettings;
}) {
  const grid = resolveGrid(layout);
  const cards = contexts
    .map((c) =>
      renderCard(c, design, {
        border: layout.showCardBorder,
        cutLines: layout.showCutLines,
      }),
    )
    .join("");
  const sheet = `<div style="
      width:${PAGE_A4.width}mm;height:${PAGE_A4.height}mm;padding:${grid.margin}mm;
      background:#fff;display:grid;box-sizing:border-box;
      grid-template-columns:repeat(${grid.cols},${grid.cardWidth}mm);
      grid-auto-rows:${grid.cardHeight}mm;gap:${grid.gap}mm;
      justify-content:center;align-content:start;overflow:hidden;">${cards}</div>`;
  return (
    <FitBox
      contentWidth={PAGE_A4.width * MM}
      contentHeight={PAGE_A4.height * MM}
      maxScale={1}
      className="[&>div]:rounded-lg [&>div]:border [&>div]:shadow-sm"
      html={sheet}
    />
  );
}

/** Stand-in used for thumbnails before a student is selected. */
const PLACEHOLDER_CTX: CardContext = {
  studentId: "STD-0000",
  studentName: "Student Name",
  className: "Grade 12",
  section: "A",
  academicYear: "—",
  gender: "MALE",
  dob: "—",
  photoDataUrl: null,
  guardianName: "",
  guardianPhone: "",
  schoolName: "School",
  schoolMotto: "",
  schoolAddress: "",
  schoolPhone: "",
  schoolEmail: "",
  schoolWebsite: "",
  logoDataUrl: null,
  principalName: "",
  accent: "#1d4ed8",
  cardTitle: "ID CARD",
  idLabel: "ID",
  footerText: "",
  issueDate: "",
  qrDataUrl: null,
  examName: "",
  examDate: "",
  examSession: "",
  examOffice: "",
  clearanceStatus: "",
  clearanceDetail: "",
  customLine1: "",
  customLine2: "",
};
