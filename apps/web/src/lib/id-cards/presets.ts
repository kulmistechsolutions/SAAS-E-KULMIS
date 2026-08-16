"use client";

import type { CardDesign, CardElement } from "./elements";
import type { CardOrientation, CardType } from "./types";

/**
 * Built-in designs, expressed on the same millimetre grid the designer edits.
 *
 * Both orientations come from one description per style, so a school can print
 * any design portrait or landscape and the two stay visually consistent. These
 * are starting points: once opened in the designer every element can be moved,
 * resized, retyped or deleted.
 */

export interface PresetStyle {
  id: string;
  name: string;
  cardType: CardType;
  accent: string;
  /** Header treatment: logo centred over the name, or beside it. */
  centeredHeader: boolean;
  /** Solid bar under the header carrying the card title. */
  titlebar: boolean;
  /** ID shown as an outlined chip rather than a solid one. */
  outlinePill: boolean;
  /** Footer band: accent, light grey, or none. */
  footer: "accent" | "light" | "none";
  /** Extra detail rows beyond class/section/year. */
  rows: { label: string; field: CardElement["field"] }[];
}

const STUDENT_ROWS: PresetStyle["rows"] = [
  { label: "Class", field: "className" },
  { label: "Section", field: "section" },
  { label: "Academic Year", field: "academicYear" },
];

export const PRESET_STYLES: PresetStyle[] = [
  { id: "modern-blue", name: "Modern Blue", cardType: "STUDENT_ID", accent: "#1d4ed8", centeredHeader: true, titlebar: true, outlinePill: false, footer: "accent", rows: STUDENT_ROWS },
  { id: "classic", name: "Classic Style", cardType: "STUDENT_ID", accent: "#0f766e", centeredHeader: false, titlebar: true, outlinePill: true, footer: "light", rows: [...STUDENT_ROWS, { label: "Guardian", field: "guardianName" }] },
  { id: "minimal", name: "Minimal Style", cardType: "STUDENT_ID", accent: "#334155", centeredHeader: false, titlebar: false, outlinePill: true, footer: "none", rows: STUDENT_ROWS },
  { id: "premium", name: "Premium Style", cardType: "STUDENT_ID", accent: "#6d28d9", centeredHeader: true, titlebar: true, outlinePill: false, footer: "accent", rows: STUDENT_ROWS },
  { id: "photo-focused", name: "Photo Focused", cardType: "STUDENT_ID", accent: "#b91c1c", centeredHeader: false, titlebar: false, outlinePill: false, footer: "accent", rows: STUDENT_ROWS },
  { id: "exam-office", name: "Exam Card — Blue", cardType: "EXAM_CARD", accent: "#1e40af", centeredHeader: true, titlebar: true, outlinePill: true, footer: "accent", rows: [
    { label: "Exam", field: "examName" }, { label: "Session", field: "examSession" },
    { label: "Date", field: "examDate" }, { label: "Class", field: "className" },
  ] },
  { id: "exam-academic", name: "Exam Card — Academic", cardType: "EXAM_CARD", accent: "#155e75", centeredHeader: false, titlebar: true, outlinePill: true, footer: "light", rows: [
    { label: "Exam", field: "examName" }, { label: "Date", field: "examDate" },
    { label: "Class", field: "className" }, { label: "Year", field: "academicYear" },
  ] },
  { id: "clearance-official", name: "Clearance Card", cardType: "CLEARANCE_CARD", accent: "#047857", centeredHeader: true, titlebar: true, outlinePill: true, footer: "accent", rows: [
    { label: "Class", field: "className" }, { label: "Section", field: "section" },
    { label: "Status", field: "clearanceStatus" }, { label: "Issued", field: "issueDate" },
  ] },
  { id: "custom-basic", name: "Custom Card", cardType: "CUSTOM_CARD", accent: "#c2410c", centeredHeader: false, titlebar: true, outlinePill: true, footer: "light", rows: [
    { label: "Class", field: "className" }, { label: "Detail", field: "customLine1" },
    { label: "Note", field: "customLine2" }, { label: "Valid", field: "academicYear" },
  ] },
];

let n = 0;
const id = (p: string) => `${p}-${(n += 1)}`;

/** Label + value pair on one baseline — the pattern the detail rows use. */
function row(
  y: number,
  label: string,
  field: CardElement["field"],
  labelX: number,
  labelW: number,
  valueX: number,
  valueW: number,
): CardElement[] {
  return [
    { id: id("lbl"), type: "text", text: label, x: labelX, y, w: labelW, h: 3, fontSize: 4.6, color: "#64748b", align: "left" },
    { id: id("val"), type: "field", field, x: valueX, y, w: valueW, h: 3, fontSize: 4.8, bold: true, align: "right" },
  ];
}

