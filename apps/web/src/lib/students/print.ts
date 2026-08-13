"use client";

import { getSettings, schoolBranding } from "@/lib/settings/store";
import { genderLabel, money, shortDate, statusLabel } from "./format";
import type { StudentWithParent } from "./types";
import { studentClassLabel, studentSectionNames } from "./types";

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
  const school = schoolBranding();
  const logo = school.logoUrl
    ? `<img src="${school.logoUrl}" alt="" class="logo" style="object-fit:contain"/>`
    : `<div class="logo">${school.name.slice(0, 2).toUpperCase()}</div>`;
  const centered = school.headerLayout === "CENTERED";
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
    .head{display:flex;align-items:center;gap:16px;border-bottom:2px solid #4f46e5;padding-bottom:16px;margin-bottom:16px}
    .head.centered{flex-direction:column;text-align:center}
    .logo{width:52px;height:52px;border-radius:12px;background:linear-gradient(135deg,#3b82f6,#4f46e5);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:20px}
    h1{margin:0;font-size:20px}
    .meta{color:#475569;font-size:13px;margin-top:4px}
    table{width:100%;border-collapse:collapse;margin-top:8px;font-size:13px}
    th,td{border:1px solid #cbd5e1;padding:7px 10px;text-align:left}
    th{background:#f1f5f9}
    .foot{margin-top:24px;font-size:11px;color:#94a3b8}
    @media print{body{padding:0}}
  </style></head><body>
  <div class="head${centered ? " centered" : ""}">
    ${logo}
    <div>
      <h1>${escapeHtml(school.name)}</h1>
      <div class="meta">Student List · Academic Year ${meta.academicYear} · Class: ${meta.className} · Section: ${meta.section}</div>
    </div>
  </div>
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

export function printStudentProfile(r: StudentWithParent) {
  const school = schoolBranding();
  const { studentHeader, studentFooter } = getSettings().students;
  const logo = school.logoUrl
    ? `<img src="${school.logoUrl}" alt="" class="logo" style="object-fit:contain"/>`
    : `<div class="logo">${school.name.slice(0, 2).toUpperCase()}</div>`;
  const centered = school.headerLayout === "CENTERED";
  const w = window.open("", "_blank", "width=800,height=700");
  if (!w) return;
  const row = (k: string, v: string) =>
    `<tr><td class="k">${k}</td><td>${escapeHtml(v)}</td></tr>`;
  // Every field the registration form can collect, so the printed copy never
  // silently drops something that was actually saved — place of birth,
  // district and mother's name only ever have a value on the detailed form,
  // and village/notes are optional on both, so each is skipped when empty
  // rather than printed as a blank row.
  const optionalRows = [
    r.placeOfBirth ? row("Place of Birth", r.placeOfBirth) : "",
    r.district ? row("District", r.district) : "",
    r.village ? row("Village", r.village) : "",
    r.motherName ? row("Mother's Name", r.motherName) : "",
    r.notes ? row("Notes", r.notes) : "",
  ]
    .filter(Boolean)
    .join("");
  w.document.write(`<!DOCTYPE html><html><head><title>${escapeHtml(r.fullName)} — Profile</title>
  <style>
    *{font-family:Arial,Helvetica,sans-serif;box-sizing:border-box}
    body{padding:32px;color:#0f172a}
    .head{display:flex;align-items:center;gap:16px;border-bottom:2px solid #4f46e5;padding-bottom:16px;margin-bottom:20px}
    .head.centered{flex-direction:column;text-align:center}
    .logo{width:52px;height:52px;border-radius:12px;background:linear-gradient(135deg,#3b82f6,#4f46e5);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:20px}
    h1{margin:0;font-size:20px}
    .meta{color:#475569;font-size:13px;margin-top:4px}
    h2{font-size:14px;margin:18px 0 6px;color:#4f46e5}
    table{width:100%;border-collapse:collapse;font-size:13px}
    td{border:1px solid #e2e8f0;padding:7px 10px}
    td.k{background:#f8fafc;font-weight:600;width:220px}
    .foot{margin-top:24px;font-size:11px;color:#94a3b8;text-align:center}
    @media print{body{padding:0}}
  </style></head><body>
  <div class="head${centered ? " centered" : ""}">${logo}<div><h1>${escapeHtml(school.name)}</h1><div class="meta">${studentHeader || "Student Profile"}</div></div></div>
  <h2>Personal Information</h2>
  <table>
    ${row("Student ID", r.code)}
    ${row("Full Name", r.fullName)}
    ${row("Gender", genderLabel(r.gender))}
    ${row("Date of Birth", shortDate(r.dob))}
    ${row("Phone", r.phone ?? "—")}
    ${optionalRows}
    ${row("Class", r.className + (r.section ? " - " + r.section : ""))}
    ${row("Monthly Fee", money(r.monthlyFee))}
    ${row("Registration Date", shortDate(r.registrationDate))}
    ${row("Status", statusLabel(r.status))}
  </table>
  <h2>Parent / Guardian</h2>
  <table>
    ${row("Parent ID", r.parent.code)}
    ${row("Parent Name", r.parent.name)}
    ${row("Parent Phone", r.parent.phone)}
  </table>
  ${studentFooter ? `<div class="foot">${escapeHtml(studentFooter)}</div>` : ""}
  <script>window.onload=function(){window.print()}</script>
  </body></html>`);
  w.document.close();
}
