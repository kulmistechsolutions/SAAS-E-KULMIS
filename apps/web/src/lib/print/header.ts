"use client";

import { schoolBranding } from "@/lib/settings/store";

/**
 * One shared, polished letterhead for every printed document / PDF the app
 * generates — logo (or a colour-matched initials badge when there is no
 * logo), school name, motto, and an optional document subtitle, all in the
 * school's own primary colour rather than a hardcoded brand colour that
 * fights whatever the school actually picked in Settings → Branding.
 */

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Paste this once into a print document's <style>. */
export const PRINT_HEADER_CSS = `
    .ek-head { display:flex; align-items:center; gap:16px; padding-bottom:18px; margin-bottom:22px; border-bottom:3px solid var(--ek-accent, #4f46e5); }
    .ek-head.centered { flex-direction:column; text-align:center; }
    .ek-head .ek-side { margin-inline-start:auto; text-align:end; }
    .ek-head.centered .ek-side { margin-inline-start:0; text-align:center; margin-top:8px; }
    .ek-logo { width:60px; height:60px; border-radius:14px; object-fit:contain; background:#fff; padding:4px; box-shadow:0 2px 8px rgba(15,23,42,.12); border:1px solid rgba(15,23,42,.08); flex-shrink:0; }
    .ek-logo-fallback { width:60px; height:60px; border-radius:14px; display:flex; align-items:center; justify-content:center; color:#fff; font-weight:700; font-size:22px; letter-spacing:.5px; box-shadow:0 2px 8px rgba(15,23,42,.12); flex-shrink:0; background:var(--ek-accent, #4f46e5); }
    .ek-head h1 { margin:0; font-size:21px; font-weight:700; letter-spacing:-.01em; color:#0f172a; }
    .ek-head .ek-tagline { color:#64748b; font-size:12.5px; margin-top:3px; }
    .ek-head .ek-subtitle { color:#475569; font-size:12.5px; margin-top:2px; font-weight:600; }
`;

/**
 * The `<div class="ek-head">…</div>` block every printed document opens
 * with. `subtitle` is the one line specific to that document, e.g. "Parent
 * List" or "Payslip — August 2026". `sideHtml` is optional content pinned to
 * the far end of the row — a receipt number, a status badge — already raw
 * HTML, so the caller escapes/marks it up itself.
 */
export function printHeaderHtml(subtitle?: string, sideHtml?: string): string {
  const school = schoolBranding();
  const accent = school.primaryColor || "#4f46e5";
  const initials = school.name.trim().slice(0, 2).toUpperCase() || "S";
  const logo = school.logoUrl
    ? `<img src="${school.logoUrl}" alt="" class="ek-logo" />`
    : `<div class="ek-logo-fallback">${escapeHtml(initials)}</div>`;
  const centered = school.headerLayout === "CENTERED";
  return `<div class="ek-head${centered ? " centered" : ""}" style="--ek-accent:${accent}">
    ${logo}
    <div>
      <h1>${escapeHtml(school.name)}</h1>
      ${school.tagline ? `<div class="ek-tagline">${escapeHtml(school.tagline)}</div>` : ""}
      ${subtitle ? `<div class="ek-subtitle">${escapeHtml(subtitle)}</div>` : ""}
    </div>
    ${sideHtml ? `<div class="ek-side">${sideHtml}</div>` : ""}
  </div>`;
}
