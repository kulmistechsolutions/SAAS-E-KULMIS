"use client";

import { schoolBranding } from "@/lib/settings/store";
import {
  FONT_LINK,
  newElementId,
  renderDesign,
  type CardDesign,
  type CardElement,
  type FieldKey,
} from "@/lib/id-cards/elements";
import type { CardContext } from "@/lib/id-cards/types";

/** A4 landscape, in millimetres — the certificate's canvas. */
export const CERT_W = 297;
export const CERT_H = 210;

/** The four frames a certificate can sit in. */
export type CertificateDesign = "CLASSIC" | "MODERN" | "ROYAL" | "HERITAGE";

export const CERTIFICATE_DESIGNS: {
  id: CertificateDesign;
  name: string;
  hint: string;
  accent: string;
}[] = [
  { id: "CLASSIC", name: "Classic Gold", hint: "Cream paper, double gold border", accent: "#b8860b" },
  { id: "MODERN", name: "Modern", hint: "Clean white with bold colour bands", accent: "#4f46e5" },
  { id: "ROYAL", name: "Royal Navy", hint: "Deep navy frame, gold trim", accent: "#c9a227" },
  { id: "HERITAGE", name: "Heritage", hint: "Geometric border, green and gold", accent: "#047857" },
];

/**
 * The fields a certificate offers, mapped onto the card engine's keys so the
 * ID-card designer edits certificates too. The words a school types (title,
 * text under the name, grade) ride in the card's spare text slots.
 */
export const CERTIFICATE_FIELDS: { key: FieldKey; label: string }[] = [
  { key: "studentName", label: "Student Name" },
  { key: "cardTitle", label: "Certificate Title" },
  { key: "footerText", label: "Line above the name" },
  { key: "customLine1", label: "Certificate text" },
  { key: "customLine2", label: "Grade / Result" },
  { key: "studentId", label: "Student ID" },
  { key: "className", label: "Class" },
  { key: "section", label: "Section" },
  { key: "academicYear", label: "Academic Year" },
  { key: "dob", label: "Date of Birth" },
  { key: "guardianName", label: "Parent / Guardian" },
  { key: "idLabel", label: "Certificate No." },
  { key: "issueDate", label: "Date of Issue" },
  { key: "schoolName", label: "School Name" },
  { key: "schoolMotto", label: "School Motto" },
  { key: "schoolAddress", label: "School Address" },
  { key: "schoolPhone", label: "School Phone" },
  { key: "principalName", label: "Principal Name" },
];

/** Everything the school sets on its certificate. */
export interface CertificateSettings {
  design: CertificateDesign;
  /** The colour the frame and accents use; empty = the frame's own. */
  accent: string;
  title: string;
  subtitle: string;
  /** The text under the name, with {placeholders}. */
  body: string;
  numberPrefix: string;
  /** Every item on the sheet, where the school put it. */
  layout: CardDesign;
}

export const CERTIFICATE_PLACEHOLDERS: { key: string; meaning: string }[] = [
  { key: "{name}", meaning: "Student's full name" },
  { key: "{code}", meaning: "Student ID" },
  { key: "{class}", meaning: "Class and section" },
  { key: "{year}", meaning: "Academic year" },
  { key: "{school}", meaning: "School name" },
  { key: "{date}", meaning: "Date of issue" },
  { key: "{grade}", meaning: "Grade / result typed when issuing" },
];

export interface CertificateStudent {
  id: string;
  code: string;
  fullName: string;
  className: string;
  section?: string | null;
  academicYear: string;
  dob?: string | null;
  guardianName?: string | null;
  photoUrl?: string | null;
}

export interface IssueDetails {
  /** YYYY-MM-DD. */
  date: string;
  grade?: string;
}

function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function longDate(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
}

export function accentOf(s: Pick<CertificateSettings, "design" | "accent">): string {
  const own = CERTIFICATE_DESIGNS.find((d) => d.id === s.design)!.accent;
  return /^#[0-9a-fA-F]{6}$/.test(s.accent.trim()) ? s.accent.trim() : own;
}

