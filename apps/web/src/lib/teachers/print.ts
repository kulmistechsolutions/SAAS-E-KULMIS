"use client";

import { getSettings, schoolBranding } from "@/lib/settings/store";
import {
  assignmentShiftLabel,
  genderLabel,
  money,
  sectionLabel,
  shiftLabel,
  shortDate,
  statusLabel,
} from "./format";
import type { Teacher, TeacherAssignment } from "./types";

export function exportTeachersCsv(
  teachers: Teacher[],
  fileName = "teachers.csv",
) {
  const headers = [
    "Serial",
    "Teacher ID",
    "Full Name",
    "Gender",
    "Phone",
    "Shift",
    "Salary",
    "Status",
    "Registration Date",
  ];
  const esc = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = teachers.map((t, i) =>
    [
      i + 1,
      t.code,
      t.fullName,
      genderLabel(t.gender),
      t.phone,
      shiftLabel(t.shift),
      t.salary,
      statusLabel(t.status),
      shortDate(t.registrationDate),
    ]
      .map(esc)
      .join(","),
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
) {
  const school = schoolBranding();
  const logo = school.logoUrl
    ? `<img src="${school.logoUrl}" alt="" class="logo" style="object-fit:contain"/>`
    : `<div class="logo">${school.name.slice(0, 2).toUpperCase()}</div>`;
  const centered = school.headerLayout === "CENTERED";
  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) return;
  const body = teachers
    .map(
      (t, i) => `<tr>
        <td>${i + 1}</td>
        <td>${t.code}</td>
        <td>${escapeHtml(t.fullName)}</td>
        <td>${escapeHtml(t.phone)}</td>
        <td>${shiftLabel(t.shift)}</td>
        <td>${money(t.salary)}</td>
        <td>${statusLabel(t.status)}</td>
      </tr>`,
    )
    .join("");
  w.document.write(`<!DOCTYPE html><html><head><title>Teacher List</title>
  <style>
    *{font-family:Arial,Helvetica,sans-serif;box-sizing:border-box}
    body{padding:32px;color:#0f172a}
    .head{display:flex;align-items:center;gap:16px;border-bottom:2px solid #4f46e5;padding-bottom:16px;margin-bottom:16px}
    .head.centered{flex-direction:column;text-align:center}
    .logo{width:52px;height:52px;border-radius:12px;background:linear-gradient(135deg,#3b82f6,#4f46e5);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:20px}
    h1{margin:0;font-size:20px}
    .meta{color:#475569;font-size:13px;margin-top:4px}
    table{width:100%;border-collapse:collapse;font-size:13px}
    th,td{border:1px solid #cbd5e1;padding:7px 10px;text-align:left}
    th{background:#f1f5f9}
    @media print{body{padding:0}}
  </style></head><body>
  <div class="head${centered ? " centered" : ""}">${logo}<div>
    <h1>${escapeHtml(school.name)}</h1>
    <div class="meta">Teacher List · Shift: ${meta.shift} · Status: ${meta.status}</div>
  </div></div>
  <table>
    <thead><tr><th>#</th><th>Teacher ID</th><th>Name</th><th>Phone</th><th>Shift</th><th>Salary</th><th>Status</th></tr></thead>
    <tbody>${body || '<tr><td colspan="7">No teachers</td></tr>'}</tbody>
  </table>
  <script>window.onload=function(){window.print()}</script>
  </body></html>`);
  w.document.close();
}

export function printTeacherProfile(
  teacher: Teacher,
  assignments: TeacherAssignment[],
) {
  const school = schoolBranding();
  const { teacherHeader, teacherFooter } = getSettings().teachers;
  const logo = school.logoUrl
    ? `<img src="${school.logoUrl}" alt="" class="logo" style="object-fit:contain"/>`
    : `<div class="logo">${school.name.slice(0, 2).toUpperCase()}</div>`;
  const centered = school.headerLayout === "CENTERED";
  const w = window.open("", "_blank", "width=800,height=700");
  if (!w) return;
  const row = (k: string, v: string) =>
    `<tr><td class="k">${k}</td><td>${escapeHtml(v)}</td></tr>`;
  const assignRows = assignments
    .map(
      (a) =>
        `<tr><td>${a.academicYear}</td><td>${escapeHtml(a.className)}</td><td>${sectionLabel(a.section)}</td><td>${escapeHtml(assignmentShiftLabel(a.shift, teacher.shift))}</td><td>${escapeHtml(a.subject)}</td></tr>`,
    )
    .join("");
  w.document.write(`<!DOCTYPE html><html><head><title>${escapeHtml(teacher.fullName)}</title>
  <style>
    *{font-family:Arial,Helvetica,sans-serif;box-sizing:border-box}
    body{padding:32px;color:#0f172a}
    .head{display:flex;align-items:center;gap:16px;border-bottom:2px solid #4f46e5;padding-bottom:16px;margin-bottom:20px}
    .head.centered{flex-direction:column;text-align:center}
    .logo{width:52px;height:52px;border-radius:12px;background:linear-gradient(135deg,#3b82f6,#4f46e5);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:20px}
    h1{margin:0;font-size:20px}
    h2{font-size:14px;margin:18px 0 6px;color:#4f46e5}
    table{width:100%;border-collapse:collapse;font-size:13px;margin-bottom:12px}
    td{border:1px solid #e2e8f0;padding:7px 10px}
    td.k{background:#f8fafc;font-weight:600;width:200px}
    th{border:1px solid #e2e8f0;padding:7px 10px;background:#f8fafc;text-align:left}
    .foot{margin-top:24px;font-size:11px;color:#94a3b8;text-align:center}
    @media print{body{padding:0}}
  </style></head><body>
  <div class="head${centered ? " centered" : ""}">${logo}<div><h1>${escapeHtml(school.name)}</h1><div style="color:#475569;font-size:13px">${teacherHeader || "Teacher Profile"}</div></div></div>
  <h2>Teacher Information</h2>
  <table>
    ${row("Teacher ID", teacher.code)}
    ${row("Full Name", teacher.fullName)}
    ${row("Gender", genderLabel(teacher.gender))}
    ${row("Phone", teacher.phone)}
    ${row("Email", teacher.email ?? "—")}
    ${row("Qualification", teacher.qualification ?? "—")}
    ${row("Salary", money(teacher.salary))}
    ${row("Shift", shiftLabel(teacher.shift))}
    ${row("Status", statusLabel(teacher.status))}
    ${row("Registration Date", shortDate(teacher.registrationDate))}
  </table>
  <h2>Assignments</h2>
  <table>
    <thead><tr><th>Academic Year</th><th>Class</th><th>Section</th><th>Shift</th><th>Subject</th></tr></thead>
    <tbody>${assignRows || '<tr><td colspan="5">No assignments</td></tr>'}</tbody>
  </table>
  ${teacherFooter ? `<div class="foot">${escapeHtml(teacherFooter)}</div>` : ""}
  <script>window.onload=function(){window.print()}</script>
  </body></html>`);
  w.document.close();
}