function portrait(s: PresetStyle, W: number, H: number): CardElement[] {
  const els: CardElement[] = [];
  const headerH = s.titlebar ? 15 : 17;
  const plain = s.footer === "none" && !s.titlebar;

  // Header band
  els.push({ id: id("hdr"), type: "box", x: 0, y: 0, w: W, h: headerH, bg: plain ? "#ffffff" : "accentGradient" });
  const fg = plain ? "#0f172a" : "#ffffff";

  if (s.centeredHeader) {
    els.push({ id: id("logo"), type: "logo", x: W / 2 - 4, y: 1.4, w: 8, h: 8, color: fg });
    els.push({ id: id("sch"), type: "field", field: "schoolName", x: 2, y: 9.6, w: W - 4, h: 3.4, fontSize: 6, bold: true, align: "center", color: fg });
    els.push({ id: id("mot"), type: "field", field: "schoolMotto", x: 2, y: 12.6, w: W - 4, h: 2.6, fontSize: 4.1, align: "center", color: fg, opacity: 0.9 });
  } else {
    els.push({ id: id("logo"), type: "logo", x: 2.4, y: 3, w: 8.4, h: 8.4, color: fg });
    els.push({ id: id("sch"), type: "field", field: "schoolName", x: 12, y: 3.6, w: W - 14, h: 3.6, fontSize: 6, bold: true, color: fg });
    els.push({ id: id("mot"), type: "field", field: "schoolMotto", x: 12, y: 7.1, w: W - 14, h: 2.6, fontSize: 4.1, color: fg, opacity: 0.9 });
  }

  let y = headerH;
  if (s.titlebar) {
    els.push({ id: id("tbbg"), type: "box", x: 0, y, w: W, h: 5, bg: "accentDark" });
    els.push({ id: id("ttl"), type: "field", field: "cardTitle", x: 0, y: y + 0.6, w: W, h: 3.8, fontSize: 5.2, bold: true, align: "center", color: "#ffffff", uppercase: true, letterSpacing: 0.1 });
    y += 5;
  } else if (!plain) {
    els.push({ id: id("strip"), type: "box", x: 0, y, w: W, h: 1.2, bg: "accent" });
    y += 1.2;
  } else {
    els.push({ id: id("rule"), type: "line", x: 0, y, w: W, h: 0.3, borderColor: "#e2e8f0" });
    y += 0.3;
  }

  // Identity block
  const photoW = s.id === "photo-focused" ? 25 : 20;
  const photoH = s.id === "photo-focused" ? 29 : 24;
  const photoY = y + 2;
  els.push({ id: id("photo"), type: "photo", x: (W - photoW) / 2, y: photoY, w: photoW, h: photoH, radius: 1.2, borderWidth: 0.4, borderColor: "accent" });

  let cy = photoY + photoH + 1.4;
  els.push({ id: id("name"), type: "field", field: "studentName", x: 2, y: cy, w: W - 4, h: 4.4, fontSize: 7.2, bold: true, align: "center", color: "accentDark" });
  cy += 4.8;
  els.push({ id: id("idlbl"), type: "field", field: "idLabel", x: 2, y: cy, w: W - 4, h: 2.6, fontSize: 4, align: "center", color: "#64748b", uppercase: true, letterSpacing: 0.09 });
  cy += 2.8;
  els.push({
    id: id("idbg"), type: "box", x: (W - 28) / 2, y: cy, w: 28, h: 6.4, radius: 1,
    bg: s.outlinePill ? "#ffffff" : "accent",
    borderWidth: s.outlinePill ? 0.4 : undefined,
    borderColor: s.outlinePill ? "accent" : undefined,
  });
  els.push({
    id: id("idval"), type: "field", field: "studentId", x: (W - 28) / 2, y: cy, w: 28, h: 6.4,
    fontSize: 7, bold: true, align: "center", mono: true,
    color: s.outlinePill ? "accentDark" : "#ffffff",
  });
  cy += 8;

  // Detail rows
  for (const r of s.rows.slice(0, 4)) {
    els.push(...row(cy, r.label, r.field, 3, 24, W - 27, 24));
    cy += 3.4;
  }

  // Footer, QR and signature sit against the bottom edge.
  const footH = s.footer === "none" ? 0 : 4.4;
  if (s.footer !== "none") {
    els.push({ id: id("ftbg"), type: "box", x: 0, y: H - footH, w: W, h: footH, bg: s.footer === "accent" ? "accentDark" : "#f1f5f9" });
    els.push({ id: id("ft"), type: "field", field: "footerText", x: 1, y: H - footH, w: W - 2, h: footH, fontSize: 4, align: "center", color: s.footer === "accent" ? "#ffffff" : "#475569" });
  }
  const bottom = H - footH - 1;
  els.push({ id: id("qr"), type: "qr", x: 3, y: bottom - 9, w: 9, h: 9 });
  els.push({ id: id("sig"), type: "signature", x: W - 25, y: bottom - 6.5, w: 22, h: 6.5, fontSize: 3.8, color: "#64748b", align: "center" });

  return els;
}

