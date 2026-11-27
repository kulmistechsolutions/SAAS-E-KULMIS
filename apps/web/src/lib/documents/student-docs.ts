import {
  LETTERHEAD_CSS,
  accentColour,
  documentFooterHtml,
  letterheadHtml,
  signatureHtml,
  stampHtml,
  watermarkHtml,
} from "@/lib/print/letterhead";
import { paperCss, type PaperSize } from "@/lib/print/paper";
import { schoolBranding } from "@/lib/settings/store";
import type { StudentWithParent } from "@/lib/students/types";
import { DESIGN_CSS, DOC_SHELL_CSS, type DocDesign } from "./doc-shell";
export type { DocDesign } from "./doc-shell";

/**
 * The school's official student documents.
 *
 * Every one of these is a view of data that already exists — the student
 * record, the parent record, the school's own branding. Nothing here writes
 * anything, and no figure is retyped: a document showing a class shows the
 * class the student is in today, because it reads it at the moment it is
 * built.
 *
 * The layout is the letterhead every other printed document in the system
 * already uses, so a school's paperwork looks like one school's paperwork
 * rather than eight modules each with their own idea of a header.
 */

export type StudentDocKind =
  | "INFORMATION"
  | "ADMISSION"
  | "TRANSFER"
  | "BONAFIDE";

export interface StudentDocOptions {
  kind: StudentDocKind;
  design: DocDesign;
  paper: PaperSize;
  landscape: boolean;
  /** What to include. Off means absent from the page, not blank. */
  showLogo: boolean;
  showStamp: boolean;
  showQr: boolean;
  showGuardian: boolean;
  showAcademic: boolean;
  /** Rendered as an <img src>; the caller resolves it. */
  qrDataUrl?: string | null;
  /** Reference number printed on letters. */
  reference?: string;
  /**
   * The letter's wording, with {placeholders}. Absent = the system's own
   * text (DEFAULT_LETTER_TEXT).
   */
  bodyText?: string;
  /**
   * The particulars of a transfer, written into the Transfer Certificate:
   * where the student is going, why, and their last day here.
   */
  transfer?: {
    toSchool?: string;
    reason?: string;
    leavingDate?: string;
    conduct?: string;
    feesCleared?: boolean;
  };
}

export const DOC_TITLES: Record<StudentDocKind, string> = {
  INFORMATION: "Student Information Sheet",
  ADMISSION: "Admission Letter",
  TRANSFER: "Transfer Certificate",
  BONAFIDE: "Bonafide Certificate",
};

