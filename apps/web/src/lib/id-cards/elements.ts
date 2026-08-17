"use client";

import type { CardContext } from "./types";
import { darken } from "./templates";

/**
 * A card is a list of absolutely positioned elements on a millimetre grid.
 *
 * Everything — the header band, the photo, each label and each value — is an
 * element with its own x/y/w/h in millimetres. That is what makes the designer
 * possible (any item can be dragged, resized or deleted), and it is also why
 * alignment is now exact: nothing is positioned by flex-flow side effects, so
 * two fields line up because they genuinely share a coordinate.
 *
 * The SAME renderer draws the editor canvas, the preview and the print sheet,
 * so a card can never look different in the printer than on screen.
 */

export type ElementType =
  | "text"
  | "field"
  | "photo"
  | "logo"
  | "qr"
  | "signature"
  | "box"
  | "line"
  | "watermark";

/** Dynamic values a `field` element can bind to (PRD §6). */
export const FIELD_KEYS = [
  "studentName", "studentId", "className", "section", "academicYear",
  "gender", "dob", "guardianName", "guardianPhone",
  "schoolName", "schoolMotto", "schoolAddress", "schoolPhone", "schoolEmail",
  "schoolWebsite", "principalName", "cardTitle", "idLabel", "footerText",
  "issueDate", "examName", "examDate", "examSession", "examOffice",
  "clearanceStatus", "customLine1", "customLine2",
] as const;

export type FieldKey = (typeof FIELD_KEYS)[number];

export const FIELD_LABELS: Record<FieldKey, string> = {
  studentName: "Student Name", studentId: "Student ID (permanent)",
  className: "Class", section: "Section", academicYear: "Academic Year",
  gender: "Gender", dob: "Date of Birth",
  guardianName: "Guardian Name", guardianPhone: "Guardian Phone",
  schoolName: "School Name", schoolMotto: "School Motto",
  schoolAddress: "School Address", schoolPhone: "School Phone",
  schoolEmail: "School Email", schoolWebsite: "School Website",
  principalName: "Principal / Officer Name", cardTitle: "Card Title",
  idLabel: "ID Label", footerText: "Footer Text", issueDate: "Issue Date",
  examName: "Exam Name", examDate: "Exam Date", examSession: "Exam Session",
  examOffice: "Exam Office", clearanceStatus: "Clearance Status",
  customLine1: "Custom Line 1", customLine2: "Custom Line 2",
};

/** `accent`/`accentDark` follow the card's colour; anything else is literal. */
export type ColorToken = string;

export interface CardElement {
  id: string;
  type: ElementType;
  /** Millimetres from the card's top-left corner. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Literal text for `text`; ignored for `field`. */
  text?: string;
  field?: FieldKey;
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  align?: "left" | "center" | "right";
  valign?: "top" | "middle" | "bottom";
  color?: ColorToken;
  bg?: ColorToken;
  borderColor?: ColorToken;
  borderWidth?: number;
  radius?: number;
  uppercase?: boolean;
  letterSpacing?: number;
  mono?: boolean;
  opacity?: number;
  /**
   * Watermark image as a data URL. When empty the school's own logo is used,
   * so a school that has uploaded a logo gets a watermark with no extra work.
   */
  src?: string;
  /** Locked elements are skipped by the designer's hit-testing. */
  locked?: boolean;
}

export interface CardDesign {
  /** Card footprint the coordinates are expressed in. */
  width: number;
  height: number;
  accent: string;
  elements: CardElement[];
}

// ── Value resolution ──────────────────────────────────────────────────────

function fieldValue(c: CardContext, key: FieldKey): string {
  const v = (c as unknown as Record<string, unknown>)[key];
  return v === undefined || v === null ? "" : String(v);
}

function color(token: ColorToken | undefined, accent: string, fallback: string): string {
  if (!token) return fallback;
  if (token === "accent") return accent;
  if (token === "accentDark") return darken(accent);
  if (token === "accentGradient") return `linear-gradient(135deg, ${accent}, ${darken(accent)})`;
  return token;
}

