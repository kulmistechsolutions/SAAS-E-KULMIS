"use client";

import { getSettings, schoolBranding } from "@/lib/settings/store";
import { printPersonDocument } from "@/lib/documents/people-docs";
import type { DocDesign } from "@/lib/documents/doc-shell";
import { designFor } from "@/lib/print/design-store";
import { shortDate, statusLabel } from "@/lib/students/format";
import { PRINT_HEADER_CSS, escapeHtml, printHeaderHtml } from "@/lib/print/header";
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

/**
 * One guardian's record, printed in whatever design the school has chosen.
 *
 * Drew its own layout until the document engine took it over, which made it
 * one of the pages that ignored the school's own design settings.
 */
export function printParentProfile(parent: Parent, children: Student[]) {
  const design = designFor("PARENT_PROFILE");
  printPersonDocument(
    {
      type: "PARENT",
      parent,
      // The engine wants the joined shape; a guardian's own record is the
      // parent on each of their children, so it is the one we already hold.
      children: children.map((c) => ({ ...c, parent })),
    },
    {
      kind: "PARENT_INFO",
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

export function printParentsList(
  rows: ParentRow[],
  meta: { status: string },
  fieldKeys: string[] = DEFAULT_PARENT_EXPORT_FIELDS,
) {
  const fields = resolveParentFields(fieldKeys);
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
  <style>*{font-family:Arial,sans-serif;box-sizing:border-box}body{padding:32px;color:#0f172a}${PRINT_HEADER_CSS}table{width:100%;border-collapse:collapse;font-size:13px}th,td{border:1px solid #cbd5e1;padding:7px}th{background:#f1f5f9}</style></head><body>
  ${printHeaderHtml(`Parent List · Status: ${escapeHtml(meta.status)}`)}
  <table><thead><tr><th>#</th>${headCells}</tr></thead>
  <tbody>${body || `<tr><td colspan="${fields.length + 1}">No parents</td></tr>`}</tbody></table>
  <script>window.onload=function(){window.print()}</script></body></html>`);
  w.document.close();
}
