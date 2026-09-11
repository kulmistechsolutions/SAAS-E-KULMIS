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

/** A letter: one paragraph of prose over the same letterhead. */
function letterBody(s: StudentWithParent, o: StudentDocOptions): string {
  const school = schoolBranding().name.trim();
  const cls = [s.className, s.section].filter(Boolean).join(" - ");

  const prose: Record<Exclude<StudentDocKind, "INFORMATION">, string> = {
    ADMISSION: `This is to confirm that <strong>${escapeHtml(s.fullName)}</strong>,
      Student ID <strong>${escapeHtml(s.code)}</strong>, has been admitted to
      ${escapeHtml(school)} and is placed in <strong>${escapeHtml(cls)}</strong>
      for the academic year <strong>${escapeHtml(s.academicYear)}</strong>,
      with effect from ${escapeHtml(dateLong(s.registrationDate))}.`,
    TRANSFER: `This is to certify that <strong>${escapeHtml(s.fullName)}</strong>,
      Student ID <strong>${escapeHtml(s.code)}</strong>, was a student of
      ${escapeHtml(school)} in <strong>${escapeHtml(cls)}</strong> during the
      academic year <strong>${escapeHtml(s.academicYear)}</strong>. The student
      is hereby granted a transfer, and this school has no objection to their
      admission elsewhere.`,
    BONAFIDE: `This is to certify that <strong>${escapeHtml(s.fullName)}</strong>,
      Student ID <strong>${escapeHtml(s.code)}</strong>, is a bonafide student
      of ${escapeHtml(school)}, currently studying in
      <strong>${escapeHtml(cls)}</strong> for the academic year
      <strong>${escapeHtml(s.academicYear)}</strong>. This certificate is issued
      on the request of the student or their guardian.`,
  };

  const facts = section(
    "Student Particulars",
    row("Student ID", s.code) +
      row("Full Name", s.fullName) +
      row("Date of Birth", s.dob ? dateLong(s.dob) : null) +
      (o.showAcademic ? row("Class", cls) + row("Academic Year", s.academicYear) : "") +
      (o.showGuardian ? row("Parent / Guardian", s.parent?.name) : ""),
  );

  return `<p class="lead">${prose[o.kind as Exclude<StudentDocKind, "INFORMATION">]}</p>
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

/**
 * A whole class in one document, one student per sheet.
 *
 * The alternative — a window per student — is forty print dialogs and a desk
 * that gives up halfway. This is one dialog and one stack of paper, in the
 * order the list was in.
 *
 * QR codes come in already rendered, keyed by student id, because building
 * them is asynchronous and this function must stay a pure string builder that
 * the preview and the print can both call.
 */
export function studentDocumentsHtml(
  students: StudentWithParent[],
  opts: StudentDocOptions,
  qrByStudent?: Record<string, string | null>,
): string {
  const pages = students
    .map((st) => studentDocPage(st, opts, qrByStudent?.[st.id] ?? null))
    .join("\n");
  return docShell(
    `${DOC_TITLES[opts.kind]} \u2014 ${students.length} students`,
    opts,
    pages,
  );
}

/** Open the print dialog on a whole batch at once. */
export function printStudentDocuments(
  students: StudentWithParent[],
  opts: StudentDocOptions,
  qrByStudent?: Record<string, string | null>,
): void {
  if (students.length === 0) return;
  const w = window.open("", "_blank", "width=900,height=1200");
  if (!w) return;
  w.document.write(studentDocumentsHtml(students, opts, qrByStudent));
  w.document.close();
  w.focus();
  w.onload = () => {
    w.print();
  };
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

/** The file name a downloaded copy should carry. */
export function documentFileName(
  student: StudentWithParent,
  kind: StudentDocKind,
): string {
  const slug = (v: string) =>
    v.trim().replace(/\s+/g, "-").replace(/[^A-Za-z0-9-]/g, "");
  return `${slug(DOC_TITLES[kind])}-${slug(student.fullName)}-${slug(student.code)}.pdf`;
}
