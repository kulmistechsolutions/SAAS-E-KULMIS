import { schoolBranding } from "@/lib/settings/store";
import { money, percent } from "./format";

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

interface PrintTableOptions {
  title: string;
  academicYear?: string;
  subtitle?: string;
  columns: string[];
  rows: (string | number)[][];
  preparedBy?: string;
}

export function printTable(opts: PrintTableOptions) {
  const school = schoolBranding();
  const logo = school.logoUrl
    ? `<img src="${school.logoUrl}" alt="" class="logo" style="object-fit:contain"/>`
    : `<div class="logo">${school.name.charAt(0)}</div>`;
  const centered = school.headerLayout === "CENTERED";
  const now = new Date();
  const head = opts.columns.map((c) => `<th>${c}</th>`).join("");
  const body = opts.rows
    .map(
      (r) =>
        `<tr>${r.map((cell) => `<td>${cell ?? ""}</td>`).join("")}</tr>`,
    )
    .join("");

  const html = `<!doctype html><html><head><meta charset="utf-8"/><title>${opts.title}</title>
  <style>
    * { font-family: system-ui, -apple-system, Segoe UI, sans-serif; }
    body { padding: 32px; color: #0f172a; }
    .head { display:flex; align-items:center; gap:12px; border-bottom:2px solid #6366f1; padding-bottom:14px; margin-bottom:18px; }
    .head.centered { flex-direction:column; text-align:center; }
    .logo { width:44px; height:44px; border-radius:10px; background:#6366f1; color:#fff; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:20px; }
    h1 { margin:0; font-size:20px; }
    .muted { color:#64748b; font-size:13px; }
    h2 { font-size:16px; margin:4px 0 12px; }
    table { width:100%; border-collapse:collapse; font-size:13px; }
    th, td { border:1px solid #e2e8f0; padding:8px 10px; text-align:left; }
    th { background:#f1f5f9; font-weight:600; }
    .foot { margin-top:24px; display:flex; justify-content:space-between; font-size:12px; color:#64748b; }
  </style></head><body>
    <div class="head${centered ? " centered" : ""}">
      ${logo}
      <div>
        <h1>${school.name}</h1>
        <div class="muted">${opts.academicYear ? `Academic Year: ${opts.academicYear}` : ""}</div>
      </div>
    </div>
    <h2>${opts.title}</h2>
    ${opts.subtitle ? `<p class="muted">${opts.subtitle}</p>` : ""}
    <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
    <div class="foot">
      <span>Prepared by: ${opts.preparedBy ?? "Admin User"}</span>
      <span>${now.toLocaleString()}</span>
    </div>
    <script>window.onload = () => { window.print(); }</script>
  </body></html>`;

  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) return;
  w.document.write(html);
  w.document.close();
}

export interface ClassReportSectionDef {
  key: string;
  label: string;
}

/** Every section the class-report print can include, in canonical output order. */
export const CLASS_REPORT_SECTIONS: ClassReportSectionDef[] = [
  { key: "overview", label: "Class Overview" },
  { key: "subjects", label: "Subjects & Teachers" },
  { key: "students", label: "Student List" },
  { key: "sections", label: "Sections" },
  { key: "attendance", label: "Attendance Summary" },
  { key: "exams", label: "Examinations" },
  { key: "fees", label: "Fee Summary" },
];

/** Matches what the person asking for a class report actually wants first. */
export const DEFAULT_CLASS_REPORT_SECTIONS = ["subjects", "students"];

export interface ClassReportSubjectRow {
  subject: string;
  code: string;
  /** Comma-joined teacher name(s), or "Not assigned" when nobody teaches it yet. */
  teacher: string;
  /** True when a teacher is assigned to this subject for this class but the
   *  subject itself was never added to the class's subject list — a data
   *  mismatch worth flagging rather than silently hiding. */
  unlisted: boolean;
}

export interface ClassReportData {
  className: string;
  academicYear: string;
  status: string;
  hasSections: boolean;
  notes?: string | null;
  stats: {
    totalStudents: number;
    maleStudents: number;
    femaleStudents: number;
    totalSections: number;
    attendancePercentage: number;
    examAverage: number;
    feeCollected: number;
    feeExpected: number;
  };
  sections: { name: string; status: string }[];
  students: { code: string; fullName: string; gender: string; section: string }[];
  subjectRows: ClassReportSubjectRow[];
  exams: { name: string; section: string; status: string }[];
}