function escapeHtml(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function dateLong(iso?: string | null): string {
  if (!iso) return "\u2014";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "\u2014";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** A labelled row, or nothing at all when the school never filled it in. */
function row(label: string, value: unknown): string {
  const v = value === null || value === undefined || value === "" ? null : value;
  // An empty row reads as a broken document rather than an incomplete record,
  // which is the same rule the letterhead already follows for contact details.
  if (v === null) return "";
  return `<tr><td class="k">${escapeHtml(label)}</td><td class="v">${escapeHtml(v)}</td></tr>`;
}

function section(title: string, rows: string): string {
  if (!rows.trim()) return "";
  return `<div class="card">
    <div class="sec-head">${escapeHtml(title)}</div>
    <table class="kv">${rows}</table>
  </div>`;
}

/**
 * The body of an information sheet: who the student is, where they sit, and
 * who to call. Three blocks, each of which disappears entirely when it has
 * nothing to say.
 */
function informationBody(s: StudentWithParent, o: StudentDocOptions): string {
  const photo =
    s.photoUrl && o.design !== "MINIMAL"
      ? `<img class="photo" src="${escapeHtml(s.photoUrl)}" alt="" />`
      : "";

  const personal = section(
    "Personal Information",
    row("Student ID", s.code) +
      row("Full Name", s.fullName) +
      row("Date of Birth", s.dob ? dateLong(s.dob) : null) +
      row("Gender", s.gender === "MALE" ? "Male" : "Female") +
      row("Place of Birth", s.placeOfBirth) +
      row("Admission Date", dateLong(s.registrationDate)) +
      row("Status", s.status === "ACTIVE" ? "Active" : "Inactive"),
  );

  const academic = o.showAcademic
    ? section(
        "Academic Information",
        row("Academic Year", s.academicYear) +
          row("Class", s.className) +
          row("Section", s.section) +
          row("District", s.district) +
          row("Village", s.village),
      )
    : "";

  const guardian = o.showGuardian
    ? section(
        "Parent / Guardian",
        row("Parent Name", s.parent?.name) +
          row("Phone", s.parent?.phone) +
          row("Alternative Phone", s.parent?.altPhone) +
          row("Email", s.parent?.email) +
          row("Address", s.parent?.address) +
          row("Occupation", s.parent?.occupation) +
          row("Mother's Name", s.motherName),
      )
    : "";

  return `${photo ? `<div class="with-photo">${photo}<div class="beside">${personal}</div></div>` : personal}
    ${academic}${guardian}`;
}

/** The words a school can put in its letters, and what each becomes. */
export const LETTER_PLACEHOLDERS: { key: string; meaning: string }[] = [
  { key: "{name}", meaning: "Student's full name" },
  { key: "{code}", meaning: "Student ID" },
  { key: "{class}", meaning: "Class and section" },
  { key: "{year}", meaning: "Academic year" },
  { key: "{school}", meaning: "School name" },
  { key: "{admissionDate}", meaning: "Date of admission" },
  { key: "{dob}", meaning: "Date of birth" },
  { key: "{parent}", meaning: "Parent / guardian" },
  { key: "{toSchool}", meaning: "School transferring to" },
  { key: "{leavingDate}", meaning: "Date of leaving" },
  { key: "{reason}", meaning: "Reason for leaving" },
  { key: "{today}", meaning: "Today's date" },
];

/** What each letter says unless the school has written its own. */
export const DEFAULT_LETTER_TEXT: Record<Exclude<StudentDocKind, "INFORMATION">, string> = {
  ADMISSION:
    "This is to confirm that {name}, Student ID {code}, has been admitted to {school} and is placed in {class} for the academic year {year}, with effect from {admissionDate}.",
  TRANSFER:
    "This is to certify that {name}, Student ID {code}, was a student of {school} in {class} during the academic year {year}, until {leavingDate}. The student is hereby granted a transfer to {toSchool}, and this school has no objection to their admission there.",
  BONAFIDE:
    "This is to certify that {name}, Student ID {code}, is a bonafide student of {school}, currently studying in {class} for the academic year {year}. This certificate is issued on the request of the student or their guardian.",
};

/**
 * The letter's text as HTML: escaped, {placeholders} filled in bold, blank
 * lines starting new paragraphs. Shared by the printed page and the Word
 * file so the two say exactly the same thing.
 */
export function letterTextHtml(s: StudentWithParent, o: StudentDocOptions): string {
  if (o.kind === "INFORMATION") return "";
  const school = schoolBranding().name.trim();
  const cls = [s.className, s.section].filter(Boolean).join(" - ");
  const values: Record<string, string> = {
    "{name}": s.fullName,
    "{code}": s.code,
    "{class}": cls,
    "{year}": s.academicYear,
    "{school}": school,
    "{admissionDate}": dateLong(s.registrationDate),
    "{dob}": s.dob ? dateLong(s.dob) : "\u2014",
    "{parent}": s.parent?.name ?? "\u2014",
    "{toSchool}": o.transfer?.toSchool?.trim() || "another school",
    "{leavingDate}": dateLong(o.transfer?.leavingDate || new Date().toISOString()),
    "{reason}": o.transfer?.reason?.trim() || "\u2014",
    "{today}": dateLong(new Date().toISOString()),
  };
  const text = (o.bodyText?.trim() || DEFAULT_LETTER_TEXT[o.kind]).slice(0, 4000);
  // Escape first, then fill — a value can never become markup.
  const filled = escapeHtml(text).replace(/\{[a-zA-Z]+\}/g, (k) =>
    k in values ? `<strong>${escapeHtml(values[k])}</strong>` : k,
  );
  return filled
    .split(/\n\s*\n/)
    .map((para) => `<p class="lead">${para.replace(/\n/g, "<br/>")}</p>`)
    .join("");
}

/** A letter: the school's wording over the same letterhead. */
/** The particulars printed under a letter, as label/value pairs. */
function letterFacts(s: StudentWithParent, o: StudentDocOptions): [string, string | null][] {
  const cls = [s.className, s.section].filter(Boolean).join(" - ");
  const out: [string, string | null][] = [
    ["Student ID", s.code],
    ["Full Name", s.fullName],
    ["Date of Birth", s.dob ? dateLong(s.dob) : null],
  ];
  if (o.showAcademic) out.push(["Class", cls], ["Academic Year", s.academicYear]);
  if (o.showGuardian) out.push(["Parent / Guardian", s.parent?.name ?? null]);
  if (o.kind === "TRANSFER") {
    out.push(
      ["Date of Admission", s.registrationDate ? dateLong(s.registrationDate) : null],
      ["Date of Leaving", o.transfer?.leavingDate ? dateLong(o.transfer.leavingDate) : null],
      ["Transferred To", o.transfer?.toSchool?.trim() || null],
      ["Reason for Leaving", o.transfer?.reason?.trim() || null],
      ["Conduct", o.transfer?.conduct?.trim() || null],
    );
    if (o.transfer?.feesCleared !== undefined) {
      out.push(["Fees", o.transfer.feesCleared ? "All dues cleared" : "Dues outstanding"]);
    }
  }
  return out;
}

function letterBody(s: StudentWithParent, o: StudentDocOptions): string {
  const facts = section(
    "Student Particulars",
    letterFacts(s, o).map(([k, v]) => row(k, v)).join(""),
  );
  return `${letterTextHtml(s, o)}
    ${facts}`;
}

/**
 * One student document, ready to print.
 *
 * One sheet, as a fragment. The document wrapper below turns one or many of
 * these into a printable page — which is the whole trick to bulk printing: a
 * class of forty is forty of these in one window, not forty windows.
 */
function studentDocPage(
  student: StudentWithParent,
  opts: StudentDocOptions,
  qrDataUrl?: string | null,
): string {
  const s = schoolBranding();
  const title = DOC_TITLES[opts.kind];
  const body =
    opts.kind === "INFORMATION"
      ? informationBody(student, opts)
      : letterBody(student, opts);

  const qr =
    opts.showQr && qrDataUrl
      ? `<div class="qr">
           <img src="${escapeHtml(qrDataUrl)}" alt="" />
           <div class="qr-cap">${escapeHtml(student.code)}</div>
         </div>`
      : "";

  return `<div class="doc" style="--ek-accent:${accentColour()}">
  ${watermarkHtml()}
  ${opts.showLogo ? letterheadHtml({ title, refLabel: opts.reference ? "Ref. No." : undefined, refValue: opts.reference }) : `<div class="doc-title"><div class="dt-main"><h2>${escapeHtml(title)}</h2></div></div>`}

  ${body}

  <div class="foot-band">
    ${qr || "<div></div>"}
    ${signatureHtml("Class Teacher")}
    ${opts.showStamp ? stampHtml(s.name.trim().slice(0, 18), "OFFICIAL") : "<div></div>"}
    ${signatureHtml("Principal")}
  </div>

  ${documentFooterHtml()}
</div>`;
}

/** The page furniture every document of this kind shares. */
function docShell(title: string, opts: StudentDocOptions, pages: string): string {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/><title>${escapeHtml(title)}</title>
<style>
  ${DOC_SHELL_CSS}
  ${paperCss(opts.paper)}
  ${
    // paperCss fixes the page to the sheet's own orientation, so landscape has
    // to override the @page rule it just wrote rather than sit beside it.
    opts.landscape
      ? "@page{size:" + (opts.paper === "A5" ? "A5" : opts.paper === "LETTER" ? "letter" : "A4") + " landscape}body{max-width:none}"
      : ""
  }
  ${LETTERHEAD_CSS}
  ${DESIGN_CSS[opts.design]}

  /* Each student starts a fresh sheet. The last one must not, or every batch
     ends with a blank page coming out of the printer. */
  .doc + .doc{page-break-before:always;break-before:page}
  @media screen{ .doc + .doc{margin-top:24px;border-top:2px dashed #cbd5e1;padding-top:24px} }
</style></head>
<body>
${pages}
</body></html>`;
}

/**
 * One student document, ready to print.
 *
 * Returns a complete HTML document rather than a fragment so the same string
 * can be dropped into a preview frame and handed to a print window without
 * being assembled twice — a preview that is built differently from the print
 * is a preview that lies.
 */
export function studentDocumentHtml(
  student: StudentWithParent,
  opts: StudentDocOptions,
): string {
  return docShell(
    `${DOC_TITLES[opts.kind]} \u2014 ${student.fullName}`,
    opts,
    studentDocPage(student, opts, opts.qrDataUrl),
  );
}

/** Open the print dialog on exactly what the preview showed. */
export function printStudentDocument(
  student: StudentWithParent,
  opts: StudentDocOptions,
): void {
  const w = window.open("", "_blank", "width=900,height=1200");
  if (!w) return;
  w.document.write(studentDocumentHtml(student, opts));
  w.document.close();
  w.focus();
  // Images — the logo, the photo, the QR — have to be decoded before the
  // dialog opens or the sheet prints with holes in it.
  w.onload = () => {
    w.print();
  };
}

/**
 * The same document laid out for Microsoft Word.
 *
 * The printed page leans on CSS that Word does not understand — flexbox, grid,
 * gradients, an absolutely-placed watermark — so a Word copy of it came out
 * rearranged. This version builds the identical content from tables and
 * inline styles only, which Word renders exactly: the letterhead (banner, or
 * logo beside the school's name and contacts), the title and reference, the
 * school's own wording, the particulars, and the signature line.
 */
export function studentDocumentWordHtml(student: StudentWithParent, opts: StudentDocOptions): string {
  const b = schoolBranding();
  const accent = accentColour();
  const title = DOC_TITLES[opts.kind];
  const contacts = [
    [b.address, b.city, b.country].filter(Boolean).join(", "),
    [b.phone ? `Tel: ${b.phone}` : "", b.email ?? "", b.website ?? ""].filter(Boolean).join("  |  "),
  ].filter(Boolean);

  const letterhead = b.headerImage
    ? `<p align="center" style="margin:0"><img src="${escapeHtml(b.headerImage.url)}" width="680" /></p>`
    : `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tr>
        ${b.logoUrl ? `<td width="90" valign="middle"><img src="${escapeHtml(b.logoUrl)}" width="76" height="76" /></td>` : ""}
        <td valign="middle" style="${b.logoUrl ? "" : "text-align:center;"}">
          <p style="margin:0;font-size:20pt;font-weight:bold;color:#0f172a">${escapeHtml(b.name)}</p>
          ${b.tagline ? `<p style="margin:2pt 0 0;font-size:10pt;color:#64748b">${escapeHtml(b.tagline)}</p>` : ""}
          ${contacts.map((c) => `<p style="margin:2pt 0 0;font-size:9pt;color:#475569">${escapeHtml(c)}</p>`).join("")}
        </td>
      </tr></table>`;

  const rows = (pairs: [string, string | null][]) =>
    pairs
      .filter(([, v]) => v !== null && v !== "")
      .map(
        ([k, v], i) =>
          `<tr style="background:${i % 2 ? "#f8fafc" : "#ffffff"}"><td width="35%" style="padding:5pt 8pt;border:0.75pt solid #e2e8f0;color:#475569;font-weight:bold">${escapeHtml(k)}</td><td style="padding:5pt 8pt;border:0.75pt solid #e2e8f0">${escapeHtml(v)}</td></tr>`,
      )
      .join("");

  let body: string;
  if (opts.kind === "INFORMATION") {
    const s = student;
    const block = (heading: string, pairs: [string, string | null][]) => {
      const r = rows(pairs);
      return r
        ? `<p style="margin:12pt 0 4pt;font-size:11pt;font-weight:bold;color:${accent};text-transform:uppercase;letter-spacing:1pt">${escapeHtml(heading)}</p>
           <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:10.5pt">${r}</table>`
        : "";
    };
    body =
      block("Personal Information", [
        ["Student ID", s.code],
        ["Full Name", s.fullName],
        ["Date of Birth", s.dob ? dateLong(s.dob) : null],
        ["Gender", s.gender === "MALE" ? "Male" : "Female"],
        ["Place of Birth", s.placeOfBirth ?? null],
        ["Admission Date", dateLong(s.registrationDate)],
        ["Status", s.status === "ACTIVE" ? "Active" : "Inactive"],
      ]) +
      (opts.showAcademic
        ? block("Academic Information", [
            ["Academic Year", s.academicYear],
            ["Class", s.className],
            ["Section", s.section ?? null],
            ["District", s.district ?? null],
            ["Village", s.village ?? null],
          ])
        : "") +
      (opts.showGuardian
        ? block("Parent / Guardian", [
            ["Name", s.parent?.name ?? null],
            ["Phone", s.parent?.phone ?? null],
            ["Mother's Name", s.motherName ?? null],
          ])
        : "");
  } else {
    body = `${letterTextHtml(student, opts).replace(
      /<p class="lead">/g,
      '<p style="margin:0 0 10pt;font-size:12pt;line-height:150%;text-align:justify">',
    )}
      <p style="margin:12pt 0 4pt;font-size:11pt;font-weight:bold;color:${accent};text-transform:uppercase;letter-spacing:1pt">Student Particulars</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:10.5pt">${rows(letterFacts(student, opts))}</table>`;
  }

  const sig = (label: string) =>
    `<td width="33%" align="center" valign="bottom" style="padding-top:42pt">
       <p style="margin:0;border-top:0.75pt solid #0f172a;width:150pt">&nbsp;</p>
       <p style="margin:2pt 0 0;font-size:10pt;font-weight:bold">${escapeHtml(label)}</p>
     </td>`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${escapeHtml(title)}</title>
<style>body{font-family:Calibri,Arial,sans-serif;color:#0f172a;font-size:11pt}</style></head>
<body>
  ${letterhead}
  <p style="margin:6pt 0 0;border-bottom:2.25pt solid ${accent};font-size:2pt">&nbsp;</p>
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:10pt"><tr>
    <td style="font-size:10pt;color:#475569">${opts.reference ? `Ref. No.: <b>${escapeHtml(opts.reference)}</b>` : "&nbsp;"}</td>
    <td align="right" style="font-size:10pt;color:#475569">Date: <b>${escapeHtml(dateLong(new Date().toISOString()))}</b></td>
  </tr></table>
  <p align="center" style="margin:16pt 0 14pt;font-size:17pt;font-weight:bold;letter-spacing:2pt;text-transform:uppercase;color:${accent}">${escapeHtml(title)}</p>
  ${body}
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:28pt"><tr>
    ${sig("Class Teacher")}${sig(opts.showStamp ? "School Stamp" : "")}${sig("Principal")}
  </tr></table>
</body></html>`;
}
