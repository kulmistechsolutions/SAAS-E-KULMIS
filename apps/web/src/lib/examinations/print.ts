import { parseCsv } from "@/lib/csv";
import { getState as getStudentsState } from "@/lib/students/store";
import { schoolBranding } from "@/lib/settings/store";
import type { Exam, ExamMark } from "./types";
import { gradeFromAverage } from "./format";
import type { ExamResultCardData } from "@/components/examinations/exam-result-card";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Opens a standalone print window instead of relying on `@media print` +
 * `visibility:hidden` tricks on the live page. The card is normally shown
 * inside a Dialog (fixed, height-constrained, scrollable) — printing the
 * page in place clips the output to that box, which is why the printout
 * came out nearly blank. A separate window with its own plain document has
 * no such container to be clipped by, so it paginates correctly on any
 * paper size.
 */
export function printExamResultCard(
  data: ExamResultCardData,
  qrDataUrl: string | null,
) {
  const school = schoolBranding();
  const w = window.open("", "_blank", "width=900,height=1000");
  if (!w) return;

  const logo = school.logoUrl
    ? `<img src="${school.logoUrl}" alt="" class="logo-img"/>`
    : `<div class="logo-fallback">${escapeHtml(school.name.slice(0, 2).toUpperCase())}</div>`;

  const photo = data.studentPhotoUrl
    ? `<img src="${data.studentPhotoUrl}" alt="" class="student-photo"/>`
    : "";

  const infoRows = [
    ["Student", data.studentName],
    ["Student ID", data.studentCode],
    ["Class", data.className],
    ["Section", data.section ?? "—"],
    ...(data.academicYear ? [["Academic Year", data.academicYear]] : []),
  ]
    .map(
      ([label, value]) =>
        `<div class="info"><p class="info-label">${escapeHtml(label!)}</p><p class="info-value">${escapeHtml(value!)}</p></div>`,
    )
    .join("");

  let table: string;
  if (data.group) {
    const cols = data.group.examColumns;
    const head = cols
      .map((c) => `<th>${escapeHtml(c.label)}<br/><span class="dim">/${c.maxMarks}</span></th>`)
      .join("");
    const rows = data.group.subjectRows
      .map(
        (row) => `<tr>
          <td class="subject">${escapeHtml(row.subject)}</td>
          ${cols.map((c) => `<td class="num">${row.perExam[c.examId] ?? "—"}</td>`).join("")}
          <td class="num strong">${row.combinedPercent}%</td>
          <td class="center"><span class="grade">${escapeHtml(row.grade)}</span></td>
        </tr>`,
      )
      .join("");
    table = `<table>
      <thead><tr><th>Subject</th>${head}<th>Combined</th><th>Grade</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr class="total">
        <td colspan="${1 + cols.length}">Total</td>
        <td class="num">${data.average}%</td>
        <td class="center"><span class="grade">${escapeHtml(data.grade)}</span></td>
      </tr></tfoot>
    </table>`;
  } else {
    const rows = data.subjects
      .map(
        (s) => `<tr>
          <td class="subject">${escapeHtml(s.subject)}</td>
          <td class="num">${s.marksObtained ?? "—"}</td>
          <td class="num dim">${s.maxMarks}</td>
          <td class="center"><span class="grade">${escapeHtml(s.grade)}</span></td>
        </tr>`,
      )
      .join("");
    table = `<table>
      <thead><tr><th>Subject</th><th>Marks</th><th>Out Of</th><th>Grade</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr class="total">
        <td>Total</td>
        <td class="num">${data.totalObtained}</td>
        <td class="num dim">${data.totalMax}</td>
        <td class="center"><span class="grade">${escapeHtml(data.grade)}</span></td>
      </tr></tfoot>
    </table>`;
  }

  const pct = data.totalMax > 0 ? (data.totalObtained / data.totalMax) * 100 : 0;
  const qr = qrDataUrl
    ? `<img src="${qrDataUrl}" alt="QR" class="qr-img"/>`
    : "";

  w.document.write(`<!DOCTYPE html><html><head><title>${escapeHtml(data.studentName)} — Exam Result</title>
  <style>
    @page { size: A4; margin: 16mm; }
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; color: #0f172a; margin: 0; padding: 24px; }
    .card { border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; }
    .head { display: flex; align-items: center; gap: 16px; padding: 20px 24px; background: linear-gradient(135deg, #4f46e5, #3b82f6); color: #fff; }
    .logo-img { width: 56px; height: 56px; border-radius: 12px; background: #fff; object-fit: contain; padding: 4px; }
    .logo-fallback { width: 56px; height: 56px; border-radius: 12px; background: rgba(255,255,255,.2); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 20px; }
    .head h1 { margin: 0; font-size: 18px; }
    .head p { margin: 2px 0 0; font-size: 12px; opacity: .85; }
    .head .kicker { text-transform: uppercase; letter-spacing: .05em; font-size: 11px; font-weight: 600; margin-top: 6px; }
    .body { display: flex; gap: 24px; padding: 24px; }
    .main { flex: 1; min-width: 0; }
    .info-row { display: flex; align-items: flex-start; gap: 16px; margin-bottom: 16px; }
    .student-photo { width: 64px; height: 64px; border-radius: 12px; object-fit: cover; flex-shrink: 0; border: 1px solid #e2e8f0; }
    .info-grid { flex: 1; min-width: 0; display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px 20px; font-size: 13px; margin-bottom: 0; }
    .info-label { margin: 0; color: #64748b; font-size: 11px; }
    .info-value { margin: 2px 0 0; font-weight: 600; }
    .exam-line { margin: 0 0 16px; font-size: 13px; }
    .exam-line .label { color: #64748b; font-size: 11px; display: block; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border: 1px solid #e2e8f0; padding: 8px 10px; text-align: left; }
    th { background: #f1f5f9; font-size: 11px; text-transform: uppercase; color: #64748b; }
    .num { text-align: right; }
    .center { text-align: center; }
    .dim { color: #94a3b8; }
    .strong { font-weight: 700; }
    .total { background: #f1f5f9; font-weight: 700; }
    .subject { font-weight: 600; }
    .grade { display: inline-block; min-width: 28px; padding: 2px 6px; border-radius: 6px; background: #e2e8f0; font-weight: 700; font-size: 11px; }
    .tiles { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 16px; }
    .tile { border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px; text-align: center; }
    .tile p:first-child { margin: 0; font-size: 10px; color: #64748b; }
    .tile p:last-child { margin: 4px 0 0; font-weight: 700; font-size: 15px; }
    .result-pass { color: #059669; }
    .result-fail { color: #e11d48; }
    .side { width: 150px; flex-shrink: 0; text-align: center; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 10px; align-self: flex-start; }
    .side p:first-child { margin: 0 0 8px; font-size: 11px; color: #64748b; font-weight: 600; }
    .qr-img { width: 120px; height: 120px; }
    .side .code { margin: 8px 0 0; font-size: 9px; color: #64748b; word-break: break-all; }
    .foot { border-top: 1px solid #e2e8f0; padding: 12px 24px; font-size: 11px; color: #64748b; background: #f8fafc; }
  </style></head><body>
  <div class="card">
    <div class="head">
      ${logo}
      <div>
        <h1>${escapeHtml(school.name)}</h1>
        ${school.tagline ? `<p>${escapeHtml(school.tagline)}</p>` : ""}
        <p class="kicker">Examination Result</p>
      </div>
    </div>
    <div class="body">
      <div class="main">
        <div class="info-row">${photo}<div class="info-grid">${infoRows}</div></div>
        <p class="exam-line"><span class="label">Examination</span><strong>${escapeHtml(data.examName)}${data.term ? ` · ${escapeHtml(data.term)}` : ""}</strong></p>
        ${table}
        <div class="tiles">
          <div class="tile"><p>Total</p><p>${data.totalObtained} / ${data.totalMax}</p></div>
          <div class="tile"><p>Average</p><p>${data.average.toFixed(1)}</p></div>
          <div class="tile"><p>Percentage</p><p>${pct.toFixed(1)}%</p></div>
          <div class="tile"><p>Result</p><p class="${data.passed ? "result-pass" : "result-fail"}">${data.passed ? "Pass" : "Fail"}</p></div>
        </div>
      </div>
      <div class="side">
        <p>Scan to verify</p>
        ${qr}
        <p class="code">${escapeHtml(data.studentCode)}</p>
      </div>
    </div>
    <div class="foot">${escapeHtml(school.name)} · Official examination result</div>
  </div>
  <script>window.onload = function(){ window.print(); }</script>
  </body></html>`);
  w.document.close();
}

