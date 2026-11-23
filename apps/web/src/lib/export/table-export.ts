"use client";

import { API_URL, ApiError, TENANT, getAccessToken } from "@/lib/api";
import { escapeHtml } from "@/lib/print/header";
import { schoolBranding } from "@/lib/settings/store";

export type ExportFormat = "xlsx" | "docx" | "pdf" | "csv";

export interface ExportColumn {
  key: string;
  label: string;
  align?: "left" | "right" | "center";
}

export interface ExportSpec {
  /** "Student List", "Monthly Payroll"… — the document's heading. */
  title: string;
  /** Lines under it: academic year, class, the filters applied. */
  subtitle?: string[];
  columns: ExportColumn[];
  rows: Record<string, string | number | null | undefined>[];
  /** File name without extension; the title is used when omitted. */
  fileName?: string;
}

export const EXPORT_FORMATS: { id: ExportFormat; label: string; hint: string }[] = [
  { id: "xlsx", label: "Excel", hint: ".xlsx workbook" },
  { id: "docx", label: "Word", hint: ".doc document" },
  { id: "pdf", label: "PDF", hint: "ready to print or send" },
  { id: "csv", label: "CSV", hint: "plain data" },
];

function slug(s: string): string {
  return (
    s
      .replace(/[^\p{L}\p{N}\- ]+/gu, "")
      .trim()
      .replace(/\s+/g, "-")
      .toLowerCase() || "export"
  );
}

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function cellText(v: unknown): string {
  return v === null || v === undefined ? "" : String(v);
}

/**
 * Download a table in the format asked for, on the school's letterhead.
 *
 * Excel and PDF are built by the server (a real .xlsx, and the same branded
 * PDF the results sheets use); Word and CSV are written here. Every format
 * carries the same columns in the same order as the screen.
 */
export async function exportTable(format: ExportFormat, spec: ExportSpec): Promise<void> {
  const base = slug(spec.fileName ?? spec.title);
  if (format === "csv") return exportCsv(spec, `${base}.csv`);
  if (format === "docx") return exportWord(spec, `${base}.doc`);

  const token = getAccessToken();
  const res = await fetch(`${API_URL}/api/exports/table`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-tenant-subdomain": TENANT,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      format,
      title: spec.title,
      subtitle: (spec.subtitle ?? []).filter(Boolean),
      fileName: spec.fileName,
      columns: spec.columns,
      rows: spec.rows.map((r) =>
        Object.fromEntries(
          spec.columns.map((c) => {
            const v = r[c.key];
            return [c.key, typeof v === "number" ? v : cellText(v).slice(0, 2000)];
          }),
        ),
      ),
    }),
  });
  if (!res.ok) {
    let message = "The export could not be created.";
    try {
      const body = (await res.json()) as { message?: unknown };
      if (typeof body.message === "string") message = body.message;
    } catch {
      /* keep the generic message */
    }
    throw new ApiError(res.status, message);
  }
  save(await res.blob(), `${base}.${format}`);
}

function exportCsv(spec: ExportSpec, name: string) {
  const esc = (v: unknown) => `"${cellText(v).replace(/"/g, '""')}"`;
  const lines = [
    ["#", ...spec.columns.map((c) => c.label)].map(esc).join(","),
    ...spec.rows.map((r, i) =>
      [i + 1, ...spec.columns.map((c) => r[c.key])].map(esc).join(","),
    ),
  ];
  // The BOM makes Excel read Somali and Arabic names as UTF-8.
  save(new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" }), name);
}

/**
 * A Word document. Word opens an HTML file saved as .doc natively and keeps
 * its tables, colours and the landscape page set here, so the list arrives
 * looking like the rest of the school's documents and can still be edited.
 */
function exportWord(spec: ExportSpec, name: string) {
  const school = schoolBranding();
  const accent = school.primaryColor || "#4f46e5";
  // Word cannot show an image held only in the browser (a data: URL); a
  // logo served from the web it can.
  const logo =
    school.logoUrl && /^https?:\/\//.test(school.logoUrl)
      ? `<img src="${escapeHtml(school.logoUrl)}" width="64" height="64" style="float:left;margin-right:12px" />`
      : "";
  const head = spec.columns
    .map((c) => `<th style="text-align:${c.align === "right" ? "right" : "left"}">${escapeHtml(c.label)}</th>`)
    .join("");
  const body = spec.rows
    .map(
      (r, i) =>
        `<tr${i % 2 ? ' class="alt"' : ""}><td class="n">${i + 1}</td>${spec.columns
          .map(
            (c) =>
              `<td style="text-align:${c.align === "right" ? "right" : c.align === "center" ? "center" : "left"}">${escapeHtml(cellText(r[c.key]))}</td>`,
          )
          .join("")}</tr>`,
    )
    .join("");
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${escapeHtml(spec.title)}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
<style>
  @page Section1 { size: 841.9pt 595.3pt; mso-page-orientation: landscape; margin: 36pt 36pt 36pt 36pt; }
  div.Section1 { page: Section1; }
  body { font-family: Calibri, Arial, sans-serif; color: #0f172a; }
  .school { font-size: 18pt; font-weight: bold; margin: 0; }
  .tag { color: #64748b; font-size: 10pt; margin: 2pt 0 0; }
  .title { color: ${accent}; font-size: 14pt; font-weight: bold; margin: 14pt 0 2pt; }
  .sub { color: #475569; font-size: 10pt; margin: 0; }
  .rule { border-bottom: 2.25pt solid ${accent}; margin: 8pt 0 10pt; }
  table { border-collapse: collapse; width: 100%; font-size: 10pt; }
  th { background: ${accent}; color: #ffffff; padding: 5pt 6pt; border: 0.75pt solid ${accent}; }
  td { padding: 4pt 6pt; border: 0.75pt solid #cbd5e1; }
  tr.alt td { background: #f8fafc; }
  td.n { color: #64748b; text-align: center; width: 24pt; }
  .foot { color: #94a3b8; font-size: 8.5pt; margin-top: 10pt; }
</style></head>
<body><div class="Section1">
  <div>${logo}<p class="school">${escapeHtml(school.name)}</p>${
    school.tagline ? `<p class="tag">${escapeHtml(school.tagline)}</p>` : ""
  }</div>
  <div class="rule" style="clear:both"></div>
  <p class="title">${escapeHtml(spec.title)}</p>
  ${(spec.subtitle ?? []).filter(Boolean).map((s) => `<p class="sub">${escapeHtml(s)}</p>`).join("")}
  <br/>
  <table><thead><tr><th style="text-align:center">#</th>${head}</tr></thead><tbody>${
    body || `<tr><td colspan="${spec.columns.length + 1}">No records</td></tr>`
  }</tbody></table>
  <p class="foot">Total: ${spec.rows.length} · Generated ${escapeHtml(new Date().toLocaleString())} · eKulmis</p>
</div></body></html>`;
  save(new Blob(["﻿" + html], { type: "application/msword" }), name);
}
