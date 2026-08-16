"use client";

import type { CardContext, CardOrientation, CardTemplate, CardType } from "./types";

export function escapeHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * One stylesheet, shared by the on-screen preview and the print window, so what
 * an admin approves is exactly what leaves the printer. Everything is in mm/pt
 * because a card is a physical object — px would drift with print DPI.
 *
 * `print-color-adjust: exact` is required: without it browsers drop background
 * fills when printing and every card comes out plain white.
 */
export const CARD_CSS = `
.idc {
  position: relative; overflow: hidden; background: #fff; color: #0f172a;
  font-family: Arial, Helvetica, sans-serif;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
  display: flex; flex-direction: column;
}
.idc * { box-sizing: border-box; }

/* ── Header ── */
.idc-head { background: linear-gradient(135deg, var(--idc-accent), var(--idc-accent-dark)); color: #fff; display: flex; align-items: center; gap: 1.8mm; padding: 1.8mm 2.4mm; flex: 0 0 auto; }
.idc-head.c { flex-direction: column; text-align: center; gap: .7mm; }
.idc-head.plain { background: #fff; color: #0f172a; border-bottom: .3mm solid #e2e8f0; }
.idc-head.tall { padding-top: 2.6mm; padding-bottom: 2.6mm; }
.idc-logo { width: 6.6mm; height: 6.6mm; border-radius: 1.1mm; object-fit: contain; background: #fff; padding: .35mm; flex: 0 0 auto; }
.idc-logo.lg { width: 8.4mm; height: 8.4mm; }
.idc-logo-ph { width: 6.6mm; height: 6.6mm; border-radius: 1.1mm; background: rgba(255,255,255,.25); display: flex; align-items: center; justify-content: center; font-size: 4.6pt; font-weight: 700; flex: 0 0 auto; }
.idc-head.plain .idc-logo-ph { background: var(--idc-accent); color: #fff; }
.idc-htxt { min-width: 0; flex: 1; }
.idc-head.c .idc-htxt { flex: none; }
.idc-school { font-size: 6.2pt; font-weight: 700; line-height: 1.12; }
.idc-school.lg { font-size: 7pt; }
.idc-motto { font-size: 4.2pt; opacity: .88; line-height: 1.15; margin-top: .25mm; }
.idc-head.plain .idc-motto { color: #64748b; opacity: 1; }

/* Solid accent, never a translucent overlay: the title bar sits on the white
   card body, so rgba() black rendered as pale grey with unreadable white text. */
.idc-titlebar { background: var(--idc-accent-dark); color: #fff; text-align: center; padding: .9mm; font-size: 5.2pt; font-weight: 700; letter-spacing: .11em; text-transform: uppercase; flex: 0 0 auto; }
.idc-strip { height: 1.2mm; background: var(--idc-accent); flex: 0 0 auto; }

/* ── Body ── */
.idc-body { flex: 1 1 auto; min-height: 0; padding: 1.8mm 2.4mm; display: flex; flex-direction: column; gap: 1mm; }
.idc-body.c { align-items: center; text-align: center; }
.idc-cols { display: flex; gap: 2.2mm; flex: 1 1 auto; min-height: 0; align-items: flex-start; }
.idc-col { min-width: 0; flex: 1 1 auto; display: flex; flex-direction: column; }

.idc-photo { border-radius: 1.2mm; object-fit: cover; border: .4mm solid var(--idc-accent); background: #f1f5f9; display: block; flex: 0 0 auto; }
.idc-photo-ph { border-radius: 1.2mm; border: .4mm dashed #cbd5e1; background: #f8fafc; color: #94a3b8; display: flex; align-items: center; justify-content: center; font-size: 4.2pt; text-align: center; line-height: 1.15; flex: 0 0 auto; }

.idc-name { font-size: 7.6pt; font-weight: 700; color: var(--idc-accent-dark); line-height: 1.12; }
.idc-name.sm { font-size: 6.6pt; }
.idc-lbl { font-size: 4pt; letter-spacing: .09em; text-transform: uppercase; color: #64748b; line-height: 1.2; }
.idc-pill { background: var(--idc-accent); color: #fff; border-radius: 1mm; padding: .9mm 1.8mm; font-size: 7pt; font-weight: 700; font-family: "Courier New", monospace; letter-spacing: .03em; display: inline-block; white-space: nowrap; }
.idc-pill.o { background: #fff; color: var(--idc-accent-dark); border: .4mm solid var(--idc-accent); }

.idc-rows { width: 100%; border-collapse: collapse; font-size: 5pt; }
.idc-rows td { padding: .42mm 0; vertical-align: top; }
.idc-rows .k { color: #64748b; width: 44%; }
.idc-rows .v { font-weight: 700; text-align: end; }

.idc-qr { width: 10mm; height: 10mm; display: block; flex: 0 0 auto; }
.idc-qr.sm { width: 8.4mm; height: 8.4mm; }
.idc-sig { text-align: center; }
.idc-sig-line { border-top: .3mm solid #94a3b8; width: 16mm; margin: 0 auto .35mm; }
.idc-sig-txt { font-size: 3.8pt; color: #64748b; line-height: 1.15; }
.idc-badge { display: inline-block; border-radius: 5mm; padding: .6mm 1.8mm; font-size: 4.8pt; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; }

.idc-foot { background: var(--idc-accent-dark); color: #fff; text-align: center; padding: .8mm; font-size: 4.1pt; flex: 0 0 auto; }
.idc-foot.light { background: #f1f5f9; color: #475569; }

.idc-between { display: flex; align-items: flex-end; justify-content: space-between; gap: 1.5mm; width: 100%; }
.idc-push { margin-top: auto; }
`;

