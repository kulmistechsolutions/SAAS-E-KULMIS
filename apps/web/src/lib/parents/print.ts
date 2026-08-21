"use client";

import { getSettings, schoolBranding } from "@/lib/settings/store";
import { shortDate, statusLabel } from "@/lib/students/format";
import type { Parent, Student } from "@/lib/students/types";

type ParentRow = Parent & { childCount: number };

export interface ParentFieldDef {
  key: string;
  label: string;
  value: (p: ParentRow) => string;
}

/** Every column a parent print/export can offer, in canonical output order. */
export const PARENT_EXPORT_FIELDS: ParentFieldDef[] = [
  { key: "code", label: "Parent ID", value: (p) => p.code },
  { key: "name", label: "Parent Name", value: (p) => p.name },
  { key: "phone", label: "Phone", value: (p) => p.phone },
  { key: "altPhone", label: "Alternative Phone", value: (p) => p.altPhone ?? "—" },
  { key: "email", label: "Email", value: (p) => p.email ?? "—" },
  { key: "address", label: "Address", value: (p) => p.address ?? "—" },
  { key: "occupation", label: "Occupation", value: (p) => p.occupation ?? "—" },
  { key: "childCount", label: "Children", value: (p) => String(p.childCount) },
  { key: "registrationDate", label: "Registration Date", value: (p) => shortDate(p.registrationDate) },
  { key: "status", label: "Status", value: (p) => statusLabel(p.status) },
  { key: "username", label: "Username", value: (p) => p.username },
];

/** Matches what the list print/export used to show unconditionally. */
export const DEFAULT_PARENT_EXPORT_FIELDS = [
  "code",
  "name",
  "phone",
  "childCount",
  "registrationDate",
  "status",
];

function resolveParentFields(fieldKeys: string[]): ParentFieldDef[] {
  const byKey = new Map(PARENT_EXPORT_FIELDS.map((f) => [f.key, f]));
  const resolved = fieldKeys.map((k) => byKey.get(k)).filter((f): f is ParentFieldDef => !!f);
  return resolved.length > 0
    ? resolved
    : PARENT_EXPORT_FIELDS.filter((f) => DEFAULT_PARENT_EXPORT_FIELDS.includes(f.key));
}

export function exportParentsCsv(
  rows: ParentRow[],
  fieldKeys: string[] = DEFAULT_PARENT_EXPORT_FIELDS,
  fileName = "parents.csv",
) {
  const fields = resolveParentFields(fieldKeys);
  const headers = ["Serial", ...fields.map((f) => f.label)];
  const esc = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = rows.map((p, i) =>
    [i + 1, ...fields.map((f) => f.value(p))].map(esc).join(","),
  );
  const blob = new Blob([[headers.join(","), ...lines].join("\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function printParentProfile(parent: Parent, children: Student[]) {
  const school = schoolBranding();
  const { parentHeader, parentFooter } = getSettings().parents;
  const logo = school.logoUrl
    ? `<img src="${school.logoUrl}" alt="" class="logo" style="object-fit:contain"/>`
    : `<div class="logo">${school.name.slice(0, 2).toUpperCase()}</div>`;
  const centered = school.headerLayout === "CENTERED";
  const w = window.open("", "_blank", "width=800,height=700");
  if (!w) return;
  const row = (k: string, v: string) =>
    `<tr><td class="k">${k}</td><td>${escapeHtml(v)}</td></tr>`;
  const childRows = children
    .map(
      (c) =>
        `<tr><td>${c.code}</td><td>${escapeHtml(c.fullName)}</td><td>${escapeHtml(c.className)}${c.section ? " - " + c.section : ""}</td><td>${statusLabel(c.status)}</td></tr>`,
    )
    .join("");
  w.document.write(`<!DOCTYPE html><html><head><title>${escapeHtml(parent.name)}</title>
  <style>
    *{font-family:Arial,sans-serif;box-sizing:border-box}body{padding:32px;color:#0f172a}
    .head{display:flex;gap:16px;border-bottom:2px solid #4f46e5;padding-bottom:16px;margin-bottom:20px}
    .head.centered{flex-direction:column;text-align:center}
    .logo{width:52px;height:52px;border-radius:12px;background:linear-gradient(135deg,#3b82f6,#4f46e5);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:20px}
    h2{font-size:14px;margin:16px 0 6px;color:#4f46e5}
    table{width:100%;border-collapse:collapse;font-size:13px}
    td,th{border:1px solid #e2e8f0;padding:7px 10px}
    td.k{background:#f8fafc;font-weight:600;width:200px}
    th{background:#f8fafc;text-align:left}
    .foot{margin-top:24px;font-size:11px;color:#94a3b8;text-align:center}
  </style></head><body>
  <div class="head${centered ? " centered" : ""}">${logo}<div><h1>${escapeHtml(school.name)}</h1><div style="color:#475569;font-size:13px">${parentHeader || "Parent Profile"}</div></div></div>
  <h2>Parent Information</h2>
  <table>
    ${row("Parent ID", parent.code)}
    ${row("Full Name", parent.name)}
    ${row("Phone", parent.phone)}
    ${row("Alternative Phone", parent.altPhone ?? "—")}
    ${row("Email", parent.email ?? "—")}
    ${row("Address", parent.address ?? "—")}
    ${row("Occupation", parent.occupation ?? "—")}
    ${row("Registration Date", shortDate(parent.registrationDate))}
    ${row("Status", statusLabel(parent.status))}
  </table>
  <h2>Linked Students</h2>
  <table>
    <thead><tr><th>Student ID</th><th>Name</th><th>Class</th><th>Status</th></tr></thead>
    <tbody>${childRows || '<tr><td colspan="4">No students linked</td></tr>'}</tbody>
  </table>
  ${parentFooter ? `<div class="foot">${escapeHtml(parentFooter)}</div>` : ""}
  <script>window.onload=function(){window.print()}</script>
  </body></html>`);
  w.document.close();
}

export function printParentsList(
  rows: ParentRow[],
  meta: { status: string },
  fieldKeys: string[] = DEFAULT_PARENT_EXPORT_FIELDS,
) {
  const fields = resolveParentFields(fieldKeys);
  const school = schoolBranding();
  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) return;
  const headCells = fields.map((f) => `<th>${escapeHtml(f.label)}</th>`).join("");
  const body = rows
    .map(
      (p, i) =>
        `<tr><td>${i + 1}</td>${fields.map((f) => `<td>${escapeHtml(f.value(p))}</td>`).join("")}</tr>`,
    )
    .join("");
  w.document.write(`<!DOCTYPE html><html><head><title>Parent List</title>
  <style>*{font-family:Arial,sans-serif}body{padding:32px}table{width:100%;border-collapse:collapse;font-size:13px}th,td{border:1px solid #cbd5e1;padding:7px}th{background:#f1f5f9}</style></head><body>
  <h1>${escapeHtml(school.name)} — Parent List</h1>
  <p>Status filter: ${meta.status}</p>
  <table><thead><tr><th>#</th>${headCells}</tr></thead>
  <tbody>${body || `<tr><td colspan="${fields.length + 1}">No parents</td></tr>`}</tbody></table>
  <script>window.onload=function(){window.print()}</script></body></html>`);
  w.document.close();
}
