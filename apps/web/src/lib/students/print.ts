"use client";

import { schoolBranding } from "@/lib/settings/store";
import { genderLabel, money, shortDate, statusLabel } from "./format";
import type { StudentWithParent } from "./types";

export function exportStudentsCsv(rows: StudentWithParent[], fileName = "students.csv") {
  const headers = [
    "Serial",
    "Student ID",
    "Student Name",
    "Gender",
    "Parent",
    "Parent Phone",
    "Class",
    "Section",
    "Monthly Fee",
    "Registration Date",
    "Status",
  ];
  const esc = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = rows.map((r, i) =>
    [
      i + 1,
      r.code,
      r.fullName,
      genderLabel(r.gender),
      r.parent.name,
      r.parent.phone,
      r.className,
      r.section ?? "",
      r.monthlyFee,
      shortDate(r.registrationDate),
      statusLabel(r.status),
    ]
      .map(esc)
      .join(","),
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

export function printStudentsList(rows: StudentWithParent[], meta: PrintMeta) {
  const school = schoolBranding();
  const logo = school.logoUrl
    ? `<img src="${school.logoUrl}" alt="" class="logo" style="object-fit:cover"/>`
    : `<div class="logo">${school.name.slice(0, 2).toUpperCase()}</div>`;
  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) return;
  const body = rows
    .map(
      (r, i) => `<tr>
        <td>${i + 1}</td>
        <td>${r.code}</td>
        <td>${escapeHtml(r.fullName)}</td>
        <td>${escapeHtml(r.parent.name)}</td>
        <td>${escapeHtml(r.parent.phone)}</td>
        <td>${escapeHtml(r.className)}${r.section ? " - " + r.section : ""}</td>
      </tr>`,
    )
    .join("");
  w.document.write(`<!DOCTYPE html><html><head><title>Student List</title>
  <style>
    *{font-family:Arial,Helvetica,sans-serif;box-sizing:border-box}
    body{padding:32px;color:#0f172a}
    .head{display:flex;align-items:center;gap:16px;border-bottom:2px solid #4f46e5;padding-bottom:16px;margin-bottom:16px}
    .logo{width:52px;height:52px;border-radius:12px;background:linear-gradient(135deg,#3b82f6,#4f46e5);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:20px}
    h1{margin:0;font-size:20px}
    .meta{color:#475569;font-size:13px;margin-top:4px}
    table{width:100%;border-collapse:collapse;margin-top:8px;font-size:13px}
    th,td{border:1px solid #cbd5e1;padding:7px 10px;text-align:left}
    th{background:#f1f5f9}
    .foot{margin-top:24px;font-size:11px;color:#94a3b8}
    @media print{body{padding:0}}
  </style></head><body>
  <div class="head">
    ${logo}
    <div>
      <h1>${escapeHtml(school.name)}</h1>
      <div class="meta">Student List · Academic Year ${meta.academicYear} · Class: ${meta.className} · Section: ${meta.section}</div>
    </div>
  </div>
  <table>
    <thead><tr><th>#</th><th>Student ID</th><th>Student Name</th><th>Parent Name</th><th>Parent Phone</th><th>Class</th></tr></thead>
    <tbody>${body || '<tr><td colspan="6">No students</td></tr>'}</tbody>
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
  const logo = school.logoUrl
    ? `<img src="${school.logoUrl}" alt="" class="logo" style="object-fit:cover"/>`
    : `<div class="logo">${school.name.slice(0, 2).toUpperCase()}</div>`;
  const w = window.open("", "_blank", "width=800,height=700");
  if (!w) return;
  const row = (k: string, v: string) =>
    `<tr><td class="k">${k}</td><td>${escapeHtml(v)}</td></tr>`;
  w.document.write(`<!DOCTYPE html><html><head><title>${escapeHtml(r.fullName)} — Profile</title>
  <style>
    *{font-family:Arial,Helvetica,sans-serif;box-sizing:border-box}
    body{padding:32px;color:#0f172a}
    .head{display:flex;align-items:center;gap:16px;border-bottom:2px solid #4f46e5;padding-bottom:16px;margin-bottom:20px}
    .logo{width:52px;height:52px;border-radius:12px;background:linear-gradient(135deg,#3b82f6,#4f46e5);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:20px}
    h1{margin:0;font-size:20px}
    .meta{color:#475569;font-size:13px;margin-top:4px}
    h2{font-size:14px;margin:18px 0 6px;color:#4f46e5}
    table{width:100%;border-collapse:collapse;font-size:13px}
    td{border:1px solid #e2e8f0;padding:7px 10px}
    td.k{background:#f8fafc;font-weight:600;width:220px}
    @media print{body{padding:0}}
  </style></head><body>
  <div class="head">${logo}<div><h1>${escapeHtml(school.name)}</h1><div class="meta">Student Profile</div></div></div>
  <h2>Personal Information</h2>
  <table>
    ${row("Student ID", r.code)}
    ${row("Full Name", r.fullName)}
    ${row("Gender", genderLabel(r.gender))}
    ${row("Date of Birth", shortDate(r.dob))}
    ${row("Phone", r.phone ?? "—")}
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
  <script>window.onload=function(){window.print()}</script>
  </body></html>`);
  w.document.close();
}
