"use client";

import { schoolBranding } from "@/lib/settings/store";

/** The four certificate looks a school can choose from. */
export type CertificateDesign = "CLASSIC" | "MODERN" | "ROYAL" | "HERITAGE";

export const CERTIFICATE_DESIGNS: {
  id: CertificateDesign;
  name: string;
  hint: string;
  accent: string;
}[] = [
  { id: "CLASSIC", name: "Classic Gold", hint: "Cream paper, double gold border, gold seal", accent: "#b8860b" },
  { id: "MODERN", name: "Modern", hint: "Clean white with bold colour bands", accent: "#4f46e5" },
  { id: "ROYAL", name: "Royal Navy", hint: "Deep navy frame with gold lettering", accent: "#c9a227" },
  { id: "HERITAGE", name: "Heritage", hint: "Geometric border, green and gold", accent: "#047857" },
];

/** Everything on a certificate a school can change. */
export interface CertificateSettings {
  design: CertificateDesign;
  /** The colour the design is drawn in; empty = the design's own. */
  accent: string;
  title: string;
  subtitle: string;
  /** The line under the name, with {placeholders}. */
  body: string;
  signatory1Name: string;
  signatory1Title: string;
  signatory2Name: string;
  signatory2Title: string;
  numberPrefix: string;
  /** "Bismillah" line above the title. */
  showBismillah: boolean;
  showPhoto: boolean;
  showSeal: boolean;
}

export const DEFAULT_CERTIFICATE: CertificateSettings = {
  design: "CLASSIC",
  accent: "",
  title: "Certificate of Graduation",
  subtitle: "This certificate is proudly presented to",
  body:
    "for successfully completing {class} at {school} in the academic year {year}, having fulfilled all the requirements set by the school.",
  signatory1Name: "",
  signatory1Title: "Principal",
  signatory2Name: "",
  signatory2Title: "Head of Academics",
  numberPrefix: "CERT",
  showBismillah: false,
  showPhoto: false,
  showSeal: true,
};

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
  photoUrl?: string | null;
}

export interface IssueDetails {
  /** YYYY-MM-DD. */
  date: string;
  /** Optional grade / result line, e.g. "Excellent" or "A". */
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
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
}

export function certificateNumber(s: CertificateSettings, st: CertificateStudent, issue: IssueDetails): string {
  const prefix = s.numberPrefix.trim() || "CERT";
  return `${prefix}-${issue.date.slice(0, 4)}-${st.code}`;
}

/** The body line, escaped, with {placeholders} filled in bold. */
function bodyHtml(s: CertificateSettings, st: CertificateStudent, issue: IssueDetails): string {
  const cls = [st.className, st.section].filter(Boolean).join(" - ");
  const values: Record<string, string> = {
    "{name}": st.fullName,
    "{code}": st.code,
    "{class}": cls,
    "{year}": st.academicYear,
    "{school}": schoolBranding().name.trim(),
    "{date}": longDate(issue.date),
    "{grade}": issue.grade?.trim() || "",
  };
  return esc(s.body).replace(/\{[a-zA-Z]+\}/g, (k) =>
    k in values ? `<strong>${esc(values[k])}</strong>` : k,
  );
}

function accentOf(s: CertificateSettings): string {
  const own = CERTIFICATE_DESIGNS.find((d) => d.id === s.design)!.accent;
  return /^#[0-9a-fA-F]{6}$/.test(s.accent.trim()) ? s.accent.trim() : own;
}

