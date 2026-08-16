"use client";

import type { CardContext, CardTemplate } from "./types";

export function escapeHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * One stylesheet, used by BOTH the on-screen preview and the print window, so
 * what the admin approves is exactly what comes out of the printer. Everything
 * is in mm/pt because a card is a physical object — px would drift with the
 * browser's print DPI.
 *
 * All colours are painted with `print-color-adjust: exact`; without it browsers
 * drop background fills when printing and every card comes out plain white.
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
  display: flex;
  flex-direction: column;
}
.idc * { box-sizing: border-box; }
.idc-head {
  background: linear-gradient(135deg, var(--idc-accent), var(--idc-accent-dark));
  color: #fff;
  padding: 2mm 2.5mm;
  display: flex;
  align-items: center;
  gap: 1.8mm;
}
.idc-head-c { flex-direction: column; text-align: center; gap: 0.8mm; padding: 2.2mm 2mm; }
.idc-logo { width: 7mm; height: 7mm; border-radius: 1.2mm; object-fit: contain; background: #fff; padding: 0.4mm; flex: 0 0 auto; }
.idc-logo-ph { width: 7mm; height: 7mm; border-radius: 1.2mm; background: rgba(255,255,255,.25); display: flex; align-items: center; justify-content: center; font-size: 5pt; font-weight: 700; flex: 0 0 auto; }
.idc-school { font-size: 6.5pt; font-weight: 700; line-height: 1.1; letter-spacing: .01em; }
.idc-motto { font-size: 4.4pt; opacity: .9; line-height: 1.15; margin-top: .3mm; }
.idc-title { font-size: 5.6pt; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
/* Solid accent, not a translucent overlay: the title bar is a sibling of the
   gradient header and sits on the white card body, so rgba() black rendered as
   pale grey and the white text on it was effectively unreadable. */
.idc-titlebar { background: var(--idc-accent-dark); color: #fff; text-align: center; padding: 1mm; font-size: 5.6pt; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
.idc-body { flex: 1; padding: 2mm 2.5mm; display: flex; flex-direction: column; min-height: 0; }
.idc-photo { border-radius: 1.2mm; object-fit: cover; border: 0.4mm solid var(--idc-accent); background: #f1f5f9; display: block; }
.idc-photo-ph {
  border-radius: 1.2mm; border: 0.4mm dashed #cbd5e1; background: #f8fafc; color: #94a3b8;
  display: flex; align-items: center; justify-content: center; font-size: 4.5pt; text-align: center; line-height: 1.2;
}
.idc-name { font-size: 8pt; font-weight: 700; color: var(--idc-accent-dark); line-height: 1.15; }
.idc-name-sm { font-size: 7pt; }
.idc-lbl { font-size: 4.2pt; letter-spacing: .1em; text-transform: uppercase; color: #64748b; }
.idc-pill {
  background: var(--idc-accent); color: #fff; border-radius: 1mm; padding: 1mm 2mm;
  font-size: 7.5pt; font-weight: 700; font-family: "Courier New", monospace; letter-spacing: .04em;
  display: inline-block; white-space: nowrap;
}
.idc-pill-o { background: #fff; color: var(--idc-accent-dark); border: 0.4mm solid var(--idc-accent); }
.idc-rows { width: 100%; border-collapse: collapse; font-size: 5.4pt; }
.idc-rows td { padding: .5mm 0; vertical-align: top; }
.idc-rows .k { color: #64748b; width: 42%; }
.idc-rows .v { font-weight: 700; text-align: right; }
.idc-qr { width: 11mm; height: 11mm; display: block; }
.idc-qr-sm { width: 9mm; height: 9mm; }
.idc-sig { text-align: center; }
.idc-sig-line { border-top: 0.3mm solid #94a3b8; width: 18mm; margin: 0 auto .4mm; }
.idc-sig-txt { font-size: 4pt; color: #64748b; }
.idc-foot {
  background: var(--idc-accent-dark); color: #fff; text-align: center;
  padding: .9mm; font-size: 4.4pt; letter-spacing: .02em;
}
.idc-foot-l { background: #f1f5f9; color: #475569; }
.idc-strip { height: 1.4mm; background: var(--idc-accent); }
.idc-badge {
  display: inline-block; border-radius: 5mm; padding: .7mm 2mm;
  font-size: 5.2pt; font-weight: 700; letter-spacing: .06em; text-transform: uppercase;
}
.idc-row { display: flex; gap: 2mm; }
.idc-between { display: flex; align-items: flex-end; justify-content: space-between; }
.idc-mt { margin-top: auto; }
`;

// ── Shared building blocks ────────────────────────────────────────────────

function logo(c: CardContext): string {
  return c.logoDataUrl
    ? `<img class="idc-logo" src="${c.logoDataUrl}" alt=""/>`
    : `<div class="idc-logo-ph">${escapeHtml(c.schoolName.slice(0, 2).toUpperCase())}</div>`;
}

function header(c: CardContext, centered: boolean): string {
  return `<div class="idc-head${centered ? " idc-head-c" : ""}">
    ${logo(c)}
    <div>
      <div class="idc-school">${escapeHtml(c.schoolName)}</div>
      ${c.schoolMotto ? `<div class="idc-motto">${escapeHtml(c.schoolMotto)}</div>` : ""}
    </div>
  </div>`;
}

function photo(c: CardContext, w: string, h: string): string {
  const style = `width:${w};height:${h}`;
  return c.photoDataUrl
    ? `<img class="idc-photo" style="${style}" src="${c.photoDataUrl}" alt=""/>`
    : `<div class="idc-photo-ph" style="${style}">NO<br/>PHOTO</div>`;
}

function qr(c: CardContext, small = false): string {
  if (!c.qrDataUrl) return "";
  return `<img class="idc-qr${small ? " idc-qr-sm" : ""}" src="${c.qrDataUrl}" alt=""/>`;
}

function signature(c: CardContext): string {
  return `<div class="idc-sig">
    <div class="idc-sig-line"></div>
    <div class="idc-sig-txt">${escapeHtml(c.principalName || "Principal Signature")}</div>
  </div>`;
}

function rows(pairs: [string, string][]): string {
  const body = pairs
    .filter(([, v]) => v && v !== "—")
    .map(
      ([k, v]) =>
        `<tr><td class="k">${escapeHtml(k)}</td><td class="v">${escapeHtml(v)}</td></tr>`,
    )
    .join("");
  return `<table class="idc-rows">${body}</table>`;
}

function idBlock(c: CardContext, outline = false): string {
  return `<div>
    <div class="idc-lbl">${escapeHtml(c.idLabel)}</div>
    <div class="idc-pill${outline ? " idc-pill-o" : ""}" style="margin-top:.6mm">${escapeHtml(c.studentId)}</div>
  </div>`;
}

function footer(c: CardContext, light = false): string {
  const text = c.footerText || c.schoolWebsite || c.schoolPhone || "";
  if (!text) return "";
  return `<div class="idc-foot${light ? " idc-foot-l" : ""}">${escapeHtml(text)}</div>`;
}

// ── Student ID templates ──────────────────────────────────────────────────

const modernBlue: CardTemplate = {
  id: "modern-blue",
  name: "Modern Blue",
  cardType: "STUDENT_ID",
  orientation: "PORTRAIT",
  usesPhoto: true,
  accent: "#1d4ed8",
  render: (c) => `
    ${header(c, true)}
    <div class="idc-titlebar">${escapeHtml(c.cardTitle)}</div>
    <div class="idc-body" style="align-items:center;text-align:center">
      <div style="margin:1.2mm 0">${photo(c, "22mm", "26mm")}</div>
      <div class="idc-name">${escapeHtml(c.studentName)}</div>
      <div style="margin-top:1.4mm">${idBlock(c)}</div>
      <div style="width:100%;margin-top:1.6mm;text-align:left">
        ${rows([
          ["Class", c.className],
          ["Section", c.section],
          ["Academic Year", c.academicYear],
        ])}
      </div>
      <div class="idc-between idc-mt" style="width:100%;padding-top:1.2mm">
        ${qr(c)}
        ${signature(c)}
      </div>
    </div>
    ${footer(c)}`,
};

const classicStyle: CardTemplate = {
  id: "classic",
  name: "Classic Style",
  cardType: "STUDENT_ID",
  orientation: "PORTRAIT",
  usesPhoto: true,
  accent: "#0f766e",
  render: (c) => `
    ${header(c, false)}
    <div class="idc-strip"></div>
    <div class="idc-body">
      <div class="idc-row">
        ${photo(c, "18mm", "22mm")}
        <div style="flex:1;min-width:0">
          <div class="idc-lbl">${escapeHtml(c.cardTitle)}</div>
          <div class="idc-name idc-name-sm" style="margin-top:.6mm">${escapeHtml(c.studentName)}</div>
          <div style="margin-top:1.2mm">${idBlock(c, true)}</div>
        </div>
      </div>
      <div style="margin-top:1.6mm">
        ${rows([
          ["Class", c.className],
          ["Section", c.section],
          ["Academic Year", c.academicYear],
          ["Guardian", c.guardianName],
        ])}
      </div>
      <div class="idc-between idc-mt" style="padding-top:1mm">
        ${qr(c, true)}
        ${signature(c)}
      </div>
    </div>
    ${footer(c, true)}`,
};

const minimalStyle: CardTemplate = {
  id: "minimal",
  name: "Minimal Style",
  cardType: "STUDENT_ID",
  orientation: "LANDSCAPE",
  usesPhoto: true,
  accent: "#334155",
  render: (c) => `
    <div class="idc-body" style="padding:3mm">
      <div class="idc-between" style="align-items:center">
        <div class="idc-row" style="align-items:center;gap:1.5mm">
          ${logo(c)}
          <div>
            <div class="idc-school" style="color:#0f172a">${escapeHtml(c.schoolName)}</div>
            <div class="idc-lbl">${escapeHtml(c.cardTitle)}</div>
          </div>
        </div>
        ${qr(c, true)}
      </div>
      <div class="idc-row" style="margin-top:2mm;flex:1">
        ${photo(c, "16mm", "20mm")}
        <div style="flex:1;min-width:0;display:flex;flex-direction:column">
          <div class="idc-name idc-name-sm">${escapeHtml(c.studentName)}</div>
          <div style="margin-top:.8mm">
            <span class="idc-lbl">${escapeHtml(c.idLabel)}</span>
            <div class="idc-pill idc-pill-o" style="margin-top:.4mm">${escapeHtml(c.studentId)}</div>
          </div>
          <div style="margin-top:auto">
            ${rows([
              ["Class", `${c.className}${c.section ? ` · ${c.section}` : ""}`],
              ["Academic Year", c.academicYear],
            ])}
          </div>
        </div>
      </div>
    </div>
    <div class="idc-strip"></div>`,
};

const premiumStyle: CardTemplate = {
  id: "premium",
  name: "Premium Style",
  cardType: "STUDENT_ID",
  orientation: "PORTRAIT",
  usesPhoto: true,
  accent: "#6d28d9",
  render: (c) => `
    <div class="idc-head idc-head-c" style="padding:2.6mm 2mm 3.4mm">
      ${logo(c)}
      <div class="idc-school" style="margin-top:.6mm">${escapeHtml(c.schoolName)}</div>
      <div class="idc-title" style="margin-top:.4mm">${escapeHtml(c.cardTitle)}</div>
    </div>
    <div class="idc-body" style="align-items:center;text-align:center;margin-top:-3mm">
      <div style="background:#fff;border-radius:1.6mm;padding:.8mm;box-shadow:0 0 0 .3mm rgba(0,0,0,.08)">
        ${photo(c, "21mm", "25mm")}
      </div>
      <div class="idc-name" style="margin-top:1.2mm">${escapeHtml(c.studentName)}</div>
      <div class="idc-lbl">${escapeHtml(c.className)}${c.section ? ` · ${escapeHtml(c.section)}` : ""}</div>
      <div style="margin-top:1.2mm">${idBlock(c)}</div>
      <div class="idc-between idc-mt" style="width:100%;padding-top:1.4mm">
        ${qr(c)}
        <div style="text-align:right">
          <div class="idc-lbl">Valid For</div>
          <div style="font-size:6pt;font-weight:700">${escapeHtml(c.academicYear)}</div>
        </div>
      </div>
    </div>
    ${footer(c)}`,
};

const photoFocused: CardTemplate = {
  id: "photo-focused",
  name: "Photo Focused",
  cardType: "STUDENT_ID",
  orientation: "PORTRAIT",
  usesPhoto: true,
  accent: "#b91c1c",
  render: (c) => `
    <div class="idc-head" style="padding:1.6mm 2mm">
      ${logo(c)}
      <div class="idc-school">${escapeHtml(c.schoolName)}</div>
    </div>
    <div class="idc-body" style="align-items:center;text-align:center;padding-top:1.4mm">
      ${photo(c, "26mm", "30mm")}
      <div class="idc-name" style="margin-top:1.2mm">${escapeHtml(c.studentName)}</div>
      <div class="idc-pill" style="margin-top:1mm">${escapeHtml(c.studentId)}</div>
      <div class="idc-lbl" style="margin-top:1mm">${escapeHtml(c.className)}${c.section ? ` · ${escapeHtml(c.section)}` : ""} · ${escapeHtml(c.academicYear)}</div>
      <div class="idc-mt" style="padding-top:1mm">${qr(c, true)}</div>
    </div>
    ${footer(c)}`,
};

// ── Exam card templates ───────────────────────────────────────────────────

const examOffice: CardTemplate = {
  id: "exam-office",
  name: "Exam Card — Blue",
  cardType: "EXAM_CARD",
  orientation: "PORTRAIT",
  usesPhoto: true,
  accent: "#1e40af",
  render: (c) => `
    ${header(c, true)}
    <div class="idc-titlebar">${escapeHtml(c.cardTitle)}</div>
    <div class="idc-body">
      <div class="idc-row">
        ${photo(c, "17mm", "21mm")}
        <div style="flex:1;min-width:0">
          <div class="idc-name idc-name-sm">${escapeHtml(c.studentName)}</div>
          <div style="margin-top:.8mm">${idBlock(c, true)}</div>
        </div>
      </div>
      <div style="margin-top:1.4mm">
        ${rows([
          ["Exam", c.examName],
          ["Session", c.examSession],
          ["Date", c.examDate],
          ["Class", `${c.className}${c.section ? ` · ${c.section}` : ""}`],
          ["Academic Year", c.academicYear],
        ])}
      </div>
      <div class="idc-between idc-mt" style="padding-top:1mm">
        ${qr(c, true)}
        <div style="text-align:right">
          <div class="idc-sig-line" style="margin-inline:0 0"></div>
          <div class="idc-sig-txt">${escapeHtml(c.examOffice || "Exam Office")}</div>
        </div>
      </div>
    </div>
    ${footer(c)}`,
};

const examAcademic: CardTemplate = {
  id: "exam-academic",
  name: "Exam Card — Academic",
  cardType: "EXAM_CARD",
  orientation: "LANDSCAPE",
  usesPhoto: true,
  accent: "#155e75",
  render: (c) => `
    <div class="idc-head" style="padding:1.6mm 2.5mm">
      ${logo(c)}
      <div style="flex:1">
        <div class="idc-school">${escapeHtml(c.schoolName)}</div>
        <div class="idc-motto">${escapeHtml(c.cardTitle)}</div>
      </div>
      ${qr(c, true)}
    </div>
    <div class="idc-body">
      <div class="idc-row" style="flex:1">
        ${photo(c, "15mm", "19mm")}
        <div style="flex:1;min-width:0">
          <div class="idc-name idc-name-sm">${escapeHtml(c.studentName)}</div>
          <div class="idc-pill idc-pill-o" style="margin-top:.6mm">${escapeHtml(c.studentId)}</div>
          <div style="margin-top:.8mm">
            ${rows([
              ["Exam", c.examName],
              ["Date", c.examDate],
              ["Class", `${c.className}${c.section ? ` · ${c.section}` : ""}`],
            ])}
          </div>
        </div>
      </div>
    </div>
    ${footer(c, true)}`,
};

// ── Clearance template ────────────────────────────────────────────────────

function clearanceTone(status: string): { bg: string; fg: string } {
  const s = status.toUpperCase();
  if (s.includes("CLEAR")) return { bg: "#dcfce7", fg: "#166534" };
  if (s.includes("PEND")) return { bg: "#fef9c3", fg: "#854d0e" };
  return { bg: "#fee2e2", fg: "#991b1b" };
}

const clearanceOfficial: CardTemplate = {
  id: "clearance-official",
  name: "Clearance Card",
  cardType: "CLEARANCE_CARD",
  orientation: "PORTRAIT",
  usesPhoto: true,
  accent: "#047857",
  render: (c) => {
    const tone = clearanceTone(c.clearanceStatus);
    return `
    ${header(c, true)}
    <div class="idc-titlebar">${escapeHtml(c.cardTitle)}</div>
    <div class="idc-body" style="align-items:center;text-align:center">
      <div style="margin:1mm 0">${photo(c, "19mm", "23mm")}</div>
      <div class="idc-name idc-name-sm">${escapeHtml(c.studentName)}</div>
      <div class="idc-pill idc-pill-o" style="margin-top:.8mm">${escapeHtml(c.studentId)}</div>
      <div class="idc-badge" style="margin-top:1.4mm;background:${tone.bg};color:${tone.fg}">
        ${escapeHtml(c.clearanceStatus || "Pending")}
      </div>
      <div style="width:100%;margin-top:1.4mm;text-align:left">
        ${rows([
          ["Class", `${c.className}${c.section ? ` · ${c.section}` : ""}`],
          ["Academic Year", c.academicYear],
          ["Issued", c.issueDate],
        ])}
      </div>
      <div class="idc-between idc-mt" style="width:100%;padding-top:1mm">
        ${qr(c, true)}
        ${signature(c)}
      </div>
    </div>
    ${footer(c)}`;
  },
};

// ── Custom card template ──────────────────────────────────────────────────

const customBasic: CardTemplate = {
  id: "custom-basic",
  name: "Custom Card",
  cardType: "CUSTOM_CARD",
  orientation: "LANDSCAPE",
  usesPhoto: true,
  accent: "#c2410c",
  render: (c) => `
    <div class="idc-head" style="padding:1.8mm 2.5mm">
      ${logo(c)}
      <div style="flex:1">
        <div class="idc-school">${escapeHtml(c.schoolName)}</div>
        <div class="idc-motto">${escapeHtml(c.cardTitle)}</div>
      </div>
    </div>
    <div class="idc-body">
      <div class="idc-row" style="flex:1">
        ${photo(c, "15mm", "19mm")}
        <div style="flex:1;min-width:0;display:flex;flex-direction:column">
          <div class="idc-name idc-name-sm">${escapeHtml(c.studentName)}</div>
          <div class="idc-pill idc-pill-o" style="margin-top:.6mm">${escapeHtml(c.studentId)}</div>
          <div style="margin-top:.8mm">
            ${rows([
              ["Class", `${c.className}${c.section ? ` · ${c.section}` : ""}`],
              [c.customLine1 ? "Detail" : "", c.customLine1],
              [c.customLine2 ? "Note" : "", c.customLine2],
              ["Valid", c.academicYear],
            ])}
          </div>
        </div>
        <div style="display:flex;flex-direction:column;justify-content:space-between;align-items:flex-end">
          ${qr(c, true)}
        </div>
      </div>
    </div>
    ${footer(c, true)}`,
};

export const CARD_TEMPLATES: CardTemplate[] = [
  modernBlue,
  classicStyle,
  minimalStyle,
  premiumStyle,
  photoFocused,
  examOffice,
  examAcademic,
  clearanceOfficial,
  customBasic,
];

export function templatesForType(cardType: string): CardTemplate[] {
  return CARD_TEMPLATES.filter((t) => t.cardType === cardType);
}

export function templateById(id: string): CardTemplate | undefined {
  return CARD_TEMPLATES.find((t) => t.id === id);
}

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