export function printClassReport(selectedKeys: string[], data: ClassReportData) {
  const school = schoolBranding();
  const logo = school.logoUrl
    ? `<img src="${school.logoUrl}" alt="" class="logo" style="object-fit:contain"/>`
    : `<div class="logo">${school.name.slice(0, 2).toUpperCase()}</div>`;
  const centered = school.headerLayout === "CENTERED";
  const selected = new Set(
    selectedKeys.length > 0 ? selectedKeys : DEFAULT_CLASS_REPORT_SECTIONS,
  );

  const parts: string[] = [];

  if (selected.has("overview")) {
    parts.push(`
      <h2>Class Overview</h2>
      <table>
        <tbody>
          <tr><td class="k">Academic Year</td><td>${escapeHtml(data.academicYear)}</td></tr>
          <tr><td class="k">Status</td><td>${escapeHtml(data.status)}</td></tr>
          <tr><td class="k">Has Sections</td><td>${data.hasSections ? "Yes" : "No"}</td></tr>
          <tr><td class="k">Total Students</td><td>${data.stats.totalStudents} (${data.stats.maleStudents} male, ${data.stats.femaleStudents} female)</td></tr>
          <tr><td class="k">Notes</td><td>${escapeHtml(data.notes || "—")}</td></tr>
        </tbody>
      </table>`);
  }

  if (selected.has("subjects")) {
    const rows = data.subjectRows
      .map(
        (r) => `<tr${r.unlisted ? ' class="flag"' : ""}>
          <td>${escapeHtml(r.subject)}</td>
          <td>${escapeHtml(r.code || "—")}</td>
          <td>${escapeHtml(r.teacher)}</td>
          <td>${r.unlisted ? "⚠ Not in class subject list" : ""}</td>
        </tr>`,
      )
      .join("");
    parts.push(`
      <h2>Subjects &amp; Teachers</h2>
      <table>
        <thead><tr><th>Subject</th><th>Code</th><th>Teacher</th><th></th></tr></thead>
        <tbody>${rows || '<tr><td colspan="4">No subjects assigned.</td></tr>'}</tbody>
      </table>`);
  }

  if (selected.has("students")) {
    const rows = data.students
      .map(
        (s, i) => `<tr>
          <td>${i + 1}</td>
          <td>${escapeHtml(s.code)}</td>
          <td>${escapeHtml(s.fullName)}</td>
          <td>${escapeHtml(s.gender)}</td>
          <td>${escapeHtml(s.section)}</td>
        </tr>`,
      )
      .join("");
    parts.push(`
      <h2>Student List (${data.students.length})</h2>
      <table>
        <thead><tr><th>#</th><th>Student ID</th><th>Name</th><th>Gender</th><th>Section</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="5">No students enrolled.</td></tr>'}</tbody>
      </table>`);
  }

  if (selected.has("sections")) {
    const rows = data.sections
      .map((s) => `<tr><td>${escapeHtml(s.name)}</td><td>${escapeHtml(s.status)}</td></tr>`)
      .join("");
    parts.push(`
      <h2>Sections</h2>
      <table>
        <thead><tr><th>Section</th><th>Status</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="2">No sections.</td></tr>'}</tbody>
      </table>`);
  }

  if (selected.has("attendance")) {
    parts.push(`
      <h2>Attendance Summary</h2>
      <table>
        <tbody>
          <tr><td class="k">Attendance Rate</td><td>${percent(data.stats.attendancePercentage)}</td></tr>
          <tr><td class="k">Total Students</td><td>${data.stats.totalStudents}</td></tr>
          <tr><td class="k">Sections</td><td>${data.stats.totalSections}</td></tr>
        </tbody>
      </table>`);
  }

  if (selected.has("exams")) {
    const rows = data.exams
      .map(
        (e) =>
          `<tr><td>${escapeHtml(e.name)}</td><td>${escapeHtml(e.section)}</td><td>${escapeHtml(e.status)}</td></tr>`,
      )
      .join("");
    parts.push(`
      <h2>Examinations</h2>
      <table>
        <thead><tr><th>Exam</th><th>Section</th><th>Status</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="3">No examinations for this class.</td></tr>'}</tbody>
      </table>`);
  }

  if (selected.has("fees")) {
    parts.push(`
      <h2>Fee Summary</h2>
      <table>
        <tbody>
          <tr><td class="k">Expected</td><td>${money(data.stats.feeExpected)}</td></tr>
          <tr><td class="k">Collected</td><td>${money(data.stats.feeCollected)}</td></tr>
          <tr><td class="k">Outstanding</td><td>${money(data.stats.feeExpected - data.stats.feeCollected)}</td></tr>
        </tbody>
      </table>`);
  }

  const html = `<!doctype html><html><head><meta charset="utf-8"/><title>${escapeHtml(data.className)} — Class Report</title>
  <style>
    * { font-family: system-ui, -apple-system, Segoe UI, sans-serif; box-sizing: border-box; }
    body { padding: 32px; color: #0f172a; }
    .head { display:flex; align-items:center; gap:12px; border-bottom:2px solid #6366f1; padding-bottom:14px; margin-bottom:20px; }
    .head.centered { flex-direction:column; text-align:center; }
    .logo { width:48px; height:48px; border-radius:12px; background:linear-gradient(135deg,#3b82f6,#6366f1); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:20px; }
    h1 { margin:0; font-size:20px; }
    .muted { color:#64748b; font-size:13px; margin-top:2px; }
    h2 { font-size:15px; margin:22px 0 8px; color:#4f46e5; }
    h2:first-of-type { margin-top:0; }
    table { width:100%; border-collapse:collapse; font-size:13px; }
    th, td { border:1px solid #e2e8f0; padding:7px 10px; text-align:left; }
    th { background:#f8fafc; font-weight:600; }
    td.k { background:#f8fafc; font-weight:600; width:220px; }
    tr.flag td { background:#fffbeb; }
    .foot { margin-top:28px; display:flex; justify-content:space-between; font-size:11px; color:#94a3b8; border-top:1px solid #e2e8f0; padding-top:12px; }
    @media print { body { padding: 0; } }
  </style></head><body>
    <div class="head${centered ? " centered" : ""}">
      ${logo}
      <div>
        <h1>${escapeHtml(school.name)}</h1>
        <div class="muted">${escapeHtml(data.className)} · Academic Year ${escapeHtml(data.academicYear)} — Class Report</div>
      </div>
    </div>
    ${parts.join("")}
    <div class="foot">
      <span>Prepared by: Admin User</span>
      <span>${new Date().toLocaleString()}</span>
    </div>
    <script>window.onload = () => { window.print(); }</script>
  </body></html>`;

  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) return;
  w.document.write(html);
  w.document.close();
}
