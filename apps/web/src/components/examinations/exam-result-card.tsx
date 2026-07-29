"use client";


import { useT } from "@/lib/i18n/provider";
import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { Printer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSchoolBranding } from "@/lib/settings/use-school-branding";

/** One subject line on the card. */
export interface ResultCardSubject {
  subject: string;
  maxMarks: number;
  marksObtained: number | null;
  grade: string;
}

/** One exam's combined-view column header, when the card shows a whole exam group. */
export interface ResultCardGroupColumn {
  examId: string;
  label: string;
  maxMarks: number;
}

/** One subject row spanning every exam in the group, plus the weighted combined score. */
export interface ResultCardGroupSubjectRow {
  subject: string;
  perExam: Record<string, number | null>;
  combinedPercent: number;
  grade: string;
}

/** Everything the card needs, normalized from either the student profile
 *  (StudentFinalResult.termResults) or the class results matrix (one row). */
export interface ExamResultCardData {
  studentName: string;
  studentCode: string;
  className: string;
  section?: string | null;
  academicYear?: string;
  examName: string;
  term?: string;
  subjects: ResultCardSubject[];
  totalObtained: number;
  totalMax: number;
  average: number;
  grade: string;
  passed: boolean;
  /** When set, renders one column per exam in the group instead of the single-exam table. */
  group?: {
    examColumns: ResultCardGroupColumn[];
    subjectRows: ResultCardGroupSubjectRow[];
  };
}

/** Letter grade for a single subject, used where the API only returns marks. */
export function subjectGrade(
  marksObtained: number | null,
  maxMarks: number,
): string {
  if (marksObtained == null || maxMarks <= 0) return "—";
  const pct = (marksObtained / maxMarks) * 100;
  if (pct >= 90) return "A+";
  if (pct >= 80) return "A";
  if (pct >= 70) return "B";
  if (pct >= 60) return "C";
  if (pct >= 50) return "D";
  return "F";
}

/** Tailwind classes for a grade pill — green for top grades, fading to red for a fail. */
function gradeTone(grade: string): string {
  switch (grade) {
    case "A+":
    case "A":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300";
    case "B":
      return "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300";
    case "C":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300";
    case "D":
      return "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300";
    case "F":
      return "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300";
    default:
      return "bg-secondary text-muted-foreground";
  }
}

function GradePill({ grade }: { grade: string }) {
  return (
    <span
      className={`inline-flex min-w-[2.25rem] items-center justify-center rounded-md px-2 py-0.5 text-xs font-bold ${gradeTone(grade)}`}
    >
      {grade}
    </span>
  );
}

