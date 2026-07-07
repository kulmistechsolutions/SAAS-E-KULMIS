"use client";

import { SCHOOL } from "@/lib/students/constants";
import { shortDate, statusLabel } from "@/lib/students/format";
import type { Parent, Student } from "@/lib/students/types";

export function exportParentsCsv(
  rows: (Parent & { childCount: number })[],
  fileName = "parents.csv",
) {
  const headers = [
    "Serial",
    "Parent ID",
    "Parent Name",
    "Phone",
    "Children",
    "Registration Date",
    "Status",
  ];
  const esc = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = rows.map((p, i) =>
    [i + 1, p.code, p.name, p.phone, p.childCount, shortDate(p.registrationDate), statusLabel(p.status)]
      .map(esc)
      .join(","),
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
    .logo{width:52px;height:52px;border-radius:12px;background:linear-gradient(135deg,#3b82f6,#4f46e5);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:20px}
    h2{font-size:14px;margin:16px 0 6px;color:#4f46e5}
    table{width:100%;border-collapse:collapse;font-size:13px}
    td,th{border:1px solid #e2e8f0;padding:7px 10px}
    td.k{background:#f8fafc;font-weight:600;width:200px}
    th{background:#f8fafc;text-align:left}
  </style></head><body>
  <div class="head"><div class="logo">ES</div><div><h1>${SCHOOL.name}</h1><div style="color:#475569;font-size:13px">Parent Profile</div></div></div>
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
  <script>window.onload=function(){window.print()}</script>
  </body></html>`);
  w.document.close();
}

export function printParentsList(
  rows: (Parent & { childCount: number })[],
  meta: { status: string },
) {
  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) return;
  const body = rows
    .map(
      (p, i) =>
        `<tr><td>${i + 1}</td><td>${p.code}</td><td>${escapeHtml(p.name)}</td><td>${escapeHtml(p.phone)}</td><td>${p.childCount}</td><td>${statusLabel(p.status)}</td></tr>`,
    )
    .join("");
  w.document.write(`<!DOCTYPE html><html><head><title>Parent List</title>
  <style>*{font-family:Arial,sans-serif}body{padding:32px}table{width:100%;border-collapse:collapse;font-size:13px}th,td{border:1px solid #cbd5e1;padding:7px}th{background:#f1f5f9}</style></head><body>
  <h1>${SCHOOL.name} — Parent List</h1>
  <p>Status filter: ${meta.status}</p>
  <table><thead><tr><th>#</th><th>Parent ID</th><th>Name</th><th>Phone</th><th>Children</th><th>Status</th></tr></thead>
  <tbody>${body}</tbody></table>
  <script>window.onload=function(){window.print()}</script></body></html>`);
  w.document.close();
}
