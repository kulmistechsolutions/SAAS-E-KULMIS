"use client";

import { PAGE_A4, paginate, type ResolvedGrid } from "./layout";
import { CARD_CSS, darken } from "./templates";
import type { CardContext, CardTemplate } from "./types";

/**
 * Markup for one card, sized to its physical footprint.
 *
 * Orientation is read off the geometry rather than passed separately, so the
 * shape that is actually being printed is always the shape the template lays
 * itself out for — the two can never disagree.
 */
export function renderCard(
  ctx: CardContext,
  template: CardTemplate,
  grid: ResolvedGrid,
  opts: { border: boolean; cutLines: boolean },
): string {
  const classes = ["idc"];
  if (opts.border) classes.push("idc-bordered");
  if (opts.cutLines) classes.push("idc-cut");
  const style = [
    `width:${grid.cardWidth}mm`,
    `height:${grid.cardHeight}mm`,
    `--idc-accent:${ctx.accent}`,
    `--idc-accent-dark:${darken(ctx.accent)}`,
  ].join(";");
  const orientation = grid.cardWidth < grid.cardHeight ? "PORTRAIT" : "LANDSCAPE";
  return `<div class="${classes.join(" ")}" style="${style}">${template.render(ctx, orientation)}</div>`;
}

/**
 * Page and grid CSS.
 *
 * `break-inside: avoid` on the card plus a fixed-height sheet is what keeps a
 * card whole: the browser is never asked to flow cards across a page boundary,
 * because each page is an explicitly sized box holding exactly the cards that
 * fit inside it (PRD §16).
 */
export function sheetCss(grid: ResolvedGrid, cutLines: boolean): string {
  return `
${CARD_CSS}
.idc-bordered { border: 0.3mm solid rgba(15,23,42,.18); border-radius: 1.6mm; }
.idc-cut { outline: 0.2mm dashed #cbd5e1; outline-offset: ${Math.max(0.6, grid.gap / 2)}mm; }
.idc-sheet {
  width: ${PAGE_A4.width}mm;
  height: ${PAGE_A4.height}mm;
  padding: ${grid.margin}mm;
  background: #fff;
  display: grid;
  grid-template-columns: repeat(${grid.cols}, ${grid.cardWidth}mm);
  grid-auto-rows: ${grid.cardHeight}mm;
  gap: ${grid.gap}mm;
  justify-content: center;
  align-content: start;
  overflow: hidden;
  box-sizing: border-box;
}
.idc, .idc-sheet > * { break-inside: avoid; page-break-inside: avoid; }
`;
}

export function renderSheets(
  contexts: CardContext[],
  template: CardTemplate,
  grid: ResolvedGrid,
  opts: { border: boolean; cutLines: boolean },
): string {
  return paginate(contexts, grid.perPage)
    .map(
      (page) =>
        `<section class="idc-sheet">${page
          .map((c) => renderCard(c, template, grid, opts))
          .join("")}</section>`,
    )
    .join("");
}

export function pageCount(total: number, perPage: number): number {
  return perPage > 0 ? Math.ceil(total / perPage) : 0;
}

/**
 * Build the standalone print document.
 *
 * `@page { margin: 0 }` hands margin control to the sheet itself — otherwise the
 * browser adds its own and the carefully computed card grid shifts, which shows
 * up as cards creeping off the bottom of the page after a few rows.
 */
function printDocument(
  title: string,
  body: string,
  grid: ResolvedGrid,
  cutLines: boolean,
  autoPrint: boolean,
): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${title}</title><style>
  @page { size: A4 portrait; margin: 0; }
  html, body { margin: 0; padding: 0; background: #f1f5f9; }
  .idc-sheet { margin: 0 auto 8mm; box-shadow: 0 2px 12px rgba(15,23,42,.15); }
  ${sheetCss(grid, cutLines)}
  @media print {
    html, body { background: #fff; }
    .idc-sheet { margin: 0; box-shadow: none; page-break-after: always; break-after: page; }
    .idc-sheet:last-child { page-break-after: auto; break-after: auto; }
  }
  </style></head><body>${body}
  ${
    autoPrint
      ? `<script>
  window.addEventListener('load', function () {
    var imgs = Array.prototype.slice.call(document.images);
    Promise.all(imgs.map(function (img) {
      return img.complete ? Promise.resolve() : new Promise(function (res) { img.onload = img.onerror = res; });
    })).then(function () { setTimeout(function () { window.print(); }, 150); });
  });
  </script>`
      : ""
  }
  </body></html>`;
}

export interface PrintRequest {
  contexts: CardContext[];
  template: CardTemplate;
  grid: ResolvedGrid;
  border: boolean;
  cutLines: boolean;
  title?: string;
}

function openDocument(html: string): boolean {
  const w = window.open("", "_blank", "width=980,height=760");
  if (!w) return false;
  w.document.write(html);
  w.document.close();
  return true;
}

/** Open the print dialog on a freshly built sheet set. */
export function printCards(req: PrintRequest): boolean {
  const body = renderSheets(req.contexts, req.template, req.grid, {
    border: req.border,
    cutLines: req.cutLines,
  });
  return openDocument(
    printDocument(req.title ?? "ID Cards", body, req.grid, req.cutLines, true),
  );
}

/**
 * PDF export goes through the browser's own print pipeline ("Save as PDF").
 *
 * That keeps the output vector — real text, real fonts, exact millimetre
 * geometry — which a canvas-rasterising client-side PDF library cannot match,
 * and it means the PDF is byte-for-byte the same layout that Print produces
 * rather than a second implementation that can drift from it.
 */
export function downloadCardsPdf(req: PrintRequest): boolean {
  return printCards({ ...req, title: req.title ?? "ID Cards — PDF" });
}

/** Open the sheets WITHOUT auto-printing, for a full-page visual check. */
export function openFullPreview(req: PrintRequest): boolean {
  const body = renderSheets(req.contexts, req.template, req.grid, {
    border: req.border,
    cutLines: req.cutLines,
  });
  return openDocument(
    printDocument(req.title ?? "ID Cards — Preview", body, req.grid, req.cutLines, false),
  );
}
