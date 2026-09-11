/**
 * The shell every printed document in the Document Center shares.
 *
 * Pulled out of the student document when the staff documents arrived, because
 * two copies of a page's spacing rules is how one of them slowly stops matching
 * the other — and the whole point of one engine is that a school's paperwork
 * looks like one school's paperwork.
 */

/** The four designs, which change the look and never the facts. */
export type DocDesign = "MODERN" | "SIMPLE" | "ELEGANT" | "MINIMAL";

export const DESIGNS: { id: DocDesign; label: string; note: string }[] = [
  { id: "MODERN", label: "Official Letter (Modern)", note: "Coloured section bands" },
  { id: "SIMPLE", label: "Simple Letter", note: "Grey headings, plain rules" },
  { id: "ELEGANT", label: "Elegant Letter", note: "Rules only, wide letter-spacing" },
  { id: "MINIMAL", label: "Minimal Letter", note: "No boxes, no photo" },
];

/** Per-design tuning. Only spacing, weight and rule colour differ. */
export const DESIGN_CSS: Record<DocDesign, string> = {
  MODERN: `
    .sec-head{background:var(--ek-accent);color:#fff}
    .kv td.k{width:38%}
    .card{border:1px solid #e2e8f0;border-radius:10px;overflow:hidden}`,
  SIMPLE: `
    .sec-head{background:#f1f5f9;color:#0f172a;border-bottom:1px solid #e2e8f0}
    .card{border:1px solid #e2e8f0;border-radius:6px;overflow:hidden}`,
  ELEGANT: `
    .sec-head{background:transparent;color:var(--ek-accent);
      border-bottom:2px solid var(--ek-accent);letter-spacing:.12em}
    .card{border:none;border-top:1px solid #e2e8f0}
    .kv td{border-bottom:1px dotted #e2e8f0}`,
  MINIMAL: `
    .sec-head{background:transparent;color:#475569;border-bottom:1px solid #e2e8f0;
      font-size:10px;letter-spacing:.14em}
    .card{border:none}
    .kv td{border-bottom:none;padding:4px 0}
    .photo{border-radius:4px}`,
};

/**
 * Page furniture: the reset, the tables, the photo, the signature band.
 *
 * Sized so one person fits one sheet. The spacing here is chosen to leave room
 * for the signature band at the foot rather than push it onto a second page,
 * which is the single most common way an official document goes out looking
 * wrong.
 */
export const DOC_SHELL_CSS = `
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#0f172a;
    -webkit-print-color-adjust:exact;print-color-adjust:exact}

  .card{margin-top:12px;page-break-inside:avoid}
  .sec-head{padding:6px 12px;font-size:11px;font-weight:800;
    text-transform:uppercase;letter-spacing:.06em}
  table.kv{width:100%;border-collapse:collapse}
  table.kv td{padding:6px 12px;font-size:12px;border-bottom:1px solid #f1f5f9;
    vertical-align:top}
  table.kv td.k{color:#64748b;width:34%}
  table.kv td.v{font-weight:600}
  table.kv tr:last-child td{border-bottom:none}
  /* A listing is a real table: every column the same width rules, headers
     included, so children or subjects line up instead of drifting. */
  table.kv.listing td.k{width:auto;font-size:10px;text-transform:uppercase;
    letter-spacing:.05em}
  table.kv.listing td{border-bottom:1px solid #f1f5f9}

  .with-photo{display:flex;gap:14px;align-items:flex-start;margin-top:12px}
  .with-photo .beside{flex:1;min-width:0}
  .with-photo .beside .card{margin-top:0}
  .photo{width:104px;height:128px;object-fit:cover;border:1px solid #e2e8f0;
    border-radius:8px;background:#f8fafc}

  .lead{margin-top:16px;font-size:13px;line-height:1.9;text-align:justify}

  .foot-band{margin-top:auto;padding-top:18px;display:flex;align-items:flex-end;
    justify-content:space-between;gap:16px}
  .qr{text-align:center}
  .qr img{width:64px;height:64px;display:block}
  .qr-cap{margin-top:3px;font-size:8.5px;color:#64748b;font-family:ui-monospace,monospace}

  @media print{ .doc-watermark{position:absolute} }
`;
