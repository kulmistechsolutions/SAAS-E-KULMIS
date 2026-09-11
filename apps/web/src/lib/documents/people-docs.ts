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
import type { Teacher } from "@/lib/teachers/types";
import type { StaffEmployee } from "@/lib/employees/types";
import type { Parent, StudentWithParent } from "@/lib/students/types";
import { DESIGN_CSS, DOC_SHELL_CSS, type DocDesign } from "./doc-shell";

/**
 * The same document engine, pointed at the people who are not students.
 *
 * A teacher, a guardian and a cleaner need different facts on the page but the
 * identical letterhead, paper handling and signature band — which is the whole
 * reason this shares a shell with the student documents rather than growing a
 * second one. Eight modules with eight ideas of a header is what this avoids.
 *
 * Salary is the one field here that is not safe to print for everyone, so it
 * is behind its own flag and the caller decides from the signed-in user's
 * permissions. The page never asks the document to keep a secret.
 */

export type PersonDocKind =
  | "TEACHER_INFO"
  | "APPOINTMENT"
  | "TEACHER_SERVICE"
  | "PARENT_INFO"
  | "STAFF_INFO"
  | "EMPLOYMENT";

export const PERSON_DOC_TITLES: Record<PersonDocKind, string> = {
  TEACHER_INFO: "Teacher Information Sheet",
  APPOINTMENT: "Appointment Letter",
  TEACHER_SERVICE: "Service Certificate",
  PARENT_INFO: "Parent / Guardian Information",
  STAFF_INFO: "Staff Information Sheet",
  EMPLOYMENT: "Employment Letter",
};

export interface PersonDocOptions {
  kind: PersonDocKind;
  design: DocDesign;
  paper: PaperSize;
  landscape: boolean;
  showLogo: boolean;
  showStamp: boolean;
  showContact: boolean;
  /**
   * Pay. Off unless the signed-in user may see it — a service certificate
   * handed to a landlord should not carry a salary because the clerk printing
   * it forgot to untick a box.
   */
  showSalary: boolean;
  reference?: string;
}

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

