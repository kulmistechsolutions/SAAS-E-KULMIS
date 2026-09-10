import { parseCsv } from "@/lib/csv";
import { getState as getStudentsState } from "@/lib/students/store";
import { schoolBranding } from "@/lib/settings/store";
import type { Exam, ExamMark } from "./types";
import { gradeFromAverage } from "./format";
import type { ExamResultCardData } from "@/components/examinations/exam-result-card";
import { getGradeBands } from "@/lib/settings/store";
import { getStoredLang, translateIn } from "@/lib/i18n/provider";
import { dirOf } from "@/lib/i18n/config";
import { getStoredPaper, paperCss, type PaperSize } from "@/lib/print/paper";
import { getStoredTemplate, type DocTemplate } from "@/lib/print/template";
import {
  accentColour,
  documentFooterHtml,
  letterheadHtml,
  LETTERHEAD_CSS,
  signatureHtml,
  stampHtml,
  watermarkHtml,
} from "@/lib/print/letterhead";

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

  // The school's chosen design, when it has chosen the branded one. Everything
  // below is the original card and stays exactly as it was.
  const premium = resultCardDocumentHtml(data, qrDataUrl);
  if (premium) {
    w.document.write(premium);
    w.document.close();
    w.focus();
    w.print();
    return;
  }

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
    .head { display: flex; align-items: center; gap: 16px; padding: 20px 24px; background: ${school.primaryColor || "#4f46e5"}; color: #fff; }
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

/**
 * The result card on official school paper.
 *
 * Same marks, same totals, same grade as the card on screen — this reads the
 * data it is handed and lays it out. What it adds is the letterhead a family
 * recognises, the school's own grading scale printed where a parent can check
 * the letter against the number, and the signature and stamp areas that make a
 * result sheet something a school can issue rather than merely display.
 *
 * The subject table is kept whole. A result card that breaks across a page
 * boundary mid-table is the one document nobody accepts, because half a list
 * of marks looks like a tampered one.
 */
export function premiumResultCardHtml(
  data: ExamResultCardData,
  qrDataUrl: string | null,
  paper: PaperSize = getStoredPaper(),
): string {
  const school = schoolBranding();
  const bands = getGradeBands();
  // A print window has no React tree to pull useT() from, so the language is
  // read the same way every other printed document reads it.
  const lang = getStoredLang();
  const dir = dirOf(lang);
  const tr = (k: Parameters<typeof translateIn>[1]) => translateIn(lang, k);

  const logoWatermark = watermarkHtml();

  const photo = data.studentPhotoUrl
    ? `<img src="${data.studentPhotoUrl}" alt="" class="rc-photo"/>`
    : "";

  // One column per exam when the card covers a whole group, otherwise the
  // single-exam table. Both end in the same totals, so the summary beside them
  // is true either way.
  let table: string;
  if (data.group) {
    const cols = data.group.examColumns;
    table = `<table class="rc-marks">
      <thead><tr>
        <th class="s">${tr("resultCardPrint.subject")}</th>
        ${cols
          .map(
            (c) =>
              `<th class="num">${escapeHtml(c.label)}<span class="dim">/${c.maxMarks}</span></th>`,
          )
          .join("")}
        <th class="num">${tr("resultCardPrint.combinedPercent")}</th>
        <th class="g">${tr("resultCardPrint.grade")}</th>
      </tr></thead>
      <tbody>${data.group.subjectRows
        .map(
          (row) => `<tr>
            <td class="s">${escapeHtml(row.subject)}</td>
            ${cols
              .map((c) => `<td class="num">${row.perExam[c.examId] ?? "—"}</td>`)
              .join("")}
            <td class="num b">${row.combinedPercent.toFixed(1)}%</td>
            <td class="g">${escapeHtml(row.grade)}</td>
          </tr>`,
        )
        .join("")}</tbody>
    </table>`;
  } else {
    table = `<table class="rc-marks">
      <thead><tr>
        <th class="n">#</th>
        <th class="s">${tr("resultCardPrint.subject")}</th>
        <th class="num">${tr("resultCardPrint.maxMarks")}</th>
        <th class="num">${tr("resultCardPrint.marksObtained")}</th>
        <th class="g">${tr("resultCardPrint.grade")}</th>
      </tr></thead>
      <tbody>${data.subjects
        .map(
          (s, i) => `<tr>
            <td class="n">${i + 1}</td>
            <td class="s">${escapeHtml(s.subject)}</td>
            <td class="num">${s.maxMarks}</td>
            <td class="num b">${s.marksObtained ?? "—"}</td>
            <td class="g">${escapeHtml(s.grade)}</td>
          </tr>`,
        )
        .join("")}</tbody>
      <tfoot><tr>
        <td class="n"></td>
        <td class="s">${tr("resultCardPrint.total")}</td>
        <td class="num">${data.totalMax}</td>
        <td class="num">${data.totalObtained}</td>
        <td class="g">${escapeHtml(data.grade)}</td>
      </tr></tfoot>
    </table>`;
  }

  // The school's own bands, printed so a parent can check the letter against
  // the number rather than take it on trust.
  const scale = bands
    .map(
      (b) =>
        `<div><b>${escapeHtml(b.grade)}</b><span>${b.min} – ${b.max}</span></div>`,
    )
    .join("");

  const summary = [
    [tr("resultCardPrint.totalMarks"), `${data.totalObtained} / ${data.totalMax}`],
    [tr("resultCardPrint.percentage"), `${data.average.toFixed(2)}%`],
    [tr("resultCardPrint.grade"), data.grade],
    [
      tr("resultCardPrint.result"),
      data.passed ? tr("resultCardPrint.pass") : tr("resultCardPrint.fail"),
    ],
    ...(data.term ? [[tr("resultCardPrint.term"), data.term]] : []),
  ]
    .map(
      ([k, v]) =>
        `<tr><td class="k">${escapeHtml(k!)}</td><td class="v">${escapeHtml(v!)}</td></tr>`,
    )
    .join("");

  return `<!doctype html><html lang="${lang}" dir="${dir}"><head><meta charset="utf-8"/>
<title>${escapeHtml(data.studentName)} — ${escapeHtml(data.examName)}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#0f172a}
  ${paperCss(paper)}
  ${LETTERHEAD_CSS}
  .rc-photo{width:74px;height:88px;object-fit:cover;border:1px solid #cbd5e1;
    border-radius:6px;background:#fff}
  .rc-top{display:flex;gap:14px;align-items:flex-start}
  .rc-top > .sec{flex:1;margin-top:0}
  .rc-photo-wrap{margin-top:14px}
  table.rc-marks{width:100%;border-collapse:collapse}
  table.rc-marks th{background:#eff6ff;color:#1e3a8a;font-size:10px;font-weight:700;
    text-transform:uppercase;letter-spacing:.05em;padding:8px 10px;text-align:start;
    border-bottom:1px solid #dbeafe}
  table.rc-marks td{padding:7px 10px;font-size:12px;border-bottom:1px solid #f1f5f9}
  table.rc-marks .n{width:30px;color:#94a3b8}
  table.rc-marks .num{text-align:end;font-variant-numeric:tabular-nums;white-space:nowrap}
  table.rc-marks .num.b{font-weight:700}
  table.rc-marks .g{text-align:center;width:78px;font-weight:700}
  table.rc-marks .dim{display:block;font-weight:400;opacity:.7;font-size:9px}
  table.rc-marks tfoot td{background:#f8fafc;font-weight:800;font-size:13px;border-bottom:none}
  /* A result sheet split across a page break reads as a tampered one. */
  table.rc-marks, .sec{page-break-inside:avoid}
  .scale{display:flex;flex-wrap:wrap;gap:6px;padding:10px 14px}
  .scale div{border:1px solid #e2e8f0;border-radius:6px;padding:4px 10px;font-size:10.5px}
  .scale b{color:var(--ek-accent,#1e40af);margin-inline-end:6px}
  .scale span{color:#64748b;font-variant-numeric:tabular-nums}
  .rc-qr{width:78px;height:78px}
  .issued{margin-top:10px;font-size:10px;color:#64748b;text-align:end}
  @media print{ .doc-watermark{position:absolute} }
</style></head><body>
<div class="doc" style="--ek-accent:${accentColour()}">
  ${logoWatermark}
  ${letterheadHtml({
    title: tr("resultCardPrint.title"),
    subtitle: tr("resultCardPrint.subtitle"),
    refLabel: tr("resultCardPrint.exam"),
    refValue: data.examName,
  })}

  <div class="rc-top">
    <div class="sec" style="margin-top:14px">
      <div class="sec-head">${tr("resultCardPrint.studentInformation")}</div>
      <table class="kv">
        <tr><td class="k">${tr("resultCardPrint.studentName")}</td><td class="v">${escapeHtml(data.studentName)}</td></tr>
        <tr><td class="k">${tr("resultCardPrint.studentId")}</td><td class="v">${escapeHtml(data.studentCode)}</td></tr>
        <tr><td class="k">${tr("resultCardPrint.classSection")}</td><td class="v">${escapeHtml(data.className)}${data.section ? " - " + escapeHtml(data.section) : ""}</td></tr>
        ${data.academicYear ? `<tr><td class="k">${tr("resultCardPrint.academicYear")}</td><td class="v">${escapeHtml(data.academicYear)}</td></tr>` : ""}
      </table>
    </div>
    <div class="sec" style="margin-top:14px">
      <div class="sec-head">${tr("resultCardPrint.performanceSummary")}</div>
      <table class="kv">${summary}</table>
    </div>
    ${photo ? `<div class="rc-photo-wrap">${photo}</div>` : ""}
  </div>

  <div class="sec">
    <div class="sec-head">${tr("resultCardPrint.subjectsAndMarks")}</div>
    ${table}
  </div>

  <div class="sec">
    <div class="sec-head">${tr("resultCardPrint.gradingScale")}</div>
    <div class="scale">${scale}</div>
  </div>

  <div class="signs">
    <div class="sign"><div class="rule"></div><div class="role">${tr("resultCardPrint.classTeacher")}</div></div>
    ${
      qrDataUrl
        ? `<img src="${qrDataUrl}" alt="" class="rc-qr"/>`
        : stampHtml(tr("feesReceiptPrint.stampLine1"), tr("feesReceiptPrint.stampLine2"))
    }
    ${signatureHtml(tr("feesReceiptPrint.principal"), school.principalName)}
  </div>

  <div class="issued">${tr("resultCardPrint.dateOfIssue")}: ${new Date().toISOString().slice(0, 10)}</div>
  ${documentFooterHtml()}
</div></body></html>`;
}

/** The result card in whichever design this school has chosen. */
export function resultCardDocumentHtml(
  data: ExamResultCardData,
  qrDataUrl: string | null,
  paper: PaperSize = getStoredPaper(),
  template: DocTemplate = getStoredTemplate(),
): string | null {
  // CLASSIC keeps its own window-writing path; only PREMIUM returns markup.
  return template === "PREMIUM"
    ? premiumResultCardHtml(data, qrDataUrl, paper)
    : null;
}
