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

/** An image ready to ride inside the Word file. */
interface EmbeddedImage {
  location: string;
  mime: string;
  base64: string;
  width: number;
  height: number;
}

/** Natural size of an image, so Word gets a width and height that keep its shape. */
function imageSize(src: string): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/**
 * Read the logo or banner into bytes. A data: URL already is; one served
 * from the API is fetched (it is the school's own file, same as on screen).
 * Anything unreadable is left out rather than stopping the export.
 */
async function embed(src: string | null | undefined, name: string): Promise<EmbeddedImage | null> {
  if (!src) return null;
  try {
    let dataUrl = src;
    if (!src.startsWith("data:")) {
      const res = await fetch(src);
      if (!res.ok) return null;
      const blob = await res.blob();
      dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = () => reject(r.error);
        r.readAsDataURL(blob);
      });
    }
    const m = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(dataUrl);
    if (!m || !m[2]) return null;
    const mime = m[1]!;
    if (!/^image\/(png|jpe?g|gif|bmp)$/.test(mime)) return null;
    const size = await imageSize(dataUrl);
    if (!size || !size.width || !size.height) return null;
    const ext = mime.split("/")[1]!.replace("jpeg", "jpg");
    return {
      location: `file:///C:/ekulmis/${name}.${ext}`,
      mime,
      base64: m[3]!,
      ...size,
    };
  } catch {
    return null;
  }
}

