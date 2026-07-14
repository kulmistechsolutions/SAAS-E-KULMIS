import { parseCsv } from "@/lib/csv";
import { getState as getStudentsState } from "@/lib/students/store";
import type { Exam, ExamMark } from "./types";
import { gradeFromAverage } from "./format";

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