// ── Shared pieces ─────────────────────────────────────────────────────────

type HeaderStyle = "gradient-center" | "gradient-left" | "plain" | "tall";
type PhotoScale = "sm" | "md" | "lg";

interface TemplateSpec {
  id: string;
  name: string;
  cardType: CardType;
  accent: string;
  header: HeaderStyle;
  titlebar: boolean;
  strip: boolean;
  pillOutline: boolean;
  footer: "accent" | "light" | "none";
  photo: PhotoScale;
  rows: (c: CardContext) => [string, string][];
  /** Optional block shown above the QR row (status badge, validity, …). */
  extra?: (c: CardContext) => string;
}

/** Photo box in mm, sized for the space the orientation actually leaves. */
function photoBox(scale: PhotoScale, o: CardOrientation): { w: string; h: string } {
  const p = { sm: [17, 21], md: [21, 25], lg: [25, 29] } as const;
  const l = { sm: [14, 17], md: [16, 20], lg: [19, 23] } as const;
  const [w, h] = o === "PORTRAIT" ? p[scale] : l[scale];
  return { w: `${w}mm`, h: `${h}mm` };
}

function logo(c: CardContext, big = false): string {
  const cls = big ? "idc-logo lg" : "idc-logo";
  return c.logoDataUrl
    ? `<img class="${cls}" src="${c.logoDataUrl}" alt=""/>`
    : `<div class="idc-logo-ph"${big ? ' style="width:8.4mm;height:8.4mm"' : ""}>${escapeHtml(
        c.schoolName.slice(0, 2).toUpperCase(),
      )}</div>`;
}