/** The scannable link (public result lookup) the QR encodes. */
function publicResultUrl(studentCode: string): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/results?code=${encodeURIComponent(studentCode)}`;
}

export function ExamResultCard({ data }: { data: ExamResultCardData }) {
  const t = useT();
  const branding = useSchoolBranding();
  const [qr, setQr] = useState<string | null>(null);

  const scanUrl = useMemo(
    () => publicResultUrl(data.studentCode),
    [data.studentCode],
  );

  useEffect(() => {
    if (!scanUrl) return;
    let active = true;
    void QRCode.toDataURL(scanUrl, {
      width: 240,
      margin: 1,
      errorCorrectionLevel: "M",
    })
      .then((url) => {
        if (active) setQr(url);
      })
      .catch(() => {
        if (active) setQr(null);
      });
    return () => {
      active = false;
    };
  }, [scanUrl]);

  const pct = data.totalMax > 0 ? (data.totalObtained / data.totalMax) * 100 : 0;

  function handlePrint() {
    window.print();
  }

  return (
    <div className="result-card-print">
      {/* Print rules: hide the app chrome, show only the card. */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .result-card-print, .result-card-print * { visibility: visible !important; }
          .result-card-print { position: absolute; inset: 0; margin: 0; padding: 24px; }
          .result-card-noprint { display: none !important; }
        }
      `}</style>

      <div className="overflow-hidden rounded-2xl border bg-card">
        {/* Header band */}
        <div className="flex items-center gap-4 bg-gradient-to-r from-primary/90 to-primary px-6 py-5 text-primary-foreground">
          {branding.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={branding.logoUrl}
              alt=""
              className="h-14 w-14 rounded-xl bg-white/90 object-contain p-1"
            />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/20 text-xl font-bold">
              {branding.name.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold leading-tight">
              {branding.name}
            </h2>
            {branding.tagline ? (
              <p className="truncate text-sm text-primary-foreground/80">
                {branding.tagline}
              </p>
            ) : null}
            <p className="mt-0.5 text-xs font-medium uppercase tracking-wide text-primary-foreground/80">
              {t("examinationsExamResultCard.examinationResult")}
            </p>
          </div>
        </div>

        <div className="grid gap-6 p-6 md:grid-cols-[1fr_auto]">
          {/* Left: student + subjects */}
          <div className="min-w-0 space-y-5">
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
              <Info label={t("examinationsExamResultCard.student")} value={data.studentName} />
              <Info label={t("examinationsExamResultCard.studentId")} value={data.studentCode} mono />
              <Info label={t("examinationsExamResultCard.class")} value={data.className} />
              <Info
                label={t("examinationsExamResultCard.section")}
                value={data.section ? data.section : "—"}
              />
              {data.academicYear ? (
                <Info label={t("examinationsExamResultCard.academicYear")} value={data.academicYear} />
              ) : null}
              <div className="col-span-2 min-w-0 sm:col-span-3">
                <p className="text-xs text-muted-foreground">{t("examinationsExamResultCard.examination")}</p>
                <p className="break-words font-medium">
                  {data.examName}
                  {data.term ? ` · ${data.term}` : ""}
                  {data.group ? (
                    <span className="ml-2 inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-wide text-primary">
                      {t("examinationsExamResultCard.combined")}
                    </span>
                  ) : null}
                </p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border">
              {data.group ? (
                <table className="w-full text-sm">
                  <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2.5 font-medium">{t("examinationsExamResultCard.subject")}</th>
                      {data.group.examColumns.map((col) => (
                        <th key={col.examId} className="px-4 py-2.5 text-right font-medium whitespace-nowrap">
                          {col.label}
                        </th>
                      ))}
                      <th className="px-4 py-2.5 text-right font-medium">{t("examinationsExamResultCard.combined")}</th>
                      <th className="px-4 py-2.5 text-center font-medium">{t("examinationsExamResultCard.grade")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.group.subjectRows.map((row) => (
                      <tr key={row.subject} className="border-t odd:bg-secondary/20">
                        <td className="px-4 py-2.5 font-medium">{row.subject}</td>
                        {data.group!.examColumns.map((col) => (
                          <td key={col.examId} className="px-4 py-2.5 text-right tabular-nums">
                            {row.perExam[col.examId] ?? "—"}
                            <span className="text-muted-foreground"> / {col.maxMarks}</span>
                          </td>
                        ))}
                        <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
                          {row.combinedPercent}%
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <GradePill grade={row.grade} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t bg-secondary/40 font-semibold">
                      <td className="px-4 py-2.5" colSpan={1 + data.group.examColumns.length}>
                        {t("examinationsExamResultCard.total")}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{data.average}%</td>
                      <td className="px-4 py-2.5 text-center">
                        <GradePill grade={data.grade} />
                      </td>
                    </tr>
                  </tfoot>
                </table>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2.5 font-medium">{t("examinationsExamResultCard.subject")}</th>
                      <th className="px-4 py-2.5 text-right font-medium">{t("examinationsExamResultCard.marks")}</th>
                      <th className="px-4 py-2.5 text-right font-medium">{t("examinationsExamResultCard.outOf")}</th>
                      <th className="px-4 py-2.5 text-center font-medium">{t("examinationsExamResultCard.grade")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.subjects.map((s) => (
                      <tr key={s.subject} className="border-t odd:bg-secondary/20">
                        <td className="px-4 py-2.5 font-medium">{s.subject}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          {s.marksObtained ?? "—"}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                          {s.maxMarks}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <GradePill grade={s.grade} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t bg-secondary/40 font-semibold">
                      <td className="px-4 py-2.5">{t("examinationsExamResultCard.total")}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {data.totalObtained}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                        {data.totalMax}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <GradePill grade={data.grade} />
                      </td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>

            {/* Summary tiles */}
            <div className="grid grid-cols-3 gap-3">
              <Tile label={t("examinationsExamResultCard.average")} value={data.average.toFixed(1)} />
              <Tile label={t("examinationsExamResultCard.percentage")} value={`${pct.toFixed(1)}%`} />
              <div className="rounded-xl border bg-secondary/20 p-3 text-center">
                <p className="text-xs text-muted-foreground">{t("examinationsExamResultCard.result")}</p>
                <Badge
                  tone={data.passed ? "success" : "danger"}
                  className="mt-1"
                >
                  {data.passed ? "Pass" : "Fail"}
                </Badge>
              </div>
            </div>
          </div>

          {/* Right: QR / scan panel */}
          <div className="flex flex-col items-center justify-start gap-2 rounded-xl border bg-secondary/20 p-4 md:w-44">
            <p className="text-xs font-medium text-muted-foreground">
              {t("examinationsExamResultCard.scanToVerify")}
            </p>
            {qr ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qr}
                alt={t("examinationsExamResultCard.resultVerificationQrCode")}
                className="h-32 w-32 rounded-lg bg-white p-1.5"
              />
            ) : (
              <div className="h-32 w-32 animate-pulse rounded-lg bg-muted" />
            )}
            <p className="break-all text-center text-[10px] leading-tight text-muted-foreground">
              {data.studentCode}
            </p>
          </div>
        </div>

        {/* Footer + actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-secondary/20 px-6 py-3">
          <p className="text-xs text-muted-foreground">
            {branding.name} {t("examinationsExamResultCard.officialExaminationResult")}
          </p>
          <Button
            variant="outline"
            onClick={handlePrint}
            className="result-card-noprint h-9 px-3 text-sm"
          >
            <Printer className="mr-1.5 h-4 w-4" />
            {t("examinationsExamResultCard.print")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Info({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={`truncate font-medium ${mono ? "font-mono text-sm" : ""}`}
        title={value}
      >
        {value}
      </p>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-secondary/20 p-3 text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-bold tabular-nums">{value}</p>
    </div>
  );
}
