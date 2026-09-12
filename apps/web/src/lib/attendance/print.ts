"use client";

import { PRINT_HEADER_CSS, printHeaderHtml } from "@/lib/print/header";
import { studentStatusLabel, teacherStatusLabel, formatDisplayDate } from "./format";
import type { StudentAttendanceStatus, TeacherAttendanceStatus } from "./types";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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
  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) return;
  const body = opts.rows
    .map(
      (r) =>
        `<tr><td>${r.serial}</td><td>${r.code}</td><td>${escapeHtml(r.name)}</td><td>${teacherStatusLabel(r.status)}</td></tr>`,
    )
    .join("");
  w.document.write(`<!DOCTYPE html><html><head><title>Teacher Attendance</title>
  <style>*{font-family:Arial,sans-serif;box-sizing:border-box}body{padding:32px;color:#0f172a}${PRINT_HEADER_CSS}table{width:100%;border-collapse:collapse;font-size:13px}th,td{border:1px solid #cbd5e1;padding:8px}th{background:#f1f5f9}</style></head><body>
  ${printHeaderHtml(`Teacher Attendance · ${formatDisplayDate(opts.date)} · ${escapeHtml(opts.shift)} Shift · ${escapeHtml(opts.academicYear)}`)}
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
