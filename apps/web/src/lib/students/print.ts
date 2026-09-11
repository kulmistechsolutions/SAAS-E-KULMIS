"use client";

import { PRINT_HEADER_CSS, printHeaderHtml } from "@/lib/print/header";
import { genderLabel, money, shortDate, statusLabel } from "./format";
import type { StudentWithParent } from "./types";
import { studentClassLabel, studentSectionNames } from "./types";
import { printStudentDocument } from "@/lib/documents/student-docs";
import type { DocDesign } from "@/lib/documents/doc-shell";
import { designFor } from "@/lib/print/design-store";

export interface StudentFieldDef {
  key: string;
  label: string;
  value: (r: StudentWithParent) => string;
}

/**
 * Every column a student's print/export can offer, in canonical output
 * order. Covers fields from both registration forms — the detailed-only
 * ones (placeOfBirth/district/motherName) simply fall back to "—" for
 * students registered on the simple form, so picking them never breaks.
 */
export const STUDENT_EXPORT_FIELDS: StudentFieldDef[] = [
  { key: "code", label: "Student ID", value: (r) => r.code },
  { key: "fullName", label: "Full Name", value: (r) => r.fullName },
  { key: "gender", label: "Gender", value: (r) => genderLabel(r.gender) },
  { key: "dob", label: "Date of Birth", value: (r) => shortDate(r.dob) },
  { key: "phone", label: "Phone", value: (r) => r.phone ?? "—" },
  { key: "parentName", label: "Parent Name", value: (r) => r.parent.name },
  { key: "parentPhone", label: "Parent Phone", value: (r) => r.parent.phone },
  { key: "className", label: "Class", value: (r) => studentClassLabel(r) },
  {
    key: "section",
    label: "Section",
    value: (r) => studentSectionNames(r).filter(Boolean).join(" + ") || "—",
  },
  { key: "village", label: "Village", value: (r) => r.village ?? "—" },
  { key: "monthlyFee", label: "Monthly Fee", value: (r) => money(r.monthlyFee) },
  { key: "academicYear", label: "Academic Year", value: (r) => r.academicYear },
  {
    key: "registrationDate",
    label: "Registration Date",
    value: (r) => shortDate(r.registrationDate),
  },
  { key: "status", label: "Status", value: (r) => statusLabel(r.status) },
  { key: "placeOfBirth", label: "Place of Birth", value: (r) => r.placeOfBirth ?? "—" },
  { key: "district", label: "District", value: (r) => r.district ?? "—" },
  { key: "motherName", label: "Mother's Name", value: (r) => r.motherName ?? "—" },
  { key: "notes", label: "Notes", value: (r) => r.notes ?? "—" },
];

/** Matches what the list print/export used to show unconditionally. */
export const DEFAULT_STUDENT_EXPORT_FIELDS = [
  "code",
  "fullName",
  "gender",
  "parentName",
  "parentPhone",
  "className",
  "section",
  "monthlyFee",
  "registrationDate",
  "status",
];

function resolveStudentFields(fieldKeys: string[]): StudentFieldDef[] {
  const byKey = new Map(STUDENT_EXPORT_FIELDS.map((f) => [f.key, f]));
  const resolved = fieldKeys.map((k) => byKey.get(k)).filter((f): f is StudentFieldDef => !!f);
  return resolved.length > 0
    ? resolved
    : STUDENT_EXPORT_FIELDS.filter((f) => DEFAULT_STUDENT_EXPORT_FIELDS.includes(f.key));
}

export function exportStudentsCsv(
  rows: StudentWithParent[],
  fieldKeys: string[] = DEFAULT_STUDENT_EXPORT_FIELDS,
  fileName = "students.csv",
) {
  const fields = resolveStudentFields(fieldKeys);
  const headers = ["Serial", ...fields.map((f) => f.label)];
  const esc = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = rows.map((r, i) =>
    [i + 1, ...fields.map((f) => f.value(r))].map(esc).join(","),
  );
  const csv = [headers.join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

interface PrintMeta {
  academicYear: string;
  className: string;
  section: string;
}

export function printStudentsList(
  rows: StudentWithParent[],
  meta: PrintMeta,
  fieldKeys: string[] = DEFAULT_STUDENT_EXPORT_FIELDS,
) {
  const fields = resolveStudentFields(fieldKeys);
  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) return;
  const headCells = fields.map((f) => `<th>${escapeHtml(f.label)}</th>`).join("");
  const body = rows
    .map(
      (r, i) =>
        `<tr><td>${i + 1}</td>${fields.map((f) => `<td>${escapeHtml(f.value(r))}</td>`).join("")}</tr>`,
    )
    .join("");
  w.document.write(`<!DOCTYPE html><html><head><title>Student List</title>
  <style>
    *{font-family:Arial,Helvetica,sans-serif;box-sizing:border-box}
    body{padding:32px;color:#0f172a}
    ${PRINT_HEADER_CSS}
    table{width:100%;border-collapse:collapse;margin-top:8px;font-size:13px}
    th,td{border:1px solid #cbd5e1;padding:7px 10px;text-align:left}
    th{background:#f1f5f9}
    .foot{margin-top:24px;font-size:11px;color:#94a3b8}
    @media print{body{padding:0}}
  </style></head><body>
  ${printHeaderHtml(`Student List · Academic Year ${escapeHtml(meta.academicYear)} · Class: ${escapeHtml(meta.className)} · Section: ${escapeHtml(meta.section)}`)}
  <table>
    <thead><tr><th>#</th>${headCells}</tr></thead>
    <tbody>${body || `<tr><td colspan="${fields.length + 1}">No students</td></tr>`}</tbody>
  </table>
  <div class="foot">Total: ${rows.length} students · Generated ${new Date().toLocaleString()}</div>
  <script>window.onload=function(){window.print()}</script>
  </body></html>`);
  w.document.close();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * One student's record, printed in whatever design the school has chosen.
 *
 * This used to draw its own layout — its own header, its own tables, its own
 * idea of a margin — which is exactly the duplicated print logic the document
 * engine exists to replace. A school that picks a design in Settings expects
 * this button to honour it, and before this it was the one printed page that
 * did not.
 */
export function printStudentProfile(r: StudentWithParent) {
  const design = designFor("STUDENT_PROFILE");
  printStudentDocument(r, {
    kind: "INFORMATION",
    design: design.template as DocDesign,
    paper: design.paper ?? "A4",
    landscape: design.landscape ?? false,
    // The sheet a desk hands over: everything the record holds, on school
    // paper, without a QR nobody asked for.
    showLogo: true,
    showStamp: true,
    showQr: false,
    showGuardian: true,
    showAcademic: true,
  });
}