function landscape(s: PresetStyle, W: number, H: number): CardElement[] {
  const els: CardElement[] = [];
  const plain = s.footer === "none" && !s.titlebar;
  const headerH = 11;

  els.push({ id: id("hdr"), type: "box", x: 0, y: 0, w: W, h: headerH, bg: plain ? "#ffffff" : "accentGradient" });
  const fg = plain ? "#0f172a" : "#ffffff";
  els.push({ id: id("logo"), type: "logo", x: 2.4, y: 1.4, w: 8.2, h: 8.2, color: fg });
  els.push({ id: id("sch"), type: "field", field: "schoolName", x: 12, y: 2, w: W - 30, h: 3.6, fontSize: 6.2, bold: true, color: fg });
  els.push({ id: id("mot"), type: "field", field: "schoolMotto", x: 12, y: 5.6, w: W - 30, h: 2.6, fontSize: 4.1, color: fg, opacity: 0.9 });

  let y = headerH;
  if (s.titlebar) {
    els.push({ id: id("tbbg"), type: "box", x: 0, y, w: W, h: 5, bg: "accentDark" });
    els.push({ id: id("ttl"), type: "field", field: "cardTitle", x: 0, y: y + 0.6, w: W, h: 3.8, fontSize: 5.2, bold: true, align: "center", color: "#ffffff", uppercase: true, letterSpacing: 0.1 });
    y += 5;
  } else if (!plain) {
    els.push({ id: id("strip"), type: "box", x: 0, y, w: W, h: 1.2, bg: "accent" });
    y += 1.2;
  }

  // Left column: photo above QR. Right column: identity then details.
  const px = 3;
  const py = y + 2;
  els.push({ id: id("photo"), type: "photo", x: px, y: py, w: 16, h: 20, radius: 1.2, borderWidth: 0.4, borderColor: "accent" });
  els.push({ id: id("qr"), type: "qr", x: px, y: py + 21, w: 8.6, h: 8.6 });

  const rx = 23;
  const rw = W - rx - 3;
  let cy = py;
  els.push({ id: id("name"), type: "field", field: "studentName", x: rx, y: cy, w: rw, h: 4.2, fontSize: 6.8, bold: true, color: "accentDark" });
  cy += 4.6;
  els.push({ id: id("idlbl"), type: "field", field: "idLabel", x: rx, y: cy, w: 22, h: 2.6, fontSize: 4, color: "#64748b", uppercase: true, letterSpacing: 0.09 });
  cy += 2.8;
  els.push({
    id: id("idbg"), type: "box", x: rx, y: cy, w: 27, h: 6.2, radius: 1,
    bg: s.outlinePill ? "#ffffff" : "accent",
    borderWidth: s.outlinePill ? 0.4 : undefined,
    borderColor: s.outlinePill ? "accent" : undefined,
  });
  els.push({
    id: id("idval"), type: "field", field: "studentId", x: rx, y: cy, w: 27, h: 6.2,
    fontSize: 6.8, bold: true, align: "center", mono: true,
    color: s.outlinePill ? "accentDark" : "#ffffff",
  });
  cy += 7.4;

  for (const r of s.rows.slice(0, 4)) {
    els.push(...row(cy, r.label, r.field, rx, 24, W - 27, 24));
    cy += 3.2;
  }

  const footH = s.footer === "none" ? 0 : 4.2;
  if (s.footer !== "none") {
    els.push({ id: id("ftbg"), type: "box", x: 0, y: H - footH, w: W, h: footH, bg: s.footer === "accent" ? "accentDark" : "#f1f5f9" });
    els.push({ id: id("ft"), type: "field", field: "footerText", x: 1, y: H - footH, w: W - 2, h: footH, fontSize: 4, align: "center", color: s.footer === "accent" ? "#ffffff" : "#475569" });
  }
  els.push({ id: id("sig"), type: "signature", x: W - 27, y: H - footH - 7.5, w: 24, h: 6.4, fontSize: 3.8, color: "#64748b", align: "center" });

  return els;
}

/** Build a fresh design for a style at the given physical size. */
export function presetDesign(
  styleId: string,
  orientation: CardOrientation,
  width: number,
  height: number,
): CardDesign {
  const s = PRESET_STYLES.find((p) => p.id === styleId) ?? PRESET_STYLES[0];
  return {
    width,
    height,
    accent: s.accent,
    elements: orientation === "PORTRAIT" ? portrait(s, width, height) : landscape(s, width, height),
  };
}

export function presetsForType(cardType: string): PresetStyle[] {
  return PRESET_STYLES.filter((p) => p.cardType === cardType);
}

export function presetById(id: string): PresetStyle | undefined {
  return PRESET_STYLES.find((p) => p.id === id);
}
