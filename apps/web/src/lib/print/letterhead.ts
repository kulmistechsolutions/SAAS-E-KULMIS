"use client";

import { schoolBranding } from "@/lib/settings/store";
import { escapeHtml } from "./header";

/**
 * The full school letterhead — the one on official paper, not the compact one.
 *
 * Every field here has been collected in School Settings and sent by the API
 * since those pages were built; nothing but this file had ever asked for the
 * address, the phone number, the email or the principal's name, so a school
 * that filled them in saw them nowhere on its own documents. This adds no
 * data and changes none: it reads what is already there and lays it out.
 *
 * Two things a printed school document needs that a screen does not: a
 * watermark that sits behind the content rather than over it, and a stamp area
 * the school signs by hand. Neither carries information — they are the marks
 * that make a page official — so both are drawn, never filled from data.
 */

export interface LetterheadOptions {
  /** "PAYMENT RECEIPT", "FEE INVOICE" — the band under the letterhead. */
  title: string;
  /** The same title in the school's second language, shown beneath. */
  subtitle?: string;
  /** "Receipt No." and its value, boxed at the end of the title band. */
  refLabel?: string;
  refValue?: string;
}

/** Paste once into a document's `<style>`. Self-contained; no other CSS needed. */
export const LETTERHEAD_CSS = `
  .doc { position:relative; }

  /* The watermark sits under everything and must never be readable over text:
     it is a mark of provenance, not content. */
  .doc-watermark { position:fixed; inset:0; display:flex; align-items:center;
    justify-content:center; z-index:0; pointer-events:none; }
  .doc-watermark img { width:52%; max-width:340px; opacity:.05; }
  .doc-watermark .wm-text { font-size:64px; font-weight:800; color:var(--ek-accent,#1e40af);
    opacity:.05; transform:rotate(-24deg); letter-spacing:.06em; text-align:center; }
  .doc > *:not(.doc-watermark) { position:relative; z-index:1; }

  .lh { border:1px solid #cbd5e1; border-radius:10px; overflow:hidden; }
  .lh-top { display:flex; align-items:center; gap:16px; padding:14px 18px; background:#fff; }
  .lh-logo { width:74px; height:74px; object-fit:contain; flex-shrink:0; }
  .lh-logo-fallback { width:74px; height:74px; border-radius:50%; display:flex;
    align-items:center; justify-content:center; color:#fff; font-weight:800; font-size:24px;
    background:var(--ek-accent,#1e40af); flex-shrink:0; }
  .lh-id { flex:1; text-align:center; }
  .lh-id h1 { margin:0; font-size:27px; font-weight:800; letter-spacing:-.01em;
    color:var(--ek-accent,#1e40af); line-height:1.1; }
  .lh-id .lh-kind { font-size:12.5px; font-weight:600; color:#334155; margin-top:2px;
    letter-spacing:.02em; }
  .lh-id .lh-motto { margin-top:5px; font-size:11px; font-weight:700; color:var(--ek-accent,#1e40af);
    letter-spacing:.08em; text-transform:uppercase; }
  .lh-quote { width:118px; flex-shrink:0; font-size:10.5px; font-style:italic; color:#475569;
    text-align:center; line-height:1.45; }

  /* The contact strip. Only the parts a school has actually filled in appear —
     an empty run of separators looks like a fault in the document. */
  .lh-contact { display:flex; flex-wrap:wrap; justify-content:center; gap:6px 20px;
    padding:7px 18px; border-top:1px solid #e2e8f0; background:#f8fafc;
    font-size:10.5px; color:#475569; }
  .lh-contact span { white-space:nowrap; }

  .doc-title { display:flex; align-items:stretch; margin-top:14px; gap:10px; }
  .doc-title .dt-main { flex:1; background:var(--ek-accent,#1e40af); color:#fff;
    padding:11px 18px; border-radius:8px; }
  .doc-title .dt-main h2 { margin:0; font-size:20px; font-weight:800; letter-spacing:.03em; }
  .doc-title .dt-main .dt-sub { font-size:10.5px; opacity:.85; margin-top:2px; letter-spacing:.02em; }
  .doc-title .dt-ref { min-width:150px; border:1px solid #cbd5e1; border-radius:8px;
    padding:8px 14px; text-align:center; display:flex; flex-direction:column;
    justify-content:center; background:#fff; }
  .doc-title .dt-ref .dt-ref-label { font-size:9.5px; color:#64748b; text-transform:uppercase;
    letter-spacing:.06em; }
  .doc-title .dt-ref .dt-ref-value { font-size:16px; font-weight:800; color:#dc2626;
    font-variant-numeric:tabular-nums; margin-top:1px; }

  .sec { margin-top:14px; border:1px solid #e2e8f0; border-radius:8px; overflow:hidden; }
  .sec-head { background:#eff6ff; color:#1e3a8a; font-size:10.5px; font-weight:700;
    letter-spacing:.06em; text-transform:uppercase; padding:7px 14px;
    border-bottom:1px solid #dbeafe; }

  .kv { width:100%; border-collapse:collapse; }
  .kv td { padding:6px 14px; font-size:12px; vertical-align:top; }
  .kv td.k { width:31%; color:#64748b; }
  .kv td.v { font-weight:600; color:#0f172a; }

  .grid2 { display:flex; gap:14px; }
  .grid2 > * { flex:1; min-width:0; }

  /* Signatures. A ruled line and a role — the school writes the rest. */
  .signs { display:flex; align-items:flex-end; justify-content:space-between;
    gap:20px; margin-top:26px; }
  .sign { text-align:center; min-width:150px; }
  .sign .rule { border-bottom:1px solid #94a3b8; height:30px; }
  .sign .role { font-size:10.5px; font-weight:700; color:#334155; margin-top:5px; }
  .sign .who { font-size:10px; color:#64748b; }
  .stamp { width:104px; height:104px; border:2px dashed #94a3b8; border-radius:50%;
    display:flex; flex-direction:column; align-items:center; justify-content:center;
    text-align:center; color:#94a3b8; font-size:8.5px; font-weight:700;
    letter-spacing:.05em; line-height:1.35; flex-shrink:0; }

  .doc-foot { margin-top:22px; padding:9px 18px; border-radius:8px;
    background:var(--ek-accent,#1e40af); color:#fff; display:flex;
    justify-content:space-between; align-items:center; gap:16px; font-size:10.5px; }
  .doc-foot .ff-motto { font-style:italic; }
`;

