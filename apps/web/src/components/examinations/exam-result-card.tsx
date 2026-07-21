"use client";

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

/** The scannable link (public result lookup) the QR encodes. */
function publicResultUrl(studentCode: string): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/results?code=${encodeURIComponent(studentCode)}`;
}

export function ExamResultCard({ data }: { data: ExamResultCardData }) {
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
              Examination Result
            </p>
          </div>
        </div>

        <div className="grid gap-6 p-6 md:grid-cols-[1fr_auto]">
          {/* Left: student + subjects */}
          <div className="min-w-0 space-y-5">
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
              <Info label="Student" value={data.studentName} />
              <Info label="Student ID" value={data.studentCode} mono />
              <Info label="Class" value={data.className} />
              <Info
                label="Section"
                value={data.section ? data.section : "—"}
              />
              {data.academicYear ? (
                <Info label="Academic Year" value={data.academicYear} />
              ) : null}
              <Info
                label="Examination"
                value={`${data.examName}${data.term ? ` · ${data.term}` : ""}`}
              />
            </div>

            <div className="overflow-hidden rounded-xl border">
              <table className="w-full text-sm">
                <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Subject</th>
                    <th className="px-4 py-2.5 text-right font-medium">Marks</th>
                    <th className="px-4 py-2.5 text-right font-medium">Out of</th>
                    <th className="px-4 py-2.5 text-center font-medium">Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {data.subjects.map((s) => (
                    <tr key={s.subject} className="border-t">
                      <td className="px-4 py-2.5 font-medium">{s.subject}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {s.marksObtained ?? "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                        {s.maxMarks}
                      </td>
                      <td className="px-4 py-2.5 text-center font-semibold">
                        {s.grade}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t bg-secondary/40 font-semibold">
                    <td className="px-4 py-2.5">Total</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {data.totalObtained}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                      {data.totalMax}
                    </td>
                    <td className="px-4 py-2.5 text-center">{data.grade}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Summary tiles */}
            <div className="grid grid-cols-3 gap-3">
              <Tile label="Average" value={data.average.toFixed(1)} />
              <Tile label="Percentage" value={`${pct.toFixed(1)}%`} />
              <div className="rounded-xl border bg-secondary/20 p-3 text-center">
                <p className="text-xs text-muted-foreground">Result</p>
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
              Scan to verify
            </p>
            {qr ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qr}
                alt="Result verification QR code"
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
            {branding.name} · Official examination result
          </p>
          <Button
            variant="outline"
            onClick={handlePrint}
            className="result-card-noprint h-9 px-3 text-sm"
          >
            <Printer className="mr-1.5 h-4 w-4" />
            Print
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
