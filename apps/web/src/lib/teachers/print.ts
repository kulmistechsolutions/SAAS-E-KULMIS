"use client";

import { printPersonDocument } from "@/lib/documents/people-docs";
import type { DocDesign } from "@/lib/documents/doc-shell";
import { designFor } from "@/lib/print/design-store";
import { PRINT_HEADER_CSS, printHeaderHtml } from "@/lib/print/header";
import {
  assignmentShiftLabel,
  genderLabel,
  money,
  sectionLabel,
  shiftsLabel,
  shortDate,
  statusLabel,
} from "./format";
import type { Teacher, TeacherAssignment } from "./types";

export interface TeacherFieldDef {
  key: string;
  label: string;
  value: (t: Teacher, assignments: TeacherAssignment[]) => string;
}

/** Unique, comma-free class names (with section) this teacher is actively assigned to. */
function classesTaught(teacherId: string, assignments: TeacherAssignment[]): string {
  const names = assignments
    .filter((a) => a.teacherId === teacherId && a.status === "ACTIVE")
    .map((a) => `${a.className}${a.section ? " - " + a.section : ""}`);
  return [...new Set(names)].join("; ") || "—";
}

/** Unique subject names this teacher is actively assigned to teach. */
function subjectsTaught(teacherId: string, assignments: TeacherAssignment[]): string {
  const names = assignments
    .filter((a) => a.teacherId === teacherId && a.status === "ACTIVE")
    .map((a) => a.subject);
  return [...new Set(names)].join("; ") || "—";
}

/** Every column a teacher's print/export can offer, in canonical output order. */
export const TEACHER_EXPORT_FIELDS: TeacherFieldDef[] = [
  { key: "code", label: "Teacher ID", value: (t) => t.code },
  { key: "fullName", label: "Full Name", value: (t) => t.fullName },
  { key: "gender", label: "Gender", value: (t) => genderLabel(t.gender) },
  { key: "phone", label: "Phone", value: (t) => t.phone },
  { key: "email", label: "Email", value: (t) => t.email ?? "—" },
  { key: "address", label: "Address", value: (t) => t.address ?? "—" },
  { key: "qualification", label: "Qualification", value: (t) => t.qualification ?? "—" },
  { key: "salary", label: "Salary", value: (t) => money(t.salary) },
  { key: "shift", label: "Shift", value: (t) => shiftsLabel(t.shifts) },
  { key: "status", label: "Status", value: (t) => statusLabel(t.status) },
  {
    key: "registrationDate",
    label: "Registration Date",
    value: (t) => shortDate(t.registrationDate),
  },
  { key: "username", label: "Username", value: (t) => t.username },
  {
    key: "classes",
    label: "Classes Taught",
    value: (t, assignments) => classesTaught(t.id, assignments),
  },
  {
    key: "subjects",
    label: "Subjects Taught",
    value: (t, assignments) => subjectsTaught(t.id, assignments),
  },
];

/** Matches what the list print/export used to show unconditionally. */
export const DEFAULT_TEACHER_EXPORT_FIELDS = [
  "code",
  "fullName",
  "gender",
  "phone",
  "shift",
  "salary",
  "status",
  "registrationDate",
];

function resolveTeacherFields(fieldKeys: string[]): TeacherFieldDef[] {
  const byKey = new Map(TEACHER_EXPORT_FIELDS.map((f) => [f.key, f]));
  const resolved = fieldKeys.map((k) => byKey.get(k)).filter((f): f is TeacherFieldDef => !!f);
  return resolved.length > 0
    ? resolved
    : TEACHER_EXPORT_FIELDS.filter((f) => DEFAULT_TEACHER_EXPORT_FIELDS.includes(f.key));
}

export function exportTeachersCsv(
  teachers: Teacher[],
  assignments: TeacherAssignment[] = [],
  fieldKeys: string[] = DEFAULT_TEACHER_EXPORT_FIELDS,
  fileName = "teachers.csv",
) {
  const fields = resolveTeacherFields(fieldKeys);
  const headers = ["Serial", ...fields.map((f) => f.label)];
  const esc = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = teachers.map((t, i) =>
    [i + 1, ...fields.map((f) => f.value(t, assignments))].map(esc).join(","),
  );
  downloadCsv([headers.join(","), ...lines].join("\n"), fileName);
}

function downloadCsv(content: string, fileName: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function printTeachersList(
  teachers: Teacher[],
  meta: { shift: string; status: string },
  assignments: TeacherAssignment[] = [],
  fieldKeys: string[] = DEFAULT_TEACHER_EXPORT_FIELDS,
) {
  const fields = resolveTeacherFields(fieldKeys);
  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) return;
  const headCells = fields.map((f) => `<th>${escapeHtml(f.label)}</th>`).join("");
  const body = teachers
    .map(
      (t, i) =>
        `<tr><td>${i + 1}</td>${fields.map((f) => `<td>${escapeHtml(f.value(t, assignments))}</td>`).join("")}</tr>`,
    )
    .join("");
  w.document.write(`<!DOCTYPE html><html><head><title>Teacher List</title>
  <style>
    *{font-family:Arial,Helvetica,sans-serif;box-sizing:border-box}
    body{padding:32px;color:#0f172a}
    ${PRINT_HEADER_CSS}
    table{width:100%;border-collapse:collapse;font-size:13px}
    th,td{border:1px solid #cbd5e1;padding:7px 10px;text-align:left}
    th{background:#f1f5f9}
    @media print{body{padding:0}}
  </style></head><body>
  ${printHeaderHtml(`Teacher List · Shift: ${escapeHtml(meta.shift)} · Status: ${escapeHtml(meta.status)}`)}
  <table>
    <thead><tr><th>#</th>${headCells}</tr></thead>
    <tbody>${body || `<tr><td colspan="${fields.length + 1}">No teachers</td></tr>`}</tbody>
  </table>
  <div class="foot" style="margin-top:24px;font-size:11px;color:#94a3b8">Total: ${teachers.length} teachers · Generated ${new Date().toLocaleString()}</div>
  <script>window.onload=function(){window.print()}</script>
  </body></html>`);
  w.document.close();
}

/**
 * One teacher's record, printed in whatever design the school has chosen.
 *
 * Like the student profile, this drew its own layout until the document engine
 * took it over. Pay is deliberately absent: this button is reachable by
 * everyone who can see the teacher list, and a salary on a sheet handed across
 * a desk is not a decision a print icon should make.
 */
export function printTeacherProfile(
  teacher: Teacher,
  assignments: TeacherAssignment[],
) {
  const design = designFor("TEACHER_PROFILE");
  const classes = [
    ...new Set(
      assignments
        .filter((a) => a.status === "ACTIVE")
        .map((a) => [a.className, a.section].filter(Boolean).join(" - ")),
    ),
  ];
  printPersonDocument(
    { type: "TEACHER", teacher, classes },
    {
      kind: "TEACHER_INFO",
      design: design.template as DocDesign,
      paper: design.paper ?? "A4",
      landscape: design.landscape ?? false,
      showLogo: true,
      showStamp: true,
      showContact: true,
      showSalary: false,
    },
  );
}