function esc(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── Rendering ─────────────────────────────────────────────────────────────

function boxStyle(el: CardElement, accent: string): string {
  const parts = [
    "position:absolute",
    `left:${el.x}mm`,
    `top:${el.y}mm`,
    `width:${el.w}mm`,
    `height:${el.h}mm`,
  ];
  if (el.bg) {
    const bg = color(el.bg, accent, "transparent");
    parts.push(bg.startsWith("linear-gradient") ? `background:${bg}` : `background-color:${bg}`);
  }
  if (el.borderWidth) {
    parts.push(`border:${el.borderWidth}mm solid ${color(el.borderColor, accent, "#e2e8f0")}`);
  }
  if (el.radius) parts.push(`border-radius:${el.radius}mm`);
  if (el.opacity !== undefined) parts.push(`opacity:${el.opacity}`);
  return parts.join(";");
}

function textStyle(el: CardElement, accent: string): string {
  const parts = [
    `font-size:${el.fontSize ?? 5}pt`,
    `color:${color(el.color, accent, "#0f172a")}`,
    `text-align:${el.align ?? "left"}`,
    "line-height:1.15",
    "overflow:hidden",
    "display:flex",
    `justify-content:${el.align === "center" ? "center" : el.align === "right" ? "flex-end" : "flex-start"}`,
    `align-items:${el.valign === "top" ? "flex-start" : el.valign === "bottom" ? "flex-end" : "center"}`,
  ];
  if (el.bold) parts.push("font-weight:700");
  if (el.italic) parts.push("font-style:italic");
  if (el.uppercase) parts.push("text-transform:uppercase");
  if (el.letterSpacing) parts.push(`letter-spacing:${el.letterSpacing}em`);
  if (el.mono) parts.push('font-family:"Courier New",monospace');
  return parts.join(";");
}

function renderOne(el: CardElement, c: CardContext, accent: string): string {
  const base = boxStyle(el, accent);

  switch (el.type) {
    case "box":
      return `<div style="${base}"></div>`;

    case "line":
      return `<div style="${base};background-color:${color(el.borderColor, accent, "#94a3b8")}"></div>`;

    case "photo":
      return c.photoDataUrl
        ? `<img src="${c.photoDataUrl}" alt="" style="${base};object-fit:cover"/>`
        : `<div style="${base};border:0.4mm dashed #cbd5e1;background-color:#f8fafc;color:#94a3b8;display:flex;align-items:center;justify-content:center;font-size:4.2pt;text-align:center;line-height:1.15">NO<br/>PHOTO</div>`;

    case "logo":
      return c.logoDataUrl
        ? `<img src="${c.logoDataUrl}" alt="" style="${base};object-fit:contain"/>`
        : `<div style="${base};display:flex;align-items:center;justify-content:center;font-size:5pt;font-weight:700;color:${color(el.color, accent, "#fff")}">${esc(
            c.schoolName.slice(0, 2).toUpperCase(),
          )}</div>`;

    case "watermark": {
      // Sits behind the content and must never intercept a click in the
      // designer or darken the text it sits under.
      const src = el.src || c.logoDataUrl;
      if (!src) return "";
      return `<img src="${src}" alt="" style="${base};object-fit:contain;pointer-events:none"/>`;
    }

    case "qr":
      return c.qrDataUrl
        ? `<img src="${c.qrDataUrl}" alt="" style="${base}"/>`
        : `<div style="${base};border:0.3mm dashed #cbd5e1"></div>`;

    case "signature": {
      // A rule with the officer's name beneath it — the name is editable text,
      // falling back to whoever is configured as principal.
      const name = el.text?.trim() || c.principalName || "Authorised Signature";
      return `<div style="${base};display:flex;flex-direction:column;justify-content:flex-end">
        <div style="border-top:0.3mm solid ${color(el.borderColor, accent, "#94a3b8")};width:100%"></div>
        <div style="${textStyle({ ...el, align: el.align ?? "center" }, accent)};height:auto;margin-top:.4mm;position:static">${esc(name)}</div>
      </div>`;
    }

    case "field":
      return `<div style="${base};${textStyle(el, accent)}">${esc(
        fieldValue(c, el.field ?? "studentName"),
      )}</div>`;

    case "text":
    default:
      return `<div style="${base};${textStyle(el, accent)}">${esc(el.text ?? "")}</div>`;
  }
}

/** The inner HTML of one card, drawn from its design. */
export function renderDesign(design: CardDesign, c: CardContext): string {
  const accent = c.accent || design.accent;
  return design.elements.map((el) => renderOne(el, c, accent)).join("");
}

// ── Helpers used by the designer ──────────────────────────────────────────

let seq = 0;
export function newElementId(prefix = "el"): string {
  seq += 1;
  return `${prefix}-${Date.now().toString(36)}-${seq}`;
}

export function elementLabel(el: CardElement): string {
  if (el.type === "field") return FIELD_LABELS[el.field ?? "studentName"];
  if (el.type === "text") return el.text?.slice(0, 24) || "Text";
  if (el.type === "signature") return "Signature";
  if (el.type === "watermark") return el.src ? "Watermark (image)" : "Watermark (logo)";
  return el.type.charAt(0).toUpperCase() + el.type.slice(1);
}

/** Keep an element inside the card after a drag or resize. */
export function clampElement(el: CardElement, design: CardDesign): CardElement {
  const w = Math.max(2, Math.min(el.w, design.width));
  const h = Math.max(2, Math.min(el.h, design.height));
  return {
    ...el,
    w,
    h,
    x: Math.max(0, Math.min(el.x, design.width - w)),
    y: Math.max(0, Math.min(el.y, design.height - h)),
  };
}