/** UTF-8 text as base64, so Somali and Arabic names survive the trip. */
function utf8Base64(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

function wrap76(b64: string): string {
  return b64.replace(/(.{76})/g, "$1\r\n");
}

/**
 * A Word document, letterhead and all.
 *
 * Word could not show the logo or the banner before: they live in the
 * browser as data: URLs, and an HTML page saved as .doc cannot carry an
 * image inside it. This writes the single-file web page Word itself uses
 * (MHTML) — the page plus its images in one file — so the logo, the
 * school's banner and the coloured table all arrive in Word, landscape and
 * still editable.
 */
async function exportWord(spec: ExportSpec, name: string) {
  const school = schoolBranding();
  const accent = school.primaryColor || "#4f46e5";
  const banner = school.headerImage ? await embed(school.headerImage.url, "banner") : null;
  const logo = banner ? null : await embed(school.logoUrl, "logo");

  // Landscape A4 leaves ~770pt across; Word takes image sizes in px (96/in).
  const PAGE_PX = 1026;
  let letterhead: string;
  if (banner) {
    const wantedMm = school.headerImage?.heightMm ?? 0;
    let w = PAGE_PX;
    let h = Math.round((PAGE_PX * banner.height) / banner.width);
    if (wantedMm > 0) {
      h = Math.round((wantedMm / 25.4) * 96);
      w = Math.min(PAGE_PX, Math.round((h * banner.width) / banner.height));
    }
    letterhead = `<p align="center" style="margin:0"><img src="${banner.location}" width="${w}" height="${h}" /></p>`;
  } else {
    const side = 72;
    const lw = logo ? Math.round(logo.width >= logo.height ? side : (side * logo.width) / logo.height) : 0;
    const lh = logo ? Math.round(logo.height >= logo.width ? side : (side * logo.height) / logo.width) : 0;
    letterhead = `<table class="lh"><tr>${
      logo ? `<td class="lh-logo"><img src="${logo.location}" width="${lw}" height="${lh}" /></td>` : ""
    }<td class="lh-text"><p class="school">${escapeHtml(school.name)}</p>${
      school.tagline ? `<p class="tag">${escapeHtml(school.tagline)}</p>` : ""
    }</td></tr></table>`;
  }

  const head = spec.columns
    .map((c) => `<th style="text-align:${c.align === "right" ? "right" : c.align === "center" ? "center" : "left"}">${escapeHtml(c.label)}</th>`)
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
  const html = `<html xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta http-equiv="Content-Type" content="text/html; charset=utf-8"><title>${escapeHtml(spec.title)}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
<style>
  @page Section1 { size: 841.9pt 595.3pt; mso-page-orientation: landscape; margin: 30pt 36pt 30pt 36pt; }
  div.Section1 { page: Section1; }
  body { font-family: Calibri, Arial, sans-serif; color: #0f172a; }
  table.lh { border-collapse: collapse; width: 100%; }
  table.lh td { border: none; padding: 0; vertical-align: middle; }
  td.lh-logo { width: 84pt; }
  .school { font-size: 18pt; font-weight: bold; margin: 0; }
  .tag { color: #64748b; font-size: 10pt; margin: 2pt 0 0; }
  .rule { border-bottom: 2.25pt solid ${accent}; margin: 6pt 0 8pt; font-size: 2pt; }
  .title { color: ${accent}; font-size: 14pt; font-weight: bold; margin: 10pt 0 2pt; text-align: center; }
  .sub { color: #475569; font-size: 10pt; margin: 0; text-align: center; }
  table.data { border-collapse: collapse; width: 100%; font-size: 10pt; margin-top: 8pt; }
  table.data th { background: ${accent}; color: #ffffff; padding: 5pt 6pt; border: 0.75pt solid ${accent}; }
  table.data td { padding: 4pt 6pt; border: 0.75pt solid #cbd5e1; }
  table.data tr.alt td { background: #f8fafc; }
  table.data td.n { color: #64748b; text-align: center; width: 24pt; }
  .foot { color: #94a3b8; font-size: 8.5pt; margin-top: 10pt; }
</style></head>
<body><div class="Section1">
  ${letterhead}
  <p class="rule">&nbsp;</p>
  <p class="title">${escapeHtml(spec.title)}</p>
  ${(spec.subtitle ?? []).filter(Boolean).map((s) => `<p class="sub">${escapeHtml(s)}</p>`).join("")}
  <table class="data"><thead><tr><th style="text-align:center">#</th>${head}</tr></thead><tbody>${
    body || `<tr><td colspan="${spec.columns.length + 1}">No records</td></tr>`
  }</tbody></table>
  <p class="foot">Total: ${spec.rows.length} · Generated ${escapeHtml(new Date().toLocaleString())} · eKulmis</p>
</div></body></html>`;

  const B = "----=_NextPart_eKulmis_0001";
  const parts = [
    `MIME-Version: 1.0\r\nContent-Type: multipart/related; boundary="${B}"; type="text/html"\r\n\r\n`,
    `--${B}\r\nContent-Type: text/html; charset="utf-8"\r\nContent-Transfer-Encoding: base64\r\nContent-Location: file:///C:/ekulmis/document.htm\r\n\r\n${wrap76(utf8Base64(html))}\r\n\r\n`,
    ...[banner, logo]
      .filter((x): x is EmbeddedImage => !!x)
      .map(
        (img) =>
          `--${B}\r\nContent-Type: ${img.mime}\r\nContent-Transfer-Encoding: base64\r\nContent-Location: ${img.location}\r\n\r\n${wrap76(img.base64)}\r\n\r\n`,
      ),
    `--${B}--\r\n`,
  ];
  save(new Blob(parts, { type: "application/msword" }), name);
}

/**
 * Any printed document — a transfer certificate, a letter — as a Word file,
 * with every image on it (logo, banner, photo, QR) carried inside.
 */
export async function exportHtmlToWord(html: string, fileName: string): Promise<void> {
  const srcs = [...new Set([...html.matchAll(/<img[^>]+src="([^"]+)"/g)].map((m) => m[1]!))];
  const images: EmbeddedImage[] = [];
  let out = html;
  for (let i = 0; i < srcs.length; i++) {
    const raw = srcs[i]!.replace(/&amp;/g, "&");
    const img = await embed(raw, `image${i + 1}`);
    if (!img) continue;
    images.push(img);
    out = out.split(`src="${srcs[i]}"`).join(`src="${img.location}"`);
  }
  // Word reads the page's own size and margins from an @page Section1 rule.
  out = out.replace(
    "</head>",
    `<style>@page Section1{size:595.3pt 841.9pt;margin:36pt}div.Section1{page:Section1}</style></head>`,
  );
  out = out.replace(/<body([^>]*)>/, '<body$1><div class="Section1">').replace("</body>", "</div></body>");
  const B = "----=_NextPart_eKulmis_doc";
  const parts = [
    `MIME-Version: 1.0\r\nContent-Type: multipart/related; boundary="${B}"; type="text/html"\r\n\r\n`,
    `--${B}\r\nContent-Type: text/html; charset="utf-8"\r\nContent-Transfer-Encoding: base64\r\nContent-Location: file:///C:/ekulmis/document.htm\r\n\r\n${wrap76(utf8Base64(out))}\r\n\r\n`,
    ...images.map(
      (img) =>
        `--${B}\r\nContent-Type: ${img.mime}\r\nContent-Transfer-Encoding: base64\r\nContent-Location: ${img.location}\r\n\r\n${wrap76(img.base64)}\r\n\r\n`,
    ),
    `--${B}--\r\n`,
  ];
  save(new Blob(parts, { type: "application/msword" }), fileName.endsWith(".doc") ? fileName : `${fileName}.doc`);
}