export function certificateNumber(s: CertificateSettings, st: CertificateStudent, issue: IssueDetails): string {
  return `${s.numberPrefix.trim() || "CERT"}-${issue.date.slice(0, 4)}-${st.code}`;
}

/** A round official seal as an SVG picture, drawn in the certificate's colour. */
export function sealDataUrl(colour: string, schoolName: string): string {
  const name = schoolName.trim().toUpperCase().slice(0, 34).replace(/[<&>"]/g, "");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <defs><path id="c" d="M100,100 m-70,0 a70,70 0 1,1 140,0 a70,70 0 1,1 -140,0"/></defs>
  <circle cx="100" cy="100" r="96" fill="${colour}"/>
  <circle cx="100" cy="100" r="88" fill="none" stroke="#fff" stroke-width="3"/>
  <circle cx="100" cy="100" r="52" fill="none" stroke="#fff" stroke-width="2" stroke-dasharray="4 4"/>
  <text font-family="Georgia,serif" font-size="15" font-weight="bold" fill="#fff" letter-spacing="2"><textPath href="#c" startOffset="50%" text-anchor="middle">${name}</textPath></text>
  <text x="100" y="96" text-anchor="middle" font-family="Georgia,serif" font-size="20" font-weight="bold" fill="#fff">OFFICIAL</text>
  <text x="100" y="120" text-anchor="middle" font-family="Georgia,serif" font-size="14" fill="#fff">SEAL</text>
</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/** The items a fresh certificate starts with, laid out for A4 landscape. */
export function defaultLayout(design: CertificateDesign, accent: string): CardDesign {
  const school = schoolBranding().name;
  const el = (p: Partial<CardElement> & Pick<CardElement, "type" | "x" | "y" | "w" | "h">): CardElement => ({
    id: newElementId(p.type),
    ...p,
  });
  const dark = design === "ROYAL" ? "#0f1d3d" : "#1f2937";
  return {
    width: CERT_W,
    height: CERT_H,
    accent,
    elements: [
      el({ type: "logo", x: 136.5, y: 19, w: 24, h: 24 }),
      el({ type: "field", field: "schoolName", x: 30, y: 44, w: 237, h: 10, fontSize: 17, bold: true, uppercase: true, letterSpacing: 0.06, align: "center", color: dark, font: "display" }),
      el({ type: "field", field: "schoolMotto", x: 48, y: 54, w: 201, h: 6, fontSize: 9.5, italic: true, align: "center", color: "#64748b" }),
      el({ type: "field", field: "cardTitle", x: 20, y: 63, w: 257, h: 16, fontSize: 30, bold: true, uppercase: true, letterSpacing: 0.08, align: "center", color: "accent", font: "display" }),
      el({ type: "field", field: "footerText", x: 48, y: 81, w: 201, h: 7, fontSize: 11.5, uppercase: true, letterSpacing: 0.12, align: "center", color: "#475569" }),
      el({ type: "field", field: "studentName", x: 28, y: 89, w: 241, h: 24, fontSize: 44, align: "center", color: "#111827", font: "script" }),
      el({ type: "line", x: 88, y: 114, w: 121, h: 0.5, borderColor: "accent" }),
      el({ type: "field", field: "customLine1", x: 43, y: 118, w: 211, h: 24, fontSize: 13, align: "center", valign: "top", color: "#1f2937", font: "serif" }),
      el({ type: "field", field: "customLine2", x: 88, y: 142, w: 121, h: 7, fontSize: 11, bold: true, align: "center", color: "accent" }),
      el({ type: "signature", x: 38, y: 156, w: 72, h: 18, fontSize: 10, align: "center", color: "#334155", text: "Principal", borderColor: "#334155" }),
      el({ type: "image", x: 131, y: 148, w: 35, h: 35, src: sealDataUrl(accent, school), fit: "contain", ratio: 1 }),
      el({ type: "signature", x: 187, y: 156, w: 72, h: 18, fontSize: 10, align: "center", color: "#334155", text: "Head of Academics", borderColor: "#334155" }),
      el({ type: "field", field: "idLabel", x: 28, y: 186, w: 100, h: 5, fontSize: 8, color: "#64748b" }),
      el({ type: "field", field: "issueDate", x: 169, y: 186, w: 100, h: 5, fontSize: 8, align: "right", color: "#64748b" }),
    ],
  };
}

export function defaultSettings(design: CertificateDesign = "CLASSIC"): CertificateSettings {
  const accent = CERTIFICATE_DESIGNS.find((d) => d.id === design)!.accent;
  return {
    design,
    accent: "",
    title: "Certificate of Graduation",
    subtitle: "This certificate is proudly presented to",
    body:
      "for successfully completing {class} at {school} in the academic year {year}, having fulfilled all the requirements set by the school.",
    numberPrefix: "CERT",
    layout: defaultLayout(design, accent),
  };
}

/** The values one student's certificate shows, in the card engine's shape. */
export function certificateContext(
  s: CertificateSettings,
  st: CertificateStudent,
  issue: IssueDetails,
): CardContext {
  const b = schoolBranding();
  const cls = [st.className, st.section].filter(Boolean).join(" - ");
  const values: Record<string, string> = {
    "{name}": st.fullName,
    "{code}": st.code,
    "{class}": cls,
    "{year}": st.academicYear,
    "{school}": b.name.trim(),
    "{date}": longDate(issue.date),
    "{grade}": issue.grade?.trim() || "",
  };
  const body = s.body.replace(/\{[a-zA-Z]+\}/g, (k) => (k in values ? values[k]! : k));
  return {
    studentId: st.code,
    studentName: st.fullName,
    className: st.className,
    section: st.section ?? "",
    academicYear: st.academicYear,
    gender: "",
    dob: st.dob ? longDate(st.dob) : "",
    photoDataUrl: st.photoUrl ?? null,
    guardianName: st.guardianName ?? "",
    guardianPhone: "",
    schoolName: b.name,
    schoolMotto: b.tagline ?? "",
    schoolAddress: [b.address, b.city].filter(Boolean).join(", "),
    schoolPhone: b.phone ?? "",
    schoolEmail: b.email ?? "",
    schoolWebsite: b.website ?? "",
    logoDataUrl: b.logoUrl ?? null,
    principalName: b.principalName ?? "",
    accent: accentOf(s),
    cardTitle: s.title,
    idLabel: `Certificate No. ${certificateNumber(s, st, issue)}`,
    footerText: s.subtitle,
    issueDate: `Date of Issue: ${longDate(issue.date)}`,
    qrDataUrl: null,
    examName: "",
    examDate: "",
    examSession: "",
    examOffice: "",
    clearanceStatus: "",
    clearanceDetail: "",
    customLine1: body,
    customLine2: issue.grade?.trim() ? `Result: ${issue.grade.trim()}` : "",
  };
}

/**
 * The frame alone — border, corners, paper colour — drawn under the items.
 * Everything with words on it is a movable item; the frame is not.
 */
export function frameHtml(design: CertificateDesign, accent: string): string {
  const A = accent;
  const box = (style: string) => `<div style="position:absolute;${style}"></div>`;
  switch (design) {
    case "MODERN":
      return [
        box(`inset:0;background:#ffffff`),
        box(`width:150mm;height:150mm;background:${A};transform:rotate(45deg);top:-118mm;left:-95mm`),
        box(`width:150mm;height:150mm;background:${A};opacity:.92;transform:rotate(45deg);bottom:-118mm;right:-95mm`),
        box(`width:70mm;height:5mm;background:${A};opacity:.3;top:8mm;right:30mm;border-radius:3mm`),
        box(`width:70mm;height:5mm;background:${A};opacity:.3;bottom:8mm;left:30mm;border-radius:3mm`),
        box(`inset:10mm;border:0.5mm solid #e5e7eb`),
      ].join("");
    case "ROYAL":
      return [
        box(`inset:0;background:#0f1d3d`),
        box(`inset:8mm;background:#fffdf6;border:2mm solid ${A};box-shadow:0 0 0 1mm #0f1d3d,0 0 0 1.8mm ${A}`),
        box(`inset:13mm;border:0.4mm solid ${A}`),
        ...[
          "top:3mm;left:3mm",
          "top:3mm;right:3mm",
          "bottom:3mm;left:3mm",
          "bottom:3mm;right:3mm",
        ].map((p) => box(`${p};width:12mm;height:12mm;background:${A};transform:rotate(45deg)`)),
      ].join("");
    case "HERITAGE":
      return [
        box(`inset:0;background:#fbfaf5`),
        box(
          `inset:8mm;border:7mm solid transparent;border-image:repeating-linear-gradient(45deg,${A} 0 3mm,#d4af37 3mm 4.2mm,#fbfaf5 4.2mm 6mm) 12`,
        ),
        box(`inset:17.5mm;border:0.5mm solid #d4af37`),
        ...[
          "top:12mm;left:12mm",
          "top:12mm;right:12mm",
          "bottom:12mm;left:12mm",
          "bottom:12mm;right:12mm",
        ].map((p) =>
          box(`${p};width:14mm;height:14mm;border:0.8mm solid #d4af37;background:#ffffff;transform:rotate(45deg)`),
        ),
      ].join("");
    case "CLASSIC":
    default:
      return [
        box(`inset:0;background:#fdf8ec`),
        box(`inset:8mm;border:1.6mm double ${A}`),
        box(`inset:12mm;border:0.5mm solid ${A}`),
        box(`inset:15mm;border:0.3mm solid ${A};opacity:.45`),
        ...[
          "top:10.5mm;left:10.5mm;border-width:1.2mm 0 0 1.2mm",
          "top:10.5mm;right:10.5mm;border-width:1.2mm 1.2mm 0 0",
          "bottom:10.5mm;left:10.5mm;border-width:0 0 1.2mm 1.2mm",
          "bottom:10.5mm;right:10.5mm;border-width:0 1.2mm 1.2mm 0",
        ].map((p) => box(`${p};width:20mm;height:20mm;border-style:solid;border-color:${A}`)),
      ].join("");
  }
}

/**
 * The certificates as one printable page — one A4 landscape sheet per
 * student — drawn by the same renderer the designer uses, so the paper
 * matches the screen.
 */
export function certificatesHtml(
  s: CertificateSettings,
  students: CertificateStudent[],
  issue: IssueDetails,
): string {
  const accent = accentOf(s);
  const layout = { ...s.layout, accent };
  const pages = students
    .map(
      (st) =>
        `<section class="cert">${frameHtml(s.design, accent)}${renderDesign(layout, certificateContext(s, st, issue))}</section>`,
    )
    .join("\n");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${esc(s.title)}</title>
<link rel="stylesheet" href="${FONT_LINK}"/>
<style>
  @page { size: A4 landscape; margin: 0; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { margin: 0; padding: 0; background: #e5e7eb; font-family: 'Inter', Arial, sans-serif; }
  .cert { position: relative; width: ${CERT_W}mm; height: ${CERT_H}mm; overflow: hidden; margin: 0 auto; background: #fff; page-break-after: always; break-after: page; }
  .cert:last-child { page-break-after: auto; break-after: auto; }
  @media screen { .cert { margin: 16px auto; box-shadow: 0 10px 30px rgba(0,0,0,.18); } }
</style></head><body>
${pages}
</body></html>`;
}

/** Open the print dialog on the certificates (Save as PDF from there). */
export function printCertificates(
  s: CertificateSettings,
  students: CertificateStudent[],
  issue: IssueDetails,
): boolean {
  const w = window.open("", "_blank", "width=1200,height=900");
  if (!w) return false;
  w.document.write(certificatesHtml(s, students, issue));
  w.document.close();
  w.focus();
  // The fonts and pictures must arrive before the dialog, or the sheet
  // prints in fallbacks with holes where the logo and photo go.
  w.onload = () => setTimeout(() => w.print(), 700);
  return true;
}
