"use client";

import { PRINT_HEADER_CSS, printHeaderHtml } from "@/lib/print/header";
import type { StudentCaseRecord } from "./types";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function printStudentCases(opts: {
  scope: string;
  rows: StudentCaseRecord[];
}) {
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
    ${PRINT_HEADER_CSS}
    table{width:100%;border-collapse:collapse;font-size:12px;margin-top:12px}
    th,td{border:1px solid #cbd5e1;padding:6px 8px;text-align:left}
    th{background:#f1f5f9}
  </style></head><body>
  ${printHeaderHtml(`Student Cases · ${escapeHtml(opts.scope)} · Total: ${opts.rows.length}`)}
  <table>
    <thead><tr><th>#</th><th>Student ID</th><th>Student Name</th><th>Case</th><th>Note</th><th>Date</th><th>Recorded By</th></tr></thead>
    <tbody>${body}</tbody>
  </table>
  <script>window.onload=function(){window.print()}</script>
  </body></html>`);
  w.document.close();
}