export function exportMarksTemplate(
  exam: Exam,
  subject: string,
  marks: ExamMark[],
) {
  const students = getStudentsState()
    .students.filter(
      (s) =>
        s.status === "ACTIVE" &&
        s.academicYear === exam.academicYear &&
        s.className === exam.className &&
        (s.section ?? "") === exam.section,
    )
    .sort((a, b) => a.fullName.localeCompare(b.fullName));

  const header =
    "Student ID,Student Name,Class,Section,Subject,Marks\n";
  const rows = students
    .map((st) => {
      const m = marks.find(
        (x) => x.studentId === st.id && x.subject === subject,
      );
      return [
        st.code,
        `"${st.fullName}"`,
        exam.className,
        exam.section,
        subject,
        m?.marks ?? "",
      ].join(",");
    })
    .join("\n");

  downloadCsv(header + rows, `marks-${exam.name}-${subject}.csv`);
}

export function exportSchoolImportTemplate(exam: Exam) {
  const students = getStudentsState()
    .students.filter(
      (s) =>
        s.status === "ACTIVE" &&
        s.academicYear === exam.academicYear &&
        s.className === exam.className &&
        (s.section ?? "") === exam.section,
    )
    .sort((a, b) => a.fullName.localeCompare(b.fullName));

  const subjectCols = exam.subjects.join(",");
  const header = `Student ID,Student Name,Class,Section,${subjectCols}\n`;
  const rows = students
    .map((st) =>
      [
        st.code,
        `"${st.fullName}"`,
        exam.className,
        exam.section,
        ...exam.subjects.map(() => ""),
      ].join(","),
    )
    .join("\n");
  downloadCsv(header + rows, `school-import-${exam.name}.csv`);
}

