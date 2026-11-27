"use client";

import { schoolBranding } from "@/lib/settings/store";

function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Any printed letter or information sheet, rebuilt for Microsoft Word.
 *
 * The printed pages are laid out with CSS Word cannot follow (flexbox,
 * grid, positioned stamps), so a Word copy of the print came out
 * rearranged. This reads the document's content — its paragraphs, its
 * sections and their label/value rows — and lays the same content out with
 * tables and inline styles, which Word keeps exactly: letterhead, title,
 * reference and date, the text, the sections, and the signature line.
 */
export function wordFromPrintHtml(
  printHtml: string,
  opts: { title: string; reference?: string; signatures?: string[]; accent?: string },
): string {
  const b = schoolBranding();
  const accent = opts.accent || b.primaryColor || "#4f46e5";
  const doc = new DOMParser().parseFromString(printHtml, "text/html");

  const paragraphs = [...doc.querySelectorAll("p.lead")]
    .map((p) => `<p style="margin:0 0 10pt;font-size:12pt;line-height:150%;text-align:justify">${p.innerHTML}</p>`)
    .join("");

  const sections = [...doc.querySelectorAll(".card")]
    .map((card) => {
      const heading = card.querySelector(".sec-head")?.textContent?.trim() ?? "";
      const tables = [...card.querySelectorAll("table")];
      const rows = tables
        .flatMap((t) => [...t.querySelectorAll("tr")])
        .map((tr, i) => {
          const cells = [...tr.querySelectorAll("th,td")];
          const bg = i % 2 ? "#f8fafc" : "#ffffff";
          if (cells.length === 2 && cells[0]!.classList.contains("k")) {
            return `<tr style="background:${bg}"><td width="35%" style="padding:5pt 8pt;border:0.75pt solid #e2e8f0;color:#475569;font-weight:bold">${esc(cells[0]!.textContent?.trim())}</td><td style="padding:5pt 8pt;border:0.75pt solid #e2e8f0">${esc(cells[1]!.textContent?.trim())}</td></tr>`;
          }
          // A data table (a parent's children, say): keep every column.
          const isHead = cells.every((c) => c.tagName === "TH");
          return `<tr style="background:${isHead ? accent : bg}">${cells
            .map(
              (c) =>
                `<td style="padding:4pt 6pt;border:0.75pt solid ${isHead ? accent : "#e2e8f0"};${isHead ? "color:#fff;font-weight:bold" : ""}">${esc(c.textContent?.trim())}</td>`,
            )
            .join("")}</tr>`;
        })
        .join("");
      if (!rows) return "";
      return `<p style="margin:12pt 0 4pt;font-size:11pt;font-weight:bold;color:${accent};text-transform:uppercase;letter-spacing:1pt">${esc(heading)}</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:10.5pt">${rows}</table>`;
    })
    .join("");

  const contacts = [
    [b.address, b.city, b.country].filter(Boolean).join(", "),
    [b.phone ? `Tel: ${b.phone}` : "", b.email ?? "", b.website ?? ""].filter(Boolean).join("  |  "),
  ].filter(Boolean);
  const letterhead = b.headerImage
    ? `<p align="center" style="margin:0"><img src="${esc(b.headerImage.url)}" width="680" /></p>`
    : `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tr>
        ${b.logoUrl ? `<td width="90" valign="middle"><img src="${esc(b.logoUrl)}" width="76" height="76" /></td>` : ""}
        <td valign="middle" style="${b.logoUrl ? "" : "text-align:center;"}">
          <p style="margin:0;font-size:20pt;font-weight:bold;color:#0f172a">${esc(b.name)}</p>
          ${b.tagline ? `<p style="margin:2pt 0 0;font-size:10pt;color:#64748b">${esc(b.tagline)}</p>` : ""}
          ${contacts.map((c) => `<p style="margin:2pt 0 0;font-size:9pt;color:#475569">${esc(c)}</p>`).join("")}
        </td>
      </tr></table>`;

  const sig = (label: string) =>
    `<td width="33%" align="center" valign="bottom" style="padding-top:42pt">
       <p style="margin:0;border-top:0.75pt solid #0f172a;width:150pt">&nbsp;</p>
       <p style="margin:2pt 0 0;font-size:10pt;font-weight:bold">${esc(label)}</p>
     </td>`;
  const sigs = opts.signatures ?? ["Administrator", "School Stamp", "Principal"];
  const today = new Date().toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${esc(opts.title)}</title>
<style>body{font-family:Calibri,Arial,sans-serif;color:#0f172a;font-size:11pt}</style></head>
<body>
  ${letterhead}
  <p style="margin:6pt 0 0;border-bottom:2.25pt solid ${accent};font-size:2pt">&nbsp;</p>
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:10pt"><tr>
    <td style="font-size:10pt;color:#475569">${opts.reference ? `Ref. No.: <b>${esc(opts.reference)}</b>` : "&nbsp;"}</td>
    <td align="right" style="font-size:10pt;color:#475569">Date: <b>${esc(today)}</b></td>
  </tr></table>
  <p align="center" style="margin:16pt 0 14pt;font-size:17pt;font-weight:bold;letter-spacing:2pt;text-transform:uppercase;color:${accent}">${esc(opts.title)}</p>
  ${paragraphs}
  ${sections}
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:28pt"><tr>${sigs.map(sig).join("")}</tr></table>
</body></html>`;
}