function row(label: string, value: unknown): string {
  const v = value === null || value === undefined || value === "" ? null : value;
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

function money(n: number): string {
  return `$${Number(n || 0).toLocaleString()}`;
}

/** Who the document is about, in the shape each kind needs. */
export type DocSubject =
  | { type: "TEACHER"; teacher: Teacher; classes?: string[] }
  | { type: "PARENT"; parent: Parent; children: StudentWithParent[] }
  | { type: "STAFF"; staff: StaffEmployee };

function subjectName(s: DocSubject): string {
  return s.type === "TEACHER"
    ? s.teacher.fullName
    : s.type === "PARENT"
      ? s.parent.name
      : s.staff.fullName;
}

function subjectCode(s: DocSubject): string {
  return s.type === "TEACHER"
    ? s.teacher.code
    : s.type === "PARENT"
      ? s.parent.code
      : s.staff.code;
}

function teacherBody(t: Teacher, classes: string[], o: PersonDocOptions): string {
  const personal = section(
    "Personal Information",
    row("Teacher ID", t.code) +
      row("Full Name", t.fullName) +
      row("Gender", t.gender === "MALE" ? "Male" : "Female") +
      row("Qualification", t.qualification) +
      row("Status", t.status === "ACTIVE" ? "Active" : "Inactive"),
  );

  const employment = section(
    "Employment",
    row("Employment Date", dateLong(t.registrationDate)) +
      row("Shifts", t.shifts.length ? t.shifts.join(", ") : null) +
      row("Classes", classes.length ? classes.join(", ") : null) +
      (o.showSalary ? row("Monthly Salary", money(t.salary)) : ""),
  );

  const contact = o.showContact
    ? section(
        "Contact",
        row("Phone", t.phone) + row("Email", t.email) + row("Address", t.address),
      )
    : "";

  return personal + employment + contact;
}

function parentBody(
  p: Parent,
  children: StudentWithParent[],
  o: PersonDocOptions,
): string {
  const personal = section(
    "Guardian",
    row("Parent ID", p.code) +
      row("Full Name", p.name) +
      row("Occupation", p.occupation) +
      row("Status", p.status === "ACTIVE" ? "Active" : "Inactive"),
  );

  const contact = o.showContact
    ? section(
        "Contact",
        row("Phone", p.phone) +
          row("Alternative Phone", p.altPhone) +
          row("Email", p.email) +
          row("Address", p.address),
      )
    : "";

  // The children are the point of a guardian document, so they get a table of
  // their own rather than a comma-separated line nobody can read.
  const kids = children.length
    ? `<div class="card">
        <div class="sec-head">Children (${children.length})</div>
        <table class="kv listing">
          <tr><td class="k">Student ID</td><td class="k">Name</td><td class="k">Class</td></tr>
          ${children
            .map(
              (c) =>
                `<tr><td class="v">${escapeHtml(c.code)}</td><td class="v">${escapeHtml(
                  c.fullName,
                )}</td><td class="v">${escapeHtml(
                  [c.className, c.section].filter(Boolean).join(" - "),
                )}</td></tr>`,
            )
            .join("")}
        </table>
      </div>`
    : "";

  return personal + contact + kids;
}

function staffBody(s: StaffEmployee, o: PersonDocOptions): string {
  const personal = section(
    "Staff Member",
    row("Staff ID", s.code) +
      row("Full Name", s.fullName) +
      row("Position", s.position) +
      row("Status", s.status === "ACTIVE" ? "Active" : "Inactive") +
      row("Registered", dateLong(s.createdAt)),
  );
  const contact = o.showContact ? section("Contact", row("Phone", s.phone)) : "";
  const pay = o.showSalary ? section("Pay", row("Monthly Salary", money(s.salary))) : "";
  return personal + contact + pay;
}

/** A letter: prose over the letterhead, with the particulars beneath it. */
function letterBody(subject: DocSubject, o: PersonDocOptions): string {
  const school = schoolBranding().name.trim();
  const name = subjectName(subject);
  const code = subjectCode(subject);

  let prose = "";
  let particulars = "";

  if (subject.type === "TEACHER") {
    const t = subject.teacher;
    prose =
      o.kind === "APPOINTMENT"
        ? `This is to confirm the appointment of <strong>${escapeHtml(name)}</strong>,
           Teacher ID <strong>${escapeHtml(code)}</strong>, to the teaching staff of
           ${escapeHtml(school)} with effect from
           ${escapeHtml(dateLong(t.registrationDate))}.`
        : `This is to certify that <strong>${escapeHtml(name)}</strong>, Teacher ID
           <strong>${escapeHtml(code)}</strong>, has served on the teaching staff of
           ${escapeHtml(school)} since
           ${escapeHtml(dateLong(t.registrationDate))}${
             t.status === "ACTIVE" ? " and remains in service" : ""
           }. This certificate is issued on request.`;
    particulars = section(
      "Particulars",
      row("Full Name", name) +
        row("Teacher ID", code) +
        row("Qualification", t.qualification) +
        row("Employment Date", dateLong(t.registrationDate)) +
        (o.showSalary ? row("Monthly Salary", money(t.salary)) : ""),
    );
  } else if (subject.type === "STAFF") {
    const s = subject.staff;
    prose = `This is to confirm that <strong>${escapeHtml(name)}</strong>, Staff ID
      <strong>${escapeHtml(code)}</strong>, is employed at ${escapeHtml(school)} as
      <strong>${escapeHtml(s.position)}</strong>, with effect from
      ${escapeHtml(dateLong(s.createdAt))}.`;
    particulars = section(
      "Particulars",
      row("Full Name", name) +
        row("Staff ID", code) +
        row("Position", s.position) +
        row("Employment Date", dateLong(s.createdAt)) +
        (o.showSalary ? row("Monthly Salary", money(s.salary)) : ""),
    );
  }

  return `<p class="lead">${prose}</p>${particulars}`;
}

const IS_LETTER: Record<PersonDocKind, boolean> = {
  TEACHER_INFO: false,
  APPOINTMENT: true,
  TEACHER_SERVICE: true,
  PARENT_INFO: false,
  STAFF_INFO: false,
  EMPLOYMENT: true,
};

/** One person document, ready to print. */
export function personDocumentHtml(
  subject: DocSubject,
  opts: PersonDocOptions,
): string {
  const s = schoolBranding();
  const title = PERSON_DOC_TITLES[opts.kind];

  const body = IS_LETTER[opts.kind]
    ? letterBody(subject, opts)
    : subject.type === "TEACHER"
      ? teacherBody(subject.teacher, subject.classes ?? [], opts)
      : subject.type === "PARENT"
        ? parentBody(subject.parent, subject.children, opts)
        : staffBody(subject.staff, opts);

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/><title>${escapeHtml(title)} \u2014 ${escapeHtml(subjectName(subject))}</title>
<style>
  ${DOC_SHELL_CSS}
  ${paperCss(opts.paper)}
  ${
    opts.landscape
      ? "@page{size:" +
        (opts.paper === "A5" ? "A5" : opts.paper === "LETTER" ? "letter" : "A4") +
        " landscape}body{max-width:none}"
      : ""
  }
  ${LETTERHEAD_CSS}
  ${DESIGN_CSS[opts.design]}
</style></head>
<body>
<div class="doc" style="--ek-accent:${accentColour()}">
  ${watermarkHtml()}
  ${
    opts.showLogo
      ? letterheadHtml({
          title,
          refLabel: opts.reference ? "Ref. No." : undefined,
          refValue: opts.reference,
        })
      : `<div class="doc-title"><div class="dt-main"><h2>${escapeHtml(title)}</h2></div></div>`
  }

  ${body}

  <div class="foot-band">
    <div></div>
    ${signatureHtml("Administrator")}
    ${opts.showStamp ? stampHtml(s.name.trim().slice(0, 18), "OFFICIAL") : "<div></div>"}
    ${signatureHtml("Principal")}
  </div>

  ${documentFooterHtml()}
</div>
</body></html>`;
}

/** Open the print dialog on exactly what the preview showed. */
export function printPersonDocument(
  subject: DocSubject,
  opts: PersonDocOptions,
): void {
  const w = window.open("", "_blank", "width=900,height=1200");
  if (!w) return;
  w.document.write(personDocumentHtml(subject, opts));
  w.document.close();
  w.focus();
  w.onload = () => {
    w.print();
  };
}