export function parseMarksCsv(text: string): {
  studentId: string;
  studentName: string;
  marks: number | null;
}[] {
  const parsed = parseCsv(text.trim());
  if (parsed.length < 2) return [];
  const rows: { studentId: string; studentName: string; marks: number | null }[] =
    [];
  for (let i = 1; i < parsed.length; i++) {
    const cols = parsed[i]!;
    if (cols.length < 2) continue;
    const studentId = cols[0]!.trim();
    const studentName = cols[1]!.replace(/^"|"$/g, "").trim();
    const marksRaw = cols[cols.length - 1]?.trim();
    const marks =
      marksRaw === "" || marksRaw === undefined ? null : Number(marksRaw);
    if (marks !== null && Number.isNaN(marks)) continue;
    rows.push({ studentId, studentName, marks });
  }
  return rows;
}

export function exportResultsCsv(
  exam: Exam,
  results: {
    code: string;
    name: string;
    subject: string;
    marks: number;
    grade: string;
  }[],
) {
  const header = "Student ID,Student Name,Subject,Marks,Grade\n";
  const rows = results
    .map((r) =>
      [r.code, `"${r.name}"`, r.subject, r.marks, r.grade].join(","),
    )
    .join("\n");
  downloadCsv(header + rows, `results-${exam.name}.csv`);
}

function downloadCsv(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function calcStudentAverage(
  marks: number[],
  maxMarks: number,
): { average: number; grade: string; passed: boolean } {
  const avg = marks.length > 0 ? marks.reduce((a, b) => a + b, 0) / marks.length : 0;
  const pct = maxMarks > 0 ? (avg / maxMarks) * 100 : 0;
  return {
    average: avg,
    grade: gradeFromAverage(pct),
    passed: pct >= 50,
  };
}