function header(spec: TemplateSpec, c: CardContext, o: CardOrientation): string {
  // Landscape has only ~54mm of height, so the tall/centred treatments collapse
  // to the compact left-aligned one rather than eating the whole card.
  const style: HeaderStyle =
    o === "LANDSCAPE" && (spec.header === "tall" || spec.header === "gradient-center")
      ? "gradient-left"
      : spec.header;

  const centered = style === "gradient-center" || style === "tall";
  const cls = [
    "idc-head",
    centered ? "c" : "",
    style === "plain" ? "plain" : "",
    style === "tall" ? "tall" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const title =
    style === "tall"
      ? `<div class="idc-lbl" style="color:inherit;opacity:.85;margin-top:.4mm">${escapeHtml(c.cardTitle)}</div>`
      : "";

  return `<div class="${cls}">
    ${logo(c, style === "tall")}
    <div class="idc-htxt">
      <div class="idc-school${style === "tall" ? " lg" : ""}">${escapeHtml(c.schoolName)}</div>
      ${c.schoolMotto ? `<div class="idc-motto">${escapeHtml(c.schoolMotto)}</div>` : ""}
      ${title}
    </div>
  </div>`;
}

function photo(c: CardContext, spec: TemplateSpec, o: CardOrientation): string {
  const { w, h } = photoBox(spec.photo, o);
  const style = `width:${w};height:${h}`;
  return c.photoDataUrl
    ? `<img class="idc-photo" style="${style}" src="${c.photoDataUrl}" alt=""/>`
    : `<div class="idc-photo-ph" style="${style}">NO<br/>PHOTO</div>`;
}

function qr(c: CardContext, small = false): string {
  return c.qrDataUrl ? `<img class="idc-qr${small ? " sm" : ""}" src="${c.qrDataUrl}" alt=""/>` : "";
}

function signature(c: CardContext): string {
  return `<div class="idc-sig">
    <div class="idc-sig-line"></div>
    <div class="idc-sig-txt">${escapeHtml(c.principalName || "Authorised Signature")}</div>
  </div>`;
}

function rowsTable(pairs: [string, string][]): string {
  const body = pairs
    .filter(([k, v]) => k && v && v !== "—")
    .map(([k, v]) => `<tr><td class="k">${escapeHtml(k)}</td><td class="v">${escapeHtml(v)}</td></tr>`)
    .join("");
  return body ? `<table class="idc-rows">${body}</table>` : "";
}

function idBlock(c: CardContext, spec: TemplateSpec, center: boolean): string {
  return `<div${center ? "" : ' style="align-self:flex-start"'}>
    <div class="idc-lbl">${escapeHtml(c.idLabel)}</div>
    <div class="idc-pill${spec.pillOutline ? " o" : ""}" style="margin-top:.5mm">${escapeHtml(c.studentId)}</div>
  </div>`;
}

function footer(spec: TemplateSpec, c: CardContext): string {
  if (spec.footer === "none") return "";
  const text = c.footerText || c.schoolWebsite || c.schoolPhone || "";
  if (!text) return "";
  return `<div class="idc-foot${spec.footer === "light" ? " light" : ""}">${escapeHtml(text)}</div>`;
}

function titlebar(spec: TemplateSpec, c: CardContext, o: CardOrientation): string {
  // The tall header already prints the title, so a bar under it would repeat it.
  if (!spec.titlebar) return "";
  if (spec.header === "tall" && o === "PORTRAIT") return "";
  return `<div class="idc-titlebar">${escapeHtml(c.cardTitle)}</div>`;
}

// ── Orientation layouts ───────────────────────────────────────────────────

/** 54 × 86 mm — a vertical stack: identity on top, details beneath. */
function portrait(spec: TemplateSpec, c: CardContext): string {
  return `
    ${header(spec, c, "PORTRAIT")}
    ${titlebar(spec, c, "PORTRAIT")}
    ${spec.strip ? '<div class="idc-strip"></div>' : ""}
    <div class="idc-body c">
      ${photo(c, spec, "PORTRAIT")}
      <div class="idc-name" style="margin-top:.4mm">${escapeHtml(c.studentName)}</div>
      ${idBlock(c, spec, true)}
      ${spec.extra ? spec.extra(c) : ""}
      <div style="width:100%;text-align:start">${rowsTable(spec.rows(c))}</div>
      <div class="idc-between idc-push">
        ${qr(c)}
        ${signature(c)}
      </div>
    </div>
    ${footer(spec, c)}`;
}

/** 86 × 54 mm — two columns: photo beside the identity block. */
function landscape(spec: TemplateSpec, c: CardContext): string {
  return `
    ${header(spec, c, "LANDSCAPE")}
    ${titlebar(spec, c, "LANDSCAPE")}
    ${spec.strip ? '<div class="idc-strip"></div>' : ""}
    <div class="idc-body">
      <div class="idc-cols">
        <div style="display:flex;flex-direction:column;align-items:center;gap:1mm">
          ${photo(c, spec, "LANDSCAPE")}
          ${qr(c, true)}
        </div>
        <div class="idc-col">
          <div class="idc-name sm">${escapeHtml(c.studentName)}</div>
          <div style="margin-top:.6mm">${idBlock(c, spec, false)}</div>
          ${spec.extra ? `<div style="margin-top:.6mm">${spec.extra(c)}</div>` : ""}
          <div style="margin-top:.8mm">${rowsTable(spec.rows(c))}</div>
          <div class="idc-push" style="display:flex;justify-content:flex-end;padding-top:.6mm">
            ${signature(c)}
          </div>
        </div>
      </div>
    </div>
    ${footer(spec, c)}`;
}

// ── Template specs ────────────────────────────────────────────────────────

const studentRows = (c: CardContext): [string, string][] => [
  ["Class", c.className],
  ["Section", c.section],
  ["Academic Year", c.academicYear],
];

const SPECS: TemplateSpec[] = [
  {
    id: "modern-blue", name: "Modern Blue", cardType: "STUDENT_ID", accent: "#1d4ed8",
    header: "gradient-center", titlebar: true, strip: false, pillOutline: false,
    footer: "accent", photo: "md", rows: studentRows,
  },
  {
    id: "classic", name: "Classic Style", cardType: "STUDENT_ID", accent: "#0f766e",
    header: "gradient-left", titlebar: true, strip: true, pillOutline: true,
    footer: "light", photo: "sm",
    rows: (c) => [...studentRows(c), ["Guardian", c.guardianName]],
  },
  {
    id: "minimal", name: "Minimal Style", cardType: "STUDENT_ID", accent: "#334155",
    header: "plain", titlebar: false, strip: false, pillOutline: true,
    footer: "none", photo: "sm",
    rows: (c) => [["Class", c.className], ["Section", c.section], ["Year", c.academicYear]],
  },
  {
    id: "premium", name: "Premium Style", cardType: "STUDENT_ID", accent: "#6d28d9",
    header: "tall", titlebar: true, strip: false, pillOutline: false,
    footer: "accent", photo: "md", rows: studentRows,
    extra: (c) =>
      `<div class="idc-lbl">Valid for ${escapeHtml(c.academicYear)}</div>`,
  },
  {
    id: "photo-focused", name: "Photo Focused", cardType: "STUDENT_ID", accent: "#b91c1c",
    header: "gradient-left", titlebar: false, strip: true, pillOutline: false,
    footer: "accent", photo: "lg",
    rows: (c) => [["Class", c.className], ["Section", c.section], ["Year", c.academicYear]],
  },
  {
    id: "exam-office", name: "Exam Card — Blue", cardType: "EXAM_CARD", accent: "#1e40af",
    header: "gradient-center", titlebar: true, strip: false, pillOutline: true,
    footer: "accent", photo: "sm",
    rows: (c) => [
      ["Exam", c.examName], ["Session", c.examSession], ["Date", c.examDate],
      ["Class", c.className], ["Section", c.section],
    ],
  },
  {
    id: "exam-academic", name: "Exam Card — Academic", cardType: "EXAM_CARD", accent: "#155e75",
    header: "gradient-left", titlebar: true, strip: true, pillOutline: true,
    footer: "light", photo: "sm",
    rows: (c) => [
      ["Exam", c.examName], ["Date", c.examDate],
      ["Class", c.className], ["Academic Year", c.academicYear],
    ],
  },
  {
    id: "clearance-official", name: "Clearance Card", cardType: "CLEARANCE_CARD", accent: "#047857",
    header: "gradient-center", titlebar: true, strip: false, pillOutline: true,
    footer: "accent", photo: "sm",
    rows: (c) => [
      ["Class", c.className], ["Section", c.section],
      ["Academic Year", c.academicYear], ["Issued", c.issueDate],
    ],
    extra: (c) => {
      const s = (c.clearanceStatus || "Pending").toUpperCase();
      const tone = s.includes("CLEAR")
        ? { bg: "#dcfce7", fg: "#166534" }
        : s.includes("PEND")
          ? { bg: "#fef9c3", fg: "#854d0e" }
          : { bg: "#fee2e2", fg: "#991b1b" };
      return `<div class="idc-badge" style="background:${tone.bg};color:${tone.fg}">${escapeHtml(
        c.clearanceStatus || "Pending",
      )}</div>`;
    },
  },
  {
    id: "custom-basic", name: "Custom Card", cardType: "CUSTOM_CARD", accent: "#c2410c",
    header: "gradient-left", titlebar: true, strip: false, pillOutline: true,
    footer: "light", photo: "sm",
    rows: (c) => [
      ["Class", c.className],
      ["Detail", c.customLine1],
      ["Note", c.customLine2],
      ["Valid", c.academicYear],
    ],
  },
];

/**
 * Every template renders in BOTH orientations from the same spec, so a school
 * can print any card portrait or landscape without losing the design — the
 * layout functions rearrange the same blocks rather than each template owning
 * a hand-tuned copy per orientation.
 */
export const CARD_TEMPLATES: CardTemplate[] = SPECS.map((spec) => ({
  id: spec.id,
  name: spec.name,
  cardType: spec.cardType,
  accent: spec.accent,
  usesPhoto: true,
  render: (c: CardContext, o: CardOrientation) =>
    o === "PORTRAIT" ? portrait(spec, c) : landscape(spec, c),
}));

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
