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
import { designFor } from "@/lib/print/design-store";
import { schoolBranding } from "@/lib/settings/store";
import { getSettings } from "@/lib/settings/store";
import { escapeHtml } from "@/lib/print/header";
import type { ReportColumn, ReportData } from "./types";

/**
 * Every report in the Reports Centre, as one document.
 *
 * It used to print under the compact header — a plain bar with the school's
 * name — while receipts, result cards and attendance sheets had long since
 * moved to the full letterhead. A report a parent, an inspector or a board
 * member reads should look like it came from the same school as the receipt
 * in their hand, so it goes out on that letterhead and takes its paper from
 * the same Settings → Print & Document Designs entry.
 *
 * The same function builds the on-screen preview and the printed sheet, so
 * what somebody approves is what comes out of the printer.
 */

export interface ReportDocumentOptions {
  title: string;
  academicYear?: string;
  /** Filters as chosen — printed so a sheet can say what it covers. */
  scope?: { label: string; value: string }[];
  data: ReportData;
  preparedBy?: string;
  paper?: PaperSize;
  landscape?: boolean;
}

function esc(v: unknown): string {
  return escapeHtml(String(v ?? ""));
}

export function reportDocumentHtml(opts: ReportDocumentOptions): string {
  const s = schoolBranding();
  const { reportFooter } = getSettings().school;
  const design = designFor("REPORT_DOCUMENT");
  const paper = opts.paper ?? design.paper ?? "A4";
  // A report is a wide table more often than not, so this is the one document
  // whose default is landscape; a school can still change it in Settings.
  const landscape = opts.landscape ?? design.landscape ?? false;

  const scope = (opts.scope ?? [])
    .filter((x) => x.value && x.value !== "—")
    .map(
      (x) =>
        `<tr><td class="k">${esc(x.label)}</td><td class="v">${esc(x.value)}</td></tr>`,
    )
    .join("");

  const summary = opts.data.summary
    .map(
      (x) => `<div class="stat">
        <div class="stat-l">${esc(x.label)}</div>
        <div class="stat-v">${esc(x.value)}</div>
      </div>`,
    )
    .join("");

  const head = opts.data.columns
    .map(
      (c) =>
        `<th class="${c.align === "right" ? "num" : ""}">${esc(c.label)}</th>`,
    )
    .join("");

  const body = opts.data.rows.length
    ? opts.data.rows
        .map(
          (row, i) =>
            `<tr><td class="n">${i + 1}</td>` +
            opts.data.columns
              .map(
                (c) =>
                  `<td class="${c.align === "right" ? "num" : ""}">${esc(row[c.key])}</td>`,
              )
              .join("") +
            "</tr>",
        )
        .join("")
    : `<tr><td class="empty" colspan="${opts.data.columns.length + 1}">No records match this selection.</td></tr>`;

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/><title>${esc(opts.title)}</title>
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

  .stats{display:flex;flex-wrap:wrap;gap:10px;margin-top:12px}
  .stat{flex:1;min-width:120px;border:1px solid #e2e8f0;border-radius:8px;padding:8px 12px}
  .stat-l{font-size:9.5px;color:#64748b;text-transform:uppercase;letter-spacing:.05em}
  .stat-v{font-size:16px;font-weight:800;margin-top:2px;font-variant-numeric:tabular-nums}

  table.list{width:100%;border-collapse:collapse;margin-top:12px}
  table.list th{background:#f8fafc;color:#475569;font-size:10px;font-weight:700;
    text-transform:uppercase;letter-spacing:.04em;padding:7px 10px;text-align:start;
    border-bottom:1px solid #dbeafe}
  table.list td{padding:6px 10px;font-size:11.5px;border-bottom:1px solid #f1f5f9}
  table.list td.n{width:30px;color:#94a3b8}
  table.list .num{text-align:end;font-variant-numeric:tabular-nums}
  table.list td.empty{padding:28px;text-align:center;color:#64748b}

  /* A long report keeps its headings on every sheet and never splits a row
     across a page break. */
  thead{display:table-header-group}
  tr{break-inside:avoid;page-break-inside:avoid}

  .foot-band{margin-top:26px;display:flex;align-items:flex-end;
    justify-content:space-between;gap:16px}
  .note{margin-top:12px;font-size:10.5px;color:#64748b;text-align:center}

  @media print{ .doc-watermark{position:absolute} }
</style></head>
<body>
<div class="doc" style="--ek-accent:${accentColour()}">
  ${watermarkHtml()}
  ${letterheadHtml({
    title: opts.title,
    subtitle: opts.academicYear ? `Academic Year ${opts.academicYear}` : undefined,
  })}

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

  <div class="note">
    ${esc(reportFooter || "")}
    ${reportFooter ? " &middot; " : ""}${opts.data.rows.length} record(s)
    &middot; ${esc(new Date().toLocaleString())}
    ${opts.preparedBy ? ` &middot; Prepared by ${esc(opts.preparedBy)}` : ""}
  </div>

  <div class="foot-band">
    ${signatureHtml("Prepared By", opts.preparedBy)}
    ${stampHtml(s.name.trim().slice(0, 18), "OFFICIAL")}
    ${signatureHtml("Authorized Signature")}
  </div>

  ${documentFooterHtml()}
</div>
</body></html>`;
}

export function printReport(opts: ReportDocumentOptions) {
  const w = window.open("", "_blank", "width=1000,height=1200");
  if (!w) return;
  w.document.write(reportDocumentHtml(opts));
  w.document.close();
  w.focus();
  // The logo has to decode before the dialog opens or the sheet prints with a
  // hole where the letterhead should be.
  w.onload = () => {
    w.print();
  };
}

/** PDF via the browser's own print dialog (Save as PDF). */
export function downloadReportPdf(opts: ReportDocumentOptions) {
  printReport(opts);
}

/**
 * CSV of exactly the columns and rows on screen.
 *
 * Values are quoted rather than stripped of their commas: a name written
 * "Ali, Mohamed" used to arrive in the spreadsheet as "Ali  Mohamed", and an
 * amount of "1,200" silently split across two columns.
 */
export function exportReportCsv(
  title: string,
  columns: ReportColumn[],
  rows: Record<string, string | number>[],
) {
  const cell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const header = columns.map((c) => cell(c.label)).join(",");
  const body = rows
    .map((row) => columns.map((c) => cell(row[c.key])).join(","))
    .join("\n");
  // Excel opens a UTF-8 CSV as the system codepage unless it sees a BOM, which
  // turns every Somali and Arabic name into mojibake.
  const blob = new Blob(["﻿" + header + "\n" + body], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${title.toLowerCase().replace(/\s+/g, "-")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
