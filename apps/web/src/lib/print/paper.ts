"use client";

/**
 * Paper size for anything the fee desk prints.
 *
 * Every print window was handed to the browser with no `@page` rule at all, so
 * it used whatever the machine defaulted to — usually A4. A school printing
 * receipts on A5, or on the 80mm roll printer sitting on the desk, got a page
 * laid out for paper it was not using: one receipt per A4 sheet, or a receipt
 * wider than the roll with the amount cut off the right edge.
 *
 * The size is remembered per browser, because a desk prints on the same
 * printer every day and should not have to say so every time.
 */

export type PaperSize = "A4" | "A5" | "LETTER" | "ROLL80";

export interface PaperSpec {
  id: PaperSize;
  /** Shown in the picker. */
  labelKey: string;
  /** The `size` value for the `@page` rule. */
  page: string;
  /** Page margin. A roll printer has almost none to give. */
  margin: string;
  /** Content width. `auto` lets a roll use the full width it has. */
  maxWidth: string;
  /** Base font size — A5 and a roll need smaller type to hold the same table. */
  fontSize: string;
  /** Padding inside the body on screen (print uses the page margin). */
  padding: string;
}

export const PAPER_SIZES: Record<PaperSize, PaperSpec> = {
  A4: {
    id: "A4",
    labelKey: "printPaper.a4",
    page: "A4 portrait",
    margin: "14mm",
    maxWidth: "720px",
    fontSize: "14px",
    padding: "40px",
  },
  A5: {
    id: "A5",
    labelKey: "printPaper.a5",
    page: "A5 portrait",
    margin: "8mm",
    maxWidth: "480px",
    fontSize: "12px",
    padding: "20px",
  },
  LETTER: {
    id: "LETTER",
    labelKey: "printPaper.letter",
    page: "Letter portrait",
    margin: "14mm",
    maxWidth: "720px",
    fontSize: "14px",
    padding: "40px",
  },
  ROLL80: {
    id: "ROLL80",
    labelKey: "printPaper.roll80",
    // A till roll is continuous: fixed width, and as long as it needs to be.
    page: "80mm auto",
    margin: "3mm",
    maxWidth: "none",
    fontSize: "11px",
    padding: "6px",
  },
};

export const PAPER_ORDER: PaperSize[] = ["A4", "A5", "LETTER", "ROLL80"];

const KEY = "ekulmis.print.paper";

export function getStoredPaper(): PaperSize {
  if (typeof window === "undefined") return "A4";
  try {
    const v = window.localStorage.getItem(KEY);
    return v && v in PAPER_SIZES ? (v as PaperSize) : "A4";
  } catch {
    // Private windows and blocked site data both throw here. A default is
    // better than a broken print button.
    return "A4";
  }
}

export function setStoredPaper(size: PaperSize) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, size);
  } catch {
    /* not worth failing a print over */
  }
}

/**
 * The CSS a print document needs for one paper size, including the rules that
 * let it run past a single page.
 *
 * A receipt for a family settling six months of arrears is taller than one
 * page and always was; without these rules the table header vanished after the
 * first page and rows were sliced through the middle at the fold.
 */
export function paperCss(size: PaperSize): string {
  const p = PAPER_SIZES[size] ?? PAPER_SIZES.A4;
  const roll = p.id === "ROLL80";
  return `
  @page{size:${p.page};margin:${p.margin}}
  html{font-size:${p.fontSize}}
  body{max-width:${p.maxWidth};padding:${p.padding};margin:0 auto}
  ${roll ? "body{width:100%}.who{grid-template-columns:1fr!important;gap:8px!important}" : ""}

  /* Multi-page behaviour. A long receipt keeps its column headings on every
     sheet and never splits a line down the middle of a page break. */
  thead{display:table-header-group}
  tfoot{display:table-row-group}
  tr,dl,.amount,.foot{break-inside:avoid;page-break-inside:avoid}
  table{break-inside:auto}
  /* A rounded, clipped box loses its bottom edge at a page break, so the
     rounding comes off once the content is long enough to run over. */
  table.lines{overflow:visible}

  @media print{
    body{padding:0;max-width:none;width:auto}
    .no-print{display:none!important}
  }`;
}
