"use client";

import {
  LETTERHEAD_CSS,
  accentColour,
  documentFooterHtml,
  letterheadHtml,
  signatureHtml,
  stampHtml,
  watermarkHtml,
} from "@/lib/print/letterhead";
import { paperCss, type PaperSize } from "@/lib/print/paper";
import { schoolBranding } from "@/lib/settings/store";
import { designFor } from "@/lib/print/design-store";
import type { StudentCaseRecord } from "./types";

/**
 * Student case documents, on school paper.
 *
 * These were a bare bordered table with a school name above it — fine as an
 * export, wrong as a document. A behaviour record is read by a parent in a
 * meeting and kept on a file afterwards, so it goes out on the same letterhead
 * as the school's receipts and result cards, and carries the signatures that
 * make it something anyone can act on.
 *
 * Two documents, because they answer two questions. The list answers "what
 * happened in this class this week". The case file answers "what has this one
 * child done, and what was written about it" — and that one prints the full
 * description of every case, not a column squeezed into a table cell.
 */

function escapeHtml(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function shell(opts: {
  title: string;
  refLabel?: string;
  refValue?: string;
  paper: PaperSize;
  landscape: boolean;
  body: string;
  leftSignature: string;
}): string {
  const s = schoolBranding();
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/><title>${escapeHtml(opts.title)}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#0f172a;
    -webkit-print-color-adjust:exact;print-color-adjust:exact}
  ${paperCss(opts.paper)}
  ${
    opts.landscape
      ? "@page{size:" +
        (opts.paper === "A5" ? "A5" : opts.paper === "LETTER" ? "letter" : "A4") +
        " landscape}body{max-width:none}"
      : ""
  }
  ${LETTERHEAD_CSS}

  .sec{margin-top:12px}
  .sec-head{background:var(--ek-accent);color:#fff;padding:6px 12px;font-size:11px;
    font-weight:800;text-transform:uppercase;letter-spacing:.06em}
  .card{border:1px solid #e2e8f0;border-radius:10px;overflow:hidden}
  table.kv{width:100%;border-collapse:collapse}
  table.kv td{padding:5px 12px;font-size:11.5px;border-bottom:1px solid #f1f5f9}
  table.kv td.k{color:#64748b;width:34%}
  table.kv td.v{font-weight:600}
  table.kv tr:last-child td{border-bottom:none}

  .stats{display:flex;gap:10px;margin-top:12px}
  .stat{flex:1;border:1px solid #e2e8f0;border-radius:8px;padding:8px 12px}
  .stat-l{font-size:9.5px;color:#64748b;text-transform:uppercase;letter-spacing:.05em}
  .stat-v{font-size:16px;font-weight:800;margin-top:2px;font-variant-numeric:tabular-nums}

  table.list{width:100%;border-collapse:collapse;margin-top:12px}
  table.list th{background:#f8fafc;color:#475569;font-size:10px;font-weight:700;
    text-transform:uppercase;letter-spacing:.04em;padding:7px 10px;text-align:start;
    border-bottom:1px solid #dbeafe}
  table.list td{padding:6px 10px;font-size:11.5px;border-bottom:1px solid #f1f5f9;
    vertical-align:top}
  table.list td.n{width:30px;color:#94a3b8}
  table.list .mono{font-family:ui-monospace,monospace;font-size:10.5px}
  table.list td.empty{padding:28px;text-align:center;color:#64748b}

  /* One case, as an entry rather than a row — the description is the point of
     the document and a table cell is the wrong shape for a paragraph. */
  .entry{border:1px solid #e2e8f0;border-radius:10px;margin-top:10px;overflow:hidden}
  .entry-top{display:flex;align-items:baseline;justify-content:space-between;gap:12px;
    background:#f8fafc;padding:7px 12px;border-bottom:1px solid #e2e8f0}
  .entry-title{font-size:12.5px;font-weight:800}
  .entry-date{font-size:10.5px;color:#475569;white-space:nowrap;
    font-variant-numeric:tabular-nums}
  .entry-body{padding:9px 12px;font-size:11.5px;line-height:1.55;white-space:pre-wrap}
  .entry-body.none{color:#94a3b8;font-style:italic}
  .entry-by{padding:0 12px 9px;font-size:10px;color:#64748b}

  /* A long file keeps its headings on every sheet and never splits an entry
     across a page break. */
  thead{display:table-header-group}
  tr,.entry{break-inside:avoid;page-break-inside:avoid}

  .foot-band{margin-top:26px;display:flex;align-items:flex-end;
    justify-content:space-between;gap:16px}

  @media print{ .doc-watermark{position:absolute} }
</style></head>
<body>
<div class="doc" style="--ek-accent:${accentColour()}">
  ${watermarkHtml()}
  ${letterheadHtml({
    title: opts.title,
    refLabel: opts.refLabel,
    refValue: opts.refValue,
  })}

  ${opts.body}

  <div class="foot-band">
    ${signatureHtml(opts.leftSignature)}
    ${stampHtml(s.name.trim().slice(0, 18), "OFFICIAL")}
    ${signatureHtml("Principal")}
  </div>

  ${documentFooterHtml()}
</div>
</body></html>`;
}

function design(): { paper: PaperSize; landscape: boolean } {
  const d = designFor("STUDENT_CASE_FILE");
  return { paper: d.paper ?? "A4", landscape: d.landscape ?? false };
}

// ── One student's own file ──────────────────────────────────────────────

export interface StudentCaseFileOptions {
  student: {
    code: string;
    name: string;
    className?: string;
    section?: string;
    academicYear?: string;
  };
  /** Newest first; the document prints them in the order given. */
  rows: { title: string; note: string | null; date: string; recordedByUsername: string | null }[];
  paper?: PaperSize;
  landscape?: boolean;
}

export function studentCaseFileHtml(opts: StudentCaseFileOptions): string {
  const d = design();
  const paper = opts.paper ?? d.paper;
  const landscape = opts.landscape ?? d.landscape;

  const scope = [
    { label: "Student ID", value: opts.student.code },
    { label: "Student Name", value: opts.student.name },
    { label: "Class", value: opts.student.className ?? "" },
    { label: "Section", value: opts.student.section ?? "" },
    { label: "Academic Year", value: opts.student.academicYear ?? "" },
  ]
    .filter((x) => x.value && x.value !== "—")
    .map(
      (x) =>
        `<tr><td class="k">${escapeHtml(x.label)}</td><td class="v">${escapeHtml(x.value)}</td></tr>`,
    )
    .join("");

  const dates = opts.rows.map((r) => r.date).sort();

  const stats = [
    { label: "Total Cases", value: String(opts.rows.length) },
    { label: "First Recorded", value: dates[0] ?? "—" },
    { label: "Most Recent", value: dates[dates.length - 1] ?? "—" },
  ]
    .map(
      (x) => `<div class="stat">
        <div class="stat-l">${escapeHtml(x.label)}</div>
        <div class="stat-v">${escapeHtml(x.value)}</div>
      </div>`,
    )
    .join("");

  const entries = opts.rows.length
    ? opts.rows
        .map(
          (r, i) => `<div class="entry">
            <div class="entry-top">
              <span class="entry-title">${i + 1}. ${escapeHtml(r.title)}</span>
              <span class="entry-date">${escapeHtml(r.date)}</span>
            </div>
            <div class="entry-body${r.note ? "" : " none"}">${
              r.note ? escapeHtml(r.note) : "No description was recorded for this case."
            }</div>
            ${
              r.recordedByUsername
                ? `<div class="entry-by">Recorded by ${escapeHtml(r.recordedByUsername)}</div>`
                : ""
            }
          </div>`,
        )
        .join("")
    : `<div class="entry"><div class="entry-body none">
         This student has no recorded cases.
       </div></div>`;

  return shell({
    title: "Student Case File",
    refLabel: "Student ID",
    refValue: opts.student.code,
    paper,
    landscape,
    leftSignature: "Class Teacher",
    body: `
  ${
    scope
      ? `<div class="sec"><div class="card">
           <div class="sec-head">Student</div>
           <table class="kv">${scope}</table>
         </div></div>`
      : ""
  }

  <div class="stats">${stats}</div>

  <div class="sec"><div class="sec-head">Recorded Cases</div></div>
  ${entries}`,
  });
}

/** One student's whole behaviour record, ready to hand to a parent. */
export function printStudentCaseFile(opts: StudentCaseFileOptions): void {
  open(studentCaseFileHtml(opts));
}

// ── A filtered list ─────────────────────────────────────────────────────

export function studentCaseListHtml(opts: {
  scope: { label: string; value: string }[];
  rows: StudentCaseRecord[];
  paper?: PaperSize;
  landscape?: boolean;
}): string {
  const d = design();
  const paper = opts.paper ?? d.paper;
  const landscape = opts.landscape ?? d.landscape;

  const scope = opts.scope
    .filter((x) => x.value && x.value !== "—")
    .map(
      (x) =>
        `<tr><td class="k">${escapeHtml(x.label)}</td><td class="v">${escapeHtml(x.value)}</td></tr>`,
    )
    .join("");

  const students = new Set(opts.rows.map((r) => r.studentId)).size;
  const stats = [
    { label: "Cases", value: String(opts.rows.length) },
    { label: "Students Involved", value: String(students) },
  ]
    .map(
      (x) => `<div class="stat">
        <div class="stat-l">${escapeHtml(x.label)}</div>
        <div class="stat-v">${escapeHtml(x.value)}</div>
      </div>`,
    )
    .join("");

  const body = opts.rows.length
    ? opts.rows
        .map(
          (r, i) => `<tr>
            <td class="n">${i + 1}</td>
            <td class="mono">${escapeHtml(r.studentCode)}</td>
            <td>${escapeHtml(r.studentName)}</td>
            <td>${escapeHtml(r.title)}</td>
            <td>${escapeHtml(r.note ?? "—")}</td>
            <td>${escapeHtml(r.date)}</td>
            <td>${escapeHtml(r.recordedByUsername ?? "—")}</td>
          </tr>`,
        )
        .join("")
    : `<tr><td class="empty" colspan="7">No cases were recorded for this selection.</td></tr>`;

  return shell({
    title: "Student Case Report",
    paper,
    landscape,
    leftSignature: "Class Teacher",
    body: `
  ${
    scope
      ? `<div class="sec"><div class="card">
           <div class="sec-head">Report Scope</div>
           <table class="kv">${scope}</table>
         </div></div>`
      : ""
  }

  <div class="stats">${stats}</div>

  <table class="list">
    <thead><tr>
      <th class="n">#</th><th>Student ID</th><th>Student Name</th>
      <th>Case</th><th>Description</th><th>Date</th><th>Recorded By</th>
    </tr></thead>
    <tbody>${body}</tbody>
  </table>`,
  });
}

/** The list exactly as the screen filtered it. */
export function printStudentCases(opts: {
  scope: { label: string; value: string }[];
  rows: StudentCaseRecord[];
}): void {
  open(studentCaseListHtml(opts));
}

function open(html: string): void {
  const w = window.open("", "_blank", "width=1000,height=1200");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  // The logo has to decode before the dialog opens or the sheet prints with a
  // hole where the letterhead should be.
  w.onload = () => {
    w.print();
  };
}
