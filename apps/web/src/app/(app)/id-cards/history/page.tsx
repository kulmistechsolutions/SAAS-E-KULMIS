"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, FileDown, Loader2, Printer, RotateCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/lib/i18n/provider";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { useStudentsState } from "@/lib/students/store";
import {
  apiCardReport,
  apiCardIssueSummary,
  apiListCardIssues,
  apiListCardDesigns,
  apiRecordCardIssues,
  apiMarkBatchPrinted,
  toDesignMap,
  type CardIssueRow,
  type CardReport,
} from "@/lib/id-cards/api";
import { exportCardReportCsv, printCardReport } from "@/lib/id-cards/report-export";
import { CARD_TYPES, DEFAULT_LAYOUT } from "@/lib/id-cards/types";
import type { CardDesign } from "@/lib/id-cards/elements";
import { presetDesign } from "@/lib/id-cards/presets";
import { resolveGrid } from "@/lib/id-cards/layout";
import { buildCardContexts } from "@/lib/id-cards/data";
import { printCards } from "@/lib/id-cards/print";

const STATUS_TONE: Record<string, string> = {
  GENERATED: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  PRINTED: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  REPLACED: "bg-amber-500/15 text-amber-600 dark:text-amber-500",
  CANCELLED: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
};

const CARD_TYPE_LABEL = new Map(CARD_TYPES.map((c) => [c.id as string, c.label]));

