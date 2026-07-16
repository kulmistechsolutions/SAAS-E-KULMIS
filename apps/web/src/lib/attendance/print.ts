"use client";

import { schoolBranding } from "@/lib/settings/store";
import { studentStatusLabel, teacherStatusLabel, formatDisplayDate } from "./format";
import type { StudentAttendanceStatus, TeacherAttendanceStatus } from "./types";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function printStudentAttendanceSheet(opts: {
  academicYear: string;
  date: string;
  className: string;
  section: string;
  rows: { serial: number; code: string; name: string; status: StudentAttendanceStatus }[];
  summary: { total: number; present: number; absent: number; late: number; excused: number; percentage: number };
}) {
  const school = schoolBranding();
  const logo = school.logoUrl
    ? `<img src="${school.logoUrl}" alt="" class="logo" style="object-fit:cover"/>`
    : `<div class="logo">${school.name.slice(0, 2).toUpperCase()}</div>`;
  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) return;
  const body = opts.rows
    .map(
      (r) =>
        `<tr><td>${r.serial}</td><td>${r.code}</td><td>${escapeHtml(r.name)}</td><td>${studentStatusLabel(r.status)}</td><td></td></tr>`,
    )
    .join("");
  w.document.write(`<!DOCTYPE html><html><head><title>Attendance Sheet</title>
  <style>
    *{font-family:Arial,sans-serif;box-sizing:border-box}body{padding:32px;color:#0f172a}
    .head{display:flex;gap:16px;border-bottom:2px solid #4f46e5;padding-bottom:16px;margin-bottom:16px}
    .logo{width:52px;height:52px;border-radius:12px;background:linear-gradient(135deg,#3b82f6,#4f46e5);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:20px}
  table{width:100%;border-collapse:collapse;font-size:13px;margin-top:12px}
  th,td{border:1px solid #cbd5e1;padding:8px 10px;text-align:left}
  th{background:#f1f5f9}
  .summary{margin-top:16px;font-size:13px}
  .sign{margin-top:40px;display:flex;justify-content:space-between}
  .sign div{width:40%;border-top:1px solid #94a3b8;padding-top:8px;font-size:12px;color:#64748b}
  </style></head><body>
  <div class="head">${logo}<div>
    <h1>${escapeHtml(school.name)}</h1>
    <p style="color:#475569;font-size:13px;margin:4px 0 0">Student Attendance · ${opts.academicYear}</p>
    <p style="color:#475569;font-size:13px">${formatDisplayDate(opts.date)} · ${escapeHtml(opts.className)} · Section ${opts.section}</p>
  </div></div>
  <table>
    <thead><tr><th>#</th><th>Student ID</th><th>Student Name</th><th>Status</th><th>Remarks</th></tr></thead>
    <tbody>${body}</tbody>
  </table>
  <div class="summary">
    Total: ${opts.summary.total} · Present: ${opts.summary.present} · Absent: ${opts.summary.absent} · Late: ${opts.summary.late} · Excused: ${opts.summary.excused} · ${opts.summary.percentage}%
  </div>
  <div class="sign"><div>Teacher Signature</div><div>Administrator Signature</div></div>
  <script>window.onload=function(){window.print()}</script>
  </body></html>`);
  w.document.close();
}

export function exportStudentAttendanceCsv(
  rows: { code: string; name: string; className: string; section: string | null; date: string; status: StudentAttendanceStatus }[],
  fileName = "student-attendance.csv",
) {
  const headers = ["Student ID", "Student Name", "Class", "Section", "Date", "Status"];
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const lines = rows.map((r) =>
    [r.code, r.name, r.className, r.section ?? "", r.date, studentStatusLabel(r.status)].map(esc).join(","),
  );
  download([headers.join(","), ...lines].join("\n"), fileName);
}

export function printTeacherAttendanceSheet(opts: {
  academicYear: string;
  date: string;
  shift: string;
  rows: { serial: number; code: string; name: string; status: TeacherAttendanceStatus }[];
  summary: { total: number; present: number; absent: number; late: number; leave?: number; percentage: number };
}) {
  const school = schoolBranding();
  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) return;
  const body = opts.rows
    .map(
      (r) =>
        `<tr><td>${r.serial}</td><td>${r.code}</td><td>${escapeHtml(r.name)}</td><td>${teacherStatusLabel(r.status)}</td></tr>`,
    )
    .join("");
  w.document.write(`<!DOCTYPE html><html><head><title>Teacher Attendance</title>
  <style>*{font-family:Arial,sans-serif}body{padding:32px}table{width:100%;border-collapse:collapse;font-size:13px}th,td{border:1px solid #cbd5e1;padding:8px}th{background:#f1f5f9}</style></head><body>
  <h1>${escapeHtml(school.name)} — Teacher Attendance</h1>
  <p>${formatDisplayDate(opts.date)} · ${opts.shift} Shift · ${opts.academicYear}</p>
  <table><thead><tr><th>#</th><th>Teacher ID</th><th>Name</th><th>Status</th></tr></thead><tbody>${body}</tbody></table>
  <p style="margin-top:16px">Present: ${opts.summary.present} · Absent: ${opts.summary.absent} · Late: ${opts.summary.late} · Leave: ${opts.summary.leave ?? 0} · ${opts.summary.percentage}%</p>
  <script>window.onload=function(){window.print()}</script></body></html>`);
  w.document.close();
}

export function exportTeacherAttendanceCsv(
  rows: { code: string; name: string; shift: string; date: string; status: TeacherAttendanceStatus }[],
  fileName = "teacher-attendance.csv",
) {
  const headers = ["Teacher ID", "Name", "Shift", "Date", "Status"];
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const lines = rows.map((r) =>
    [r.code, r.name, r.shift, r.date, teacherStatusLabel(r.status)].map(esc).join(","),
  );
  download([headers.join(","), ...lines].join("\n"), fileName);
}

function download(content: string, fileName: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