/** One certificate, as a sheet. */
function certificatePage(s: CertificateSettings, st: CertificateStudent, issue: IssueDetails): string {
  const b = schoolBranding();
  const logo = b.logoUrl ? `<img class="logo" src="${esc(b.logoUrl)}" alt="" />` : "";
  const photo = s.showPhoto && st.photoUrl ? `<img class="photo" src="${esc(st.photoUrl)}" alt="" />` : "";
  const sig = (name: string, title: string) =>
    title.trim() || name.trim()
      ? `<div class="sig"><div class="sig-name">${esc(name)}</div><div class="sig-line"></div><div class="sig-title">${esc(title)}</div></div>`
      : `<div class="sig"></div>`;
  const seal = s.showSeal
    ? `<div class="seal"><div class="seal-in"><span>${esc(b.name.trim().split(/\s+/).slice(0, 2).join(" "))}</span><b>OFFICIAL</b></div></div>`
    : `<div class="seal-gap"></div>`;
  const grade = issue.grade?.trim() && !s.body.includes("{grade}")
    ? `<div class="grade">Result: <strong>${esc(issue.grade.trim())}</strong></div>`
    : "";

  return `<section class="cert d-${s.design.toLowerCase()}" style="--acc:${accentOf(s)}">
  <div class="frame">
    <div class="corner tl"></div><div class="corner tr"></div><div class="corner bl"></div><div class="corner br"></div>
    <div class="inner">
      <header class="head">
        ${logo}
        <div class="school">${esc(b.name)}</div>
        ${b.tagline ? `<div class="tagline">${esc(b.tagline)}</div>` : ""}
      </header>
      ${s.showBismillah ? `<div class="bismillah">بسم الله الرحمن الرحيم</div>` : ""}
      <h1 class="title">${esc(s.title)}</h1>
      <div class="subtitle">${esc(s.subtitle)}</div>
      ${photo}
      <div class="name">${esc(st.fullName)}</div>
      <div class="rule"></div>
      <p class="body">${bodyHtml(s, st, issue)}</p>
      ${grade}
      <footer class="foot">
        ${sig(s.signatory1Name, s.signatory1Title)}
        ${seal}
        ${sig(s.signatory2Name, s.signatory2Title)}
      </footer>
      <div class="meta">
        <span>Certificate No. <b>${esc(certificateNumber(s, st, issue))}</b></span>
        <span>Student ID <b>${esc(st.code)}</b></span>
        <span>Date of Issue <b>${esc(longDate(issue.date))}</b></span>
      </div>
    </div>
  </div>
</section>`;
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&family=Great+Vibes&family=Playfair+Display:ital,wght@0,600;1,500&family=Inter:wght@400;600&display=swap');
@page { size: A4 landscape; margin: 0; }
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
html, body { margin: 0; padding: 0; background: #e5e7eb; }
.cert { width: 297mm; height: 210mm; position: relative; overflow: hidden; margin: 0 auto; page-break-after: always; break-after: page; font-family: 'Inter', Arial, sans-serif; color: #1f2937; }
.cert:last-child { page-break-after: auto; break-after: auto; }
@media screen { .cert { margin: 16px auto; box-shadow: 0 10px 30px rgba(0,0,0,.18); } }
.frame { position: absolute; inset: 10mm; }
.inner { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; text-align: center; padding: 12mm 20mm 8mm; }
.head { display: flex; flex-direction: column; align-items: center; gap: 2mm; }
.logo { width: 22mm; height: 22mm; object-fit: contain; }
.school { font-family: 'Cinzel', Georgia, serif; font-weight: 700; font-size: 17pt; letter-spacing: .06em; text-transform: uppercase; }
.tagline { font-size: 9.5pt; opacity: .75; font-style: italic; }
.bismillah { margin-top: 3mm; font-size: 15pt; font-family: 'Amiri', 'Traditional Arabic', serif; }
.title { margin: 5mm 0 0; font-family: 'Cinzel', Georgia, serif; font-size: 30pt; letter-spacing: .08em; text-transform: uppercase; color: var(--acc); }
.subtitle { margin-top: 3mm; font-size: 12pt; letter-spacing: .12em; text-transform: uppercase; opacity: .8; }
.photo { width: 24mm; height: 28mm; object-fit: cover; border-radius: 3mm; margin-top: 3mm; border: 1.2mm solid var(--acc); }
.name { margin-top: 4mm; font-family: 'Great Vibes', 'Brush Script MT', cursive; font-size: 46pt; line-height: 1.05; color: #111827; }
.rule { width: 120mm; height: .6mm; margin: 2mm auto 0; background: linear-gradient(90deg, transparent, var(--acc), transparent); }
.body { max-width: 205mm; margin: 5mm auto 0; font-family: 'Playfair Display', Georgia, serif; font-size: 13pt; line-height: 1.55; }
.body strong { color: #111827; }
.grade { margin-top: 2mm; font-size: 12pt; }
.foot { margin-top: auto; width: 100%; display: grid; grid-template-columns: 1fr 34mm 1fr; align-items: end; gap: 10mm; }
.sig { display: flex; flex-direction: column; align-items: center; min-height: 18mm; justify-content: flex-end; }
.sig-name { font-family: 'Great Vibes', cursive; font-size: 18pt; min-height: 7mm; }
.sig-line { width: 62mm; border-top: .35mm solid #374151; margin-top: 1mm; }
.sig-title { margin-top: 1.5mm; font-size: 10pt; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; }
.seal, .seal-gap { width: 34mm; height: 34mm; }
.seal { border-radius: 50%; background: radial-gradient(circle at 35% 30%, #fff6, transparent 45%), var(--acc); display: flex; align-items: center; justify-content: center; box-shadow: 0 0 0 1.2mm #fff, 0 0 0 1.8mm var(--acc); }
.seal-in { width: 26mm; height: 26mm; border-radius: 50%; border: .5mm dashed #ffffffcc; color: #fff; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 6.5pt; text-transform: uppercase; letter-spacing: .06em; padding: 2mm; text-align: center; line-height: 1.2; }
.seal-in b { font-size: 8pt; margin-top: 1mm; letter-spacing: .14em; }
.meta { width: 100%; display: flex; justify-content: space-between; margin-top: 4mm; font-size: 8.5pt; opacity: .75; }
.corner { position: absolute; width: 22mm; height: 22mm; }

/* ── Classic Gold ── */
.d-classic { background: #fdf8ec; }
.d-classic .frame { border: 1.6mm double var(--acc); outline: .5mm solid var(--acc); outline-offset: 2.2mm; }
.d-classic .inner::before { content: ""; position: absolute; inset: 4mm; border: .3mm solid color-mix(in srgb, var(--acc) 50%, transparent); pointer-events: none; }
.d-classic .corner { border-color: var(--acc); border-style: solid; }
.d-classic .tl { top: 3mm; left: 3mm; border-width: 1.2mm 0 0 1.2mm; }
.d-classic .tr { top: 3mm; right: 3mm; border-width: 1.2mm 1.2mm 0 0; }
.d-classic .bl { bottom: 3mm; left: 3mm; border-width: 0 0 1.2mm 1.2mm; }
.d-classic .br { bottom: 3mm; right: 3mm; border-width: 0 1.2mm 1.2mm 0; }
.d-classic .school { color: #4b3b12; }

/* ── Modern ── */
.d-modern { background: #ffffff; }
.d-modern::before, .d-modern::after { content: ""; position: absolute; width: 150mm; height: 150mm; background: var(--acc); transform: rotate(45deg); }
.d-modern::before { top: -118mm; left: -95mm; }
.d-modern::after { bottom: -118mm; right: -95mm; opacity: .92; }
.d-modern .frame { border: .5mm solid #e5e7eb; z-index: 1; }
.d-modern .tl { top: -10mm; right: 30mm; width: 60mm; height: 6mm; background: color-mix(in srgb, var(--acc) 35%, #fff); }
.d-modern .title { font-family: 'Inter', Arial, sans-serif; font-weight: 600; letter-spacing: .22em; font-size: 26pt; }
.d-modern .name { font-family: 'Playfair Display', Georgia, serif; font-style: italic; font-size: 40pt; }
.d-modern .rule { background: var(--acc); width: 60mm; height: 1mm; border-radius: 1mm; }

/* ── Royal Navy ── */
.d-royal { background: #0f1d3d; color: #f3e7c3; }
.d-royal .frame { background: #fffdf6; border: 2mm solid var(--acc); box-shadow: 0 0 0 1mm #0f1d3d, 0 0 0 1.8mm var(--acc); color: #1f2937; }
.d-royal .inner::before { content: ""; position: absolute; inset: 3.5mm; border: .4mm solid var(--acc); pointer-events: none; }
.d-royal .title { color: #0f1d3d; }
.d-royal .title::after { content: ""; display: block; width: 40mm; height: .8mm; margin: 2mm auto 0; background: var(--acc); }
.d-royal .corner { width: 14mm; height: 14mm; background: var(--acc); transform: rotate(45deg); }
.d-royal .tl { top: -7mm; left: -7mm; } .d-royal .tr { top: -7mm; right: -7mm; }
.d-royal .bl { bottom: -7mm; left: -7mm; } .d-royal .br { bottom: -7mm; right: -7mm; }
.d-royal .school { color: #0f1d3d; }

/* ── Heritage ── */
.d-heritage { background: #fbfaf5; }
.d-heritage .frame {
  border: 7mm solid transparent;
  border-image: repeating-linear-gradient(45deg, var(--acc) 0 3mm, #d4af37 3mm 4.2mm, #fbfaf5 4.2mm 6mm) 12;
}
.d-heritage .inner::before { content: ""; position: absolute; inset: 2.5mm; border: .5mm solid #d4af37; pointer-events: none; }
.d-heritage .corner { width: 16mm; height: 16mm; border: .8mm solid #d4af37; background: color-mix(in srgb, var(--acc) 12%, #fff); transform: rotate(45deg); }
.d-heritage .tl { top: 4mm; left: 4mm; } .d-heritage .tr { top: 4mm; right: 4mm; }
.d-heritage .bl { bottom: 4mm; left: 4mm; } .d-heritage .br { bottom: 4mm; right: 4mm; }
.d-heritage .title { color: var(--acc); }
.d-heritage .seal { background: radial-gradient(circle at 35% 30%, #fff6, transparent 45%), #b8860b; box-shadow: 0 0 0 1.2mm #fff, 0 0 0 1.8mm #b8860b; }
`;

/**
 * The certificates as one printable page — one sheet per student, A4
 * landscape — so a whole class prints in a single run.
 */
export function certificatesHtml(
  s: CertificateSettings,
  students: CertificateStudent[],
  issue: IssueDetails,
): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${esc(s.title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Amiri&display=swap" rel="stylesheet"/>
<style>${CSS}</style></head><body>
${students.map((st) => certificatePage(s, st, issue)).join("\n")}
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
  // Fonts and the logo must load first or the sheet prints in fallbacks.
  w.onload = () => setTimeout(() => w.print(), 600);
  return true;
}
