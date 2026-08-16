"use client";

/**
 * Card chrome and colour helpers.
 *
 * The card's *content* is no longer defined here — it is a list of positioned
 * elements (see elements.ts / presets.ts) so the designer can move, resize and
 * retype anything on it. All that remains is the frame every card sits in and
 * the accent-colour maths the elements refer to.
 */

export function escapeHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * `print-color-adjust: exact` is required: without it browsers drop background
 * fills when printing and every card comes out plain white.
 */
export const CARD_CSS = `
.idc {
  position: relative;
  overflow: hidden;
  background: #fff;
  color: #0f172a;
  font-family: Arial, Helvetica, sans-serif;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.idc * { box-sizing: border-box; }
.idc img { display: block; }
`;

/** Darken a hex colour for the gradient/footer end of the accent pair. */
export function darken(hex: string, amount = 0.22): string {
  const m = /^#?([a-f\d]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) =>
    Math.max(0, Math.round(v * (1 - amount))),
  );
  return `#${ch.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}
