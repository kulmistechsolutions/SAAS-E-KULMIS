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

/**
 * An attendance report, on school paper.
 *
 * The old sheet was a bare table under a plain heading — a database export
 * with a school name on top, which is exactly what a document a parent or an
 * inspector reads should not look like. This is the same letterhead every
 * receipt, invoice and result card already uses, so a school's attendance
 * report is recognisably from the same school as its receipts.
 *
 * The figures are passed in, not recomputed. Whatever the screen showed is
 * what prints — a report that adds up differently on paper than on screen is
 * worse than no report.
 */

export type AttendanceReportKind = "DAILY" | "MONTHLY" | "RANGE";

const TITLES: Record<AttendanceReportKind, string> = {
  DAILY: "Daily Attendance Report",
  MONTHLY: "Monthly Attendance Report",
  RANGE: "Attendance Report",
};

export interface AttendanceReportColumn {
  key: string;
  label: string;
  /** Numbers and codes line up when they are given their own alignment. */
  align?: "start" | "end";
  mono?: boolean;
}

export interface AttendanceReportOptions {
  kind: AttendanceReportKind;
  /** Academic year, class, section, shift, date or range — whatever applies. */
  scope: { label: string; value: string }[];
  columns: AttendanceReportColumn[];
  rows: Record<string, string | number>[];
  /** The bands across the top: present, absent, rate. */
  summary: { label: string; value: string }[];
  paper?: PaperSize;
  landscape?: boolean;
}

function escapeHtml(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function attendanceReportHtml(opts: AttendanceReportOptions): string {
  const s = schoolBranding();
  const design = designFor("ATTENDANCE_REPORT");
  const paper = opts.paper ?? design.paper ?? "A4";
  const landscape = opts.landscape ?? design.landscape ?? false;
  const title = TITLES[opts.kind];

  const scope = opts.scope
    .filter((x) => x.value && x.value !== "—")
    .map(
      (x) =>
        `<tr><td class="k">${escapeHtml(x.label)}</td><td class="v">${escapeHtml(x.value)}</td></tr>`,
    )
    .join("");

  const summary = opts.summary
    .map(
      (x) => `<div class="stat">
        <div class="stat-l">${escapeHtml(x.label)}</div>
        <div class="stat-v">${escapeHtml(x.value)}</div>
      </div>`,
    )
    .join("");

  const head = opts.columns
    .map(
      (c) =>
        `<th class="${c.align === "end" ? "num" : ""}">${escapeHtml(c.label)}</th>`,
    )
    .join("");

  const body = opts.rows.length
    ? opts.rows
        .map(
          (r, i) =>
            `<tr><td class="n">${i + 1}</td>` +
            opts.columns
              .map(
                (c) =>
                  `<td class="${c.align === "end" ? "num" : ""}${c.mono ? " mono" : ""}">${escapeHtml(r[c.key])}</td>`,
              )
              .join("") +
            "</tr>",
        )
        .join("")
    : `<tr><td class="empty" colspan="${opts.columns.length + 1}">No attendance was recorded for this selection.</td></tr>`;

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/><title>${escapeHtml(title)}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#0f172a;
    -webkit-print-color-adjust:exact;print-color-adjust:exact}
  ${paperCss(paper)}
  ${
    landscape
      ? "@page{size:" +
        (paper === "A5" ? "A5" : paper === "LETTER" ? "letter" : "A4") +
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

  /* The figures a reader looks at first, before the list. */
  .stats{display:flex;gap:10px;margin-top:12px}
  .stat{flex:1;border:1px solid #e2e8f0;border-radius:8px;padding:8px 12px}
  .stat-l{font-size:9.5px;color:#64748b;text-transform:uppercase;letter-spacing:.05em}
  .stat-v{font-size:16px;font-weight:800;margin-top:2px;font-variant-numeric:tabular-nums}

  table.list{width:100%;border-collapse:collapse;margin-top:12px}
  table.list th{background:#f8fafc;color:#475569;font-size:10px;font-weight:700;
    text-transform:uppercase;letter-spacing:.04em;padding:7px 10px;text-align:start;
    border-bottom:1px solid #dbeafe}
  table.list td{padding:6px 10px;font-size:11.5px;border-bottom:1px solid #f1f5f9}
  table.list td.n{width:30px;color:#94a3b8}
  table.list .num{text-align:end;font-variant-numeric:tabular-nums}
  table.list .mono{font-family:ui-monospace,monospace;font-size:10.5px}
  table.list td.empty{padding:28px;text-align:center;color:#64748b}

  /* A long register keeps its headings on every sheet and never splits a
     child's row across a page break. */
  thead{display:table-header-group}
  tr{break-inside:avoid;page-break-inside:avoid}

  .foot-band{margin-top:26px;display:flex;align-items:flex-end;
    justify-content:space-between;gap:16px}

  @media print{ .doc-watermark{position:absolute} }
</style></head>
<body>
<div class="doc" style="--ek-accent:${accentColour()}">
  ${watermarkHtml()}
  ${letterheadHtml({ title })}

  ${
    scope
      ? `<div class="sec"><div class="card">
           <div class="sec-head">Report Scope</div>
           <table class="kv">${scope}</table>
         </div></div>`
      : ""
  }

  ${summary ? `<div class="stats">${summary}</div>` : ""}

  <table class="list">
    <thead><tr><th class="n">#</th>${head}</tr></thead>
    <tbody>${body}</tbody>
  </table>

  <div class="foot-band">
    ${signatureHtml("Class Teacher")}
    ${stampHtml(s.name.trim().slice(0, 18), "OFFICIAL")}
    ${signatureHtml("Principal")}
  </div>

  ${documentFooterHtml()}
</div>
</body></html>`;
}

/** Open the print dialog on exactly what the screen showed. */
export function printAttendanceReport(opts: AttendanceReportOptions): void {
  const w = window.open("", "_blank", "width=1000,height=1200");
  if (!w) return;
  w.document.write(attendanceReportHtml(opts));
  w.document.close();
  w.focus();
  // The logo has to decode before the dialog opens or the sheet prints with a
  // hole where the letterhead should be.
  w.onload = () => {
    w.print();
  };
}