/** The school's chosen colour, or a document-blue that reads as official. */
export function accentColour(): string {
  return schoolBranding().primaryColor || "#1e40af";
}

/**
 * The watermark layer. Drawn from the logo when there is one, from the school's
 * initials when there is not — never from a field a reader might mistake for
 * content.
 */
export function watermarkHtml(): string {
  const school = schoolBranding();
  if (school.logoUrl) {
    return `<div class="doc-watermark"><img src="${school.logoUrl}" alt="" /></div>`;
  }
  const initials = school.name.trim().slice(0, 3).toUpperCase() || "SCHOOL";
  return `<div class="doc-watermark"><div class="wm-text">${escapeHtml(initials)}</div></div>`;
}

/** The letterhead block: logo, name, motto, contact strip, and the title band. */
export function letterheadHtml(opts: LetterheadOptions): string {
  const s = schoolBranding();
  const logo = s.logoUrl
    ? `<img src="${s.logoUrl}" alt="" class="lh-logo" />`
    : `<div class="lh-logo-fallback">${escapeHtml(
        s.name.trim().slice(0, 2).toUpperCase() || "S",
      )}</div>`;

  // Only what the school has filled in. A row of empty separators reads as a
  // broken document rather than an incomplete profile.
  const place = [s.address, s.city, s.country].filter(Boolean).join(", ");
  const contact = [s.phone, s.email, s.website, place]
    .filter((v): v is string => !!v && v.trim() !== "")
    .map((v) => `<span>${escapeHtml(v)}</span>`)
    .join("");

  return `<div class="lh">
    <div class="lh-top">
      ${logo}
      <div class="lh-id">
        <h1>${escapeHtml(s.name.trim())}</h1>
        ${s.tagline ? `<div class="lh-motto">${escapeHtml(s.tagline)}</div>` : ""}
      </div>
      <!-- The reference design carries a slogan under the name and a separate
           quotation to the side. There is one motto field, so printing it in
           both places just says the same thing twice; the space is kept so the
           name stays centred. -->
      <div class="lh-quote"></div>
    </div>
    ${contact ? `<div class="lh-contact">${contact}</div>` : ""}
  </div>
  <div class="doc-title">
    <div class="dt-main">
      <h2>${escapeHtml(opts.title)}</h2>
      ${opts.subtitle ? `<div class="dt-sub">${escapeHtml(opts.subtitle)}</div>` : ""}
    </div>
    ${
      opts.refValue
        ? `<div class="dt-ref">
             <div class="dt-ref-label">${escapeHtml(opts.refLabel ?? "")}</div>
             <div class="dt-ref-value">${escapeHtml(opts.refValue)}</div>
           </div>`
        : ""
    }
  </div>`;
}

/** A ruled signature block. `who` is the person's name when the school has one. */
export function signatureHtml(role: string, who?: string | null): string {
  return `<div class="sign">
    <div class="rule"></div>
    <div class="role">${escapeHtml(role)}</div>
    ${who ? `<div class="who">${escapeHtml(who)}</div>` : ""}
  </div>`;
}

/** The dashed circle a school stamps by hand. Carries no data by design. */
export function stampHtml(line1: string, line2: string): string {
  return `<div class="stamp"><span>${escapeHtml(line1)}</span><span>${escapeHtml(
    line2,
  )}</span></div>`;
}

/** The coloured band that closes an official page. */
export function documentFooterHtml(note?: string): string {
  const s = schoolBranding();
  const right = s.website || s.email || "";
  return `<div class="doc-foot">
    <span class="ff-motto">${escapeHtml(note || s.tagline || s.name.trim())}</span>
    ${right ? `<span>${escapeHtml(right)}</span>` : ""}
  </div>`;
}
