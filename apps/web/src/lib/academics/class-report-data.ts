import { getState as getStudentsState } from "@/lib/students/store";
import { getTeachersState } from "@/lib/teachers/store";
import { getExaminationsState } from "@/lib/examinations/store";
import {
  classStatistics,
  getClass,
  sectionsForClass,
  subjectsForClass,
} from "./store";
import type { ClassReportData, ClassReportSubjectRow } from "./print";

/**
 * Everything printClassReport needs for one class, assembled from the same
 * sources the class profile page reads — kept in one place so the profile
 * page's own print button and any other entry point (e.g. a row action on
 * the classes list) never drift into computing this differently.
 */
export function buildClassReportData(classId: string): ClassReportData | null {
  const cls = getClass(classId);
  if (!cls) return null;

  const stats = classStatistics(classId);
  const sections = sectionsForClass(classId);
  const subjects = subjectsForClass(classId);

  const students = getStudentsState()
    .students.filter(
      (s) =>
        s.status === "ACTIVE" &&
        s.className === cls.name &&
        s.academicYear === cls.academicYear,
    )
    .sort((a, b) => a.fullName.localeCompare(b.fullName));

  const tt = getTeachersState();
  const teacherRows = tt.assignments
    .filter(
      (a) =>
        a.status === "ACTIVE" &&
        a.className === cls.name &&
        a.academicYear === cls.academicYear,
    )
    .map((a) => ({
      ...a,
      teacherName: tt.teachers.find((t) => t.id === a.teacherId)?.fullName ?? "—",
    }));

  const subjectNames = new Set<string>([
    ...subjects.map((s) => s.name),
    ...teacherRows.map((a) => a.subject),
  ]);
  const subjectRows: ClassReportSubjectRow[] = [...subjectNames].sort().map((name) => {
    const subj = subjects.find((s) => s.name === name);
    const assigned = teacherRows.filter((a) => a.subject === name);
    const teacher = assigned.length
      ? [...new Set(assigned.map((a) => `${a.teacherName}${a.section ? ` (Section ${a.section})` : ""}`))].join(", ")
      : "Not assigned";
    return { subject: name, code: subj?.code ?? "", teacher, unlisted: !subj };
  });

  const exams = getExaminationsState().exams.filter(
    (e) => e.className === cls.name && e.academicYear === cls.academicYear,
  );

  return {
    className: cls.name,
    academicYear: cls.academicYear,
    status: cls.status,
    hasSections: cls.hasSections,
    notes: cls.notes,
    stats: {
      totalStudents: stats.totalStudents,
      maleStudents: stats.maleStudents,
      femaleStudents: stats.femaleStudents,
      totalSections: stats.totalSections,
      attendancePercentage: stats.attendancePercentage,
      examAverage: stats.examAverage,
      feeCollected: stats.feeCollected,
      feeExpected: stats.feeExpected,
    },
    sections: sections.map((s) => ({ name: `Section ${s.name}`, status: s.status })),
    students: students.map((s) => ({
      code: s.code,
      fullName: s.fullName,
      gender: s.gender,
      section: s.section ?? "—",
    })),
    subjectRows,
    exams: exams.map((e) => ({
      name: e.name,
      section: e.section ? `Section ${e.section}` : "—",
      status: e.status,
    })),
  };
}