export default function CardHistoryPage() {
  const t = useT();
  const studentsState = useStudentsState();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [rows, setRows] = useState<CardIssueRow[]>([]);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [cardType, setCardType] = useState("");
  const [status, setStatus] = useState("");
  const [designs, setDesigns] = useState<Record<string, CardDesign>>({});
  const [reprinting, setReprinting] = useState<string | null>(null);
  const [reason, setReason] = useState("Lost card");
  const [askFor, setAskFor] = useState<CardIssueRow | null>(null);
  const [report, setReport] = useState<CardReport | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    void apiListCardIssues({
      search: search || undefined,
      cardType: cardType || undefined,
      status: status || undefined,
    })
      .then(setRows)
      .catch(() => toast("Could not load the history", "error"))
      .finally(() => setLoading(false));
  }, [search, cardType, status]);

  useEffect(() => {
    if (!mounted) return;
    const id = setTimeout(load, 250);
    return () => clearTimeout(id);
  }, [mounted, load]);

  useEffect(() => {
    if (!mounted) return;
    void apiCardIssueSummary().then(setSummary).catch(() => undefined);
    void apiCardReport().then(setReport).catch(() => undefined);
    void apiListCardDesigns()
      .then((r) => setDesigns(toDesignMap(r)))
      .catch(() => undefined);
  }, [mounted]);

  const studentById = useMemo(
    () => new Map(studentsState.students.map((s) => [s.id, s])),
    [studentsState.students],
  );

  /**
   * Reprint one card.
   *
   * The replacement is built from the SAME student record, so it carries the
   * same permanent ID that was on the lost card — a reprint never mints a new
   * one. It is recorded as its own issue pointing back at the card it replaces.
   */
  async function doReprint(row: CardIssueRow, why: string) {
    const student = studentById.get(row.studentId);
    if (!student) {
      toast("That student is no longer on the register", "error");
      return;
    }
    setReprinting(row.id);
    try {
      const orientation = row.orientation === "LANDSCAPE" ? "LANDSCAPE" : "PORTRAIT";
      const layout = { ...DEFAULT_LAYOUT, orientation: orientation as "PORTRAIT" | "LANDSCAPE" };
      const grid = resolveGrid(layout);
      const key = `${row.styleId}|${orientation}|${round(grid.cardWidth)}x${round(grid.cardHeight)}`;
      const design =
        designs[key] ?? presetDesign(row.styleId, orientation, grid.cardWidth, grid.cardHeight);

      const ctxs = await buildCardContexts([student], {
        template: { accent: design.accent },
        labels: {
          cardTitle: CARD_TYPE_LABEL.get(row.cardType) ?? "Student ID Card",
          idLabel: row.cardType === "EXAM_CARD" ? "Exam ID" : "Student ID",
          footerText: "",
        },
        accent: design.accent,
        includePhotos: true,
        includeQr: true,
      });

      const res = await apiRecordCardIssues({
        cardType: row.cardType,
        styleId: row.styleId,
        orientation,
        academicYear: row.academicYear ?? undefined,
        isReprint: true,
        reprintOfId: row.id,
        reprintReason: why,
        students: [
          {
            studentId: student.id,
            studentCode: student.code,
            studentName: student.fullName,
            className: student.className || undefined,
            section: student.section || undefined,
          },
        ],
      });

      printCards({
        contexts: ctxs,
        design,
        grid,
        border: true,
        cutLines: true,
        title: `Reprint — ${student.fullName}`,
      });
      void apiMarkBatchPrinted(res.batchId).catch(() => undefined);
      toast(`Reprinted ${student.fullName} (${student.code})`, "success");
      load();
    } catch {
      toast("Could not reprint that card", "error");
    } finally {
      setReprinting(null);
      setAskFor(null);
    }
  }

  if (!mounted) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        <Loader2 className="me-2 h-5 w-5 animate-spin" /> {t("idCards.loading")}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        href="/id-cards"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> {t("idCards.backToGenerator")}
      </Link>

      <div>
        <h1 className="text-2xl font-bold">{t("idCards.history")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("idCards.historySubtitle")}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label={t("idCards.totalIssued")} value={summary.total ?? 0} />
        <Stat label={t("idCards.printed")} value={summary.printed ?? 0} />
        <Stat label={t("idCards.reprints")} value={summary.reprints ?? 0} />
        <Stat label={t("idCards.replaced")} value={summary.replaced ?? 0} />
        <Stat label={t("idCards.studentsWithCards")} value={summary.studentsWithCards ?? 0} />
      </div>

      {report && (
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">{t("idCards.reports")}</h2>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => exportCardReportCsv(report)}>
                <FileDown className="me-2 h-4 w-4" /> {t("idCards.exportCsv")}
              </Button>
              <Button variant="outline" onClick={() => printCardReport(report)}>
                <Printer className="me-2 h-4 w-4" /> {t("idCards.printPdf")}
              </Button>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Attention
              label={t("idCards.withoutPhotos")}
              value={report.counts.withoutPhotos ?? 0}
              hint={t("idCards.withoutPhotosHint")}
            />
            <Attention
              label={t("idCards.withoutCards")}
              value={report.counts.withoutCards ?? 0}
              hint={t("idCards.withoutCardsHint")}
            />
            <Attention
              label={t("idCards.activeStudents")}
              value={report.counts.activeStudents ?? 0}
              hint=""
              muted
            />
          </div>
        </div>
      )}

      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("idCards.searchStudent")}
              className="ps-9"
            />
          </div>
          <Select value={cardType} onChange={(e) => setCardType(e.target.value)} className="w-44">
            <option value="">{t("idCards.allCardTypes")}</option>
            {CARD_TYPES.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </Select>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-40">
            <option value="">{t("idCards.allStatuses")}</option>
            <option value="GENERATED">{t("idCards.generated")}</option>
            <option value="PRINTED">{t("idCards.printed")}</option>
            <option value="REPLACED">{t("idCards.replaced")}</option>
          </Select>
          <Button variant="outline" onClick={load}>
            <RotateCcw className="me-2 h-4 w-4" /> {t("idCards.refresh")}
          </Button>
        </div>

        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-secondary text-start text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-start font-medium">{t("idCards.issuedOn")}</th>
                <th className="px-4 py-2.5 text-start font-medium">{t("idCards.student")}</th>
                <th className="px-4 py-2.5 text-start font-medium">{t("idCards.studentId")}</th>
                <th className="px-4 py-2.5 text-start font-medium">{t("idCards.cardTypeCol")}</th>
                <th className="px-4 py-2.5 text-start font-medium">{t("idCards.class")}</th>
                <th className="px-4 py-2.5 text-start font-medium">{t("idCards.status")}</th>
                <th className="px-4 py-2.5 text-end font-medium">{t("idCards.action")}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    <Loader2 className="me-2 inline h-4 w-4 animate-spin" />
                    {t("idCards.loading")}
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    {t("idCards.noHistory")}
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      {new Date(r.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2.5">
                      {r.studentName}
                      {r.isReprint && (
                        <span className="ms-2 rounded bg-amber-500/15 px-1.5 py-0.5 text-[11px] text-amber-600 dark:text-amber-500">
                          {t("idCards.reprint")}
                        </span>
                      )}
                      {r.reprintReason && (
                        <span className="ms-1 text-xs text-muted-foreground">
                          ({r.reprintReason})
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs">{r.studentCode}</td>
                    <td className="px-4 py-2.5">
                      {CARD_TYPE_LABEL.get(r.cardType) ?? r.cardType}
                      {(r.issueCount ?? 1) > 1 && (
                        <span className="ms-1 text-xs text-muted-foreground">
                          ×{r.issueCount}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {[r.className, r.section].filter(Boolean).join(" · ") || "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[11px] font-medium",
                          STATUS_TONE[r.status] ?? "bg-secondary",
                        )}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-end">
                      <Button
                        variant="outline"
                        disabled={reprinting === r.id}
                        onClick={() => {
                          setReason("Lost card");
                          setAskFor(r);
                        }}
                      >
                        {reprinting === r.id ? (
                          <Loader2 className="me-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Printer className="me-2 h-4 w-4" />
                        )}
                        {t("idCards.reprintAction")}
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {askFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl border bg-card p-5 shadow-lg">
            <h2 className="text-sm font-semibold">{t("idCards.reprintAction")}</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {askFor.studentName} · {askFor.studentCode}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">{t("idCards.reprintSameId")}</p>
            <div className="mt-3">
              <Label>{t("idCards.reprintReason")}</Label>
              <Select value={reason} onChange={(e) => setReason(e.target.value)}>
                <option value="Lost card">{t("idCards.reasonLost")}</option>
                <option value="Damaged card">{t("idCards.reasonDamaged")}</option>
                <option value="Details changed">{t("idCards.reasonDetails")}</option>
                <option value="Other">{t("idCards.reasonOther")}</option>
              </Select>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAskFor(null)}>
                {t("idCards.cancel")}
              </Button>
              <Button
                disabled={!!reprinting}
                onClick={() => void doReprint(askFor, reason)}
              >
                {reprinting ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}
                {t("idCards.reprintAction")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

function Attention({
  label, value, hint, muted,
}: { label: string; value: number; hint: string; muted?: boolean }) {
  const needsAction = !muted && value > 0;
  return (
    <div
      className={cn(
        "rounded-xl border p-3",
        needsAction && "border-amber-400/50 bg-amber-500/5",
      )}
    >
      <p className={cn("text-xl font-bold", needsAction && "text-amber-600 dark:text-amber-500")}>
        {value}
      </p>
      <p className="text-xs font-medium">{label}</p>
      {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border bg-card p-3 text-center shadow-sm">
      <p className="text-xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
