"use client";

import { schoolBranding } from "@/lib/settings/store";
import type { StudentCaseRecord } from "./types";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function printStudentCases(opts: {
  scope: string;
  rows: StudentCaseRecord[];
}) {
  const school = schoolBranding();
  const logo = school.logoUrl
    ? `<img src="${school.logoUrl}" alt="" class="logo" style="object-fit:contain"/>`
    : `<div class="logo">${school.name.slice(0, 2).toUpperCase()}</div>`;
  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) return;
  const body = opts.rows
    .map(
      (r, i) =>
        `<tr><td>${i + 1}</td><td>${r.studentCode}</td><td>${escapeHtml(r.studentName)}</td><td>${escapeHtml(r.title)}</td><td>${escapeHtml(r.note ?? "")}</td><td>${r.date}</td><td>${escapeHtml(r.recordedByUsername ?? "")}</td></tr>`,
    )
    .join("");
  w.document.write(`<!DOCTYPE html><html><head><title>Student Cases</title>
  <style>
    *{font-family:Arial,sans-serif;box-sizing:border-box}body{padding:32px;color:#0f172a}
    .head{display:flex;gap:16px;border-bottom:2px solid #4f46e5;padding-bottom:16px;margin-bottom:16px}
    .logo{width:52px;height:52px;border-radius:12px;background:linear-gradient(135deg,#3b82f6,#4f46e5);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:20px}
    table{width:100%;border-collapse:collapse;font-size:12px;margin-top:12px}
    th,td{border:1px solid #cbd5e1;padding:6px 8px;text-align:left}
    th{background:#f1f5f9}
  </style></head><body>
  <div class="head">${logo}<div>
    <h1>${escapeHtml(school.name)}</h1>
    <p style="color:#475569;font-size:13px;margin:4px 0 0">Student Cases · ${escapeHtml(opts.scope)}</p>
    <p style="color:#475569;font-size:13px">Total: ${opts.rows.length}</p>
  </div></div>
  <table>
    <thead><tr><th>#</th><th>Student ID</th><th>Student Name</th><th>Case</th><th>Note</th><th>Date</th><th>Recorded By</th></tr></thead>
    <tbody>${body}</tbody>
  </table>
  <script>window.onload=function(){window.print()}</script>
  </body></html>`);
  w.document.close();
}
