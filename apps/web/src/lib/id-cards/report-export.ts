"use client";

import { schoolBranding } from "@/lib/settings/store";
import type { CardReport, CardReportStudent } from "./api";

/**
 * ID card report exports (PRD §29).
 *
 * CSV opens directly in Excel, and the printable sheet goes through the same
 * browser print pipeline the cards themselves use — so "Save as PDF" produces
 * real text rather than a rasterised screenshot.
 */

function esc(v: string | number): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function download(name: string, body: string, mime: string) {
  const blob = new Blob([body], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

const COUNT_LABELS: [string, string][] = [
  ["total", "Total cards issued"],
  ["generated", "Generated (not yet printed)"],
  ["printed", "Printed"],
  ["reprints", "Reprints"],
  ["replaced", "Replaced"],
  ["studentsWithCards", "Students with a card"],
  ["withoutCards", "Students without a card"],
  ["withoutPhotos", "Students without a photo"],
  ["activeStudents", "Active students"],
];

export function exportCardReportCsv(report: CardReport) {
  const lines: string[] = ["Summary", "Measure,Value"];
  for (const [key, label] of COUNT_LABELS) {
    lines.push(`${esc(label)},${esc(report.counts[key] ?? 0)}`);
  }

  const section = (title: string, rows: CardReportStudent[]) => {
    lines.push("", title, "Student ID,Student,Class,Section");
    if (rows.length === 0) lines.push("None");
    for (const r of rows) {
      lines.push([r.code, r.name, r.className, r.section].map(esc).join(","));
    }
  };
  section("Students without a photo", report.withoutPhotos);
  section("Students without a card", report.withoutCards);

  // The BOM makes Excel read the file as UTF-8, so Somali and Arabic names do
  // not arrive as mojibake.
  download("id-card-report.csv", `﻿${lines.join("\n")}`, "text/csv;charset=utf-8;");
}

function table(title: string, rows: CardReportStudent[]): string {
  const body =
    rows.length === 0
      ? `<tr><td colspan="4" class="none">None</td></tr>`
      : rows
          .map(
            (r) =>
              `<tr><td class="mono">${esc(r.code)}</td><td>${esc(r.name)}</td><td>${esc(
                r.className,
              )}</td><td>${esc(r.section)}</td></tr>`,
          )
          .join("");
  return `<h2>${title} <span class="n">(${rows.length})</span></h2>
    <table><thead><tr><th>Student ID</th><th>Student</th><th>Class</th><th>Section</th></tr></thead>
    <tbody>${body}</tbody></table>`;
}

export function printCardReport(report: CardReport) {
  const school = schoolBranding();
  const w = window.open("", "_blank", "width=900,height=760");
  if (!w) return false;

  const cards = COUNT_LABELS.map(
    ([key, label]) =>
      `<div class="stat"><b>${report.counts[key] ?? 0}</b><span>${label}</span></div>`,
  ).join("");

  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/>
  <title>ID Card Report</title><style>
    *{font-family:Arial,Helvetica,sans-serif;box-sizing:border-box}
    body{padding:28px;color:#0f172a}
    .head{border-bottom:2px solid #1d4ed8;padding-bottom:12px;margin-bottom:16px}
    h1{margin:0;font-size:20px}
    .meta{color:#475569;font-size:12px;margin-top:4px}
    .stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:18px}
    .stat{border:1px solid #e2e8f0;border-radius:8px;padding:10px;text-align:center}
    .stat b{display:block;font-size:18px}
    .stat span{font-size:11px;color:#64748b}
    h2{font-size:14px;margin:18px 0 6px;color:#1d4ed8}
    h2 .n{color:#94a3b8;font-weight:400}
    table{width:100%;border-collapse:collapse;font-size:12px}
    th,td{border:1px solid #cbd5e1;padding:6px 8px;text-align:left}
    th{background:#f1f5f9}
    td.mono{font-family:"Courier New",monospace}
    td.none{color:#94a3b8;text-align:center}
    @media print{body{padding:0}}
  </style></head><body>
  <div class="head"><h1>${esc(school.name)}</h1>
    <div class="meta">ID Card Report · Generated ${new Date().toLocaleString()}</div></div>
  <div class="stats">${cards}</div>
  ${table("Students without a photo", report.withoutPhotos)}
  ${table("Students without a card", report.withoutCards)}
  <script>window.onload=function(){window.print()}</script>
  </body></html>`);
  w.document.close();
  return true;
}
