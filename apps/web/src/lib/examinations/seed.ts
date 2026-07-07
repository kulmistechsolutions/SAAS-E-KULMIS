import { ACTIVE_ACADEMIC_YEAR } from "@/lib/students/constants";
import { getState as getStudentsState } from "@/lib/students/store";
import { getTeachersState } from "@/lib/teachers/store";
import type { Exam, ExamGroup, ExamMark, ExaminationsState } from "./types";

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function subjectsFor(className: string, section: string, year: string): string[] {
  const tt = getTeachersState();
  const set = new Set<string>();
  for (const a of tt.assignments) {
    if (
      a.academicYear === year &&
      a.className === className &&
      a.status === "ACTIVE" &&
      (a.section === null || a.section === section)
    ) {
      set.add(a.subject);
    }
  }
  return [...set].sort();
}

export function buildSeed(): ExaminationsState {
  const year = ACTIVE_ACADEMIC_YEAR;
  const examGroups: ExamGroup[] = [
    {
      id: "eg_1",
      name: "Academic Final",
      academicYear: year,
      description: "Combined final results for the academic year",
    },
    {
      id: "eg_2",
      name: "Semester One Final",
      academicYear: year,
      description: "First semester combined results",
    },
    {
      id: "eg_3",
      name: "Annual Examination",
      academicYear: year,
    },
  ];

  const examDefs: Omit<Exam, "id" | "subjects" | "createdAt" | "createdBy">[] = [
    {
      name: "First Term Examination",
      academicYear: year,
      examType: "TEACHER_ASSESSMENT",
      examGroupId: "eg_2",
      term: "Term 1",
      maxMarks: 50,
      weightPercent: 30,
      startDate: "2024-09-01",
      endDate: "2024-09-15",
      status: "PUBLISHED",
      className: "Grade 8",
      section: "A",
    },
    {
      name: "First Term Examination",
      academicYear: year,
      examType: "TEACHER_ASSESSMENT",
      examGroupId: "eg_2",
      term: "Term 1",
      maxMarks: 50,
      weightPercent: 30,
      startDate: "2024-09-01",
      endDate: "2024-09-15",
      status: "LOCKED",
      className: "Grade 8",
      section: "B",
    },
    {
      name: "Mid Term Examination",
      academicYear: year,
      examType: "TEACHER_ASSESSMENT",
      examGroupId: "eg_2",
      term: "Midterm",
      maxMarks: 50,
      weightPercent: 30,
      startDate: "2024-11-01",
      endDate: "2024-11-20",
      status: "IN_PROGRESS",
      className: "Grade 9",
      section: "A",
    },
    {
      name: "Final Examination",
      academicYear: year,
      examType: "SCHOOL_IMPORT",
      examGroupId: "eg_1",
      term: "Final",
      maxMarks: 100,
      weightPercent: 40,
      startDate: "2025-05-01",
      endDate: "2025-05-20",
      status: "OPEN",
      className: "Grade 10",
      section: "A",
    },
    {
      name: "Second Term Examination",
      academicYear: year,
      examType: "TEACHER_ASSESSMENT",
      examGroupId: "eg_2",
      term: "Term 2",
      maxMarks: 50,
      weightPercent: 30,
      startDate: "2025-01-10",
      endDate: "2025-01-25",
      status: "COMPLETED",
      className: "Grade 7",
      section: "C",
    },
    {
      name: "Placement Test",
      academicYear: year,
      examType: "TEACHER_ASSESSMENT",
      examGroupId: null,
      term: "Term 1",
      maxMarks: 50,
      weightPercent: 100,
      startDate: "2024-10-01",
      endDate: "2024-10-10",
      status: "DRAFT",
      className: "Grade 6",
      section: "A",
    },
  ];

  const exams: Exam[] = examDefs.map((d, i) => ({
    ...d,
    id: `ex_${i + 1}`,
    subjects: subjectsFor(d.className, d.section, year),
    createdAt: "2024-08-15T08:00:00.000Z",
    createdBy: "Admin User",
  }));

  const marks: ExamMark[] = [];
  let markSeq = 0;
  const st = getStudentsState();

  for (const exam of exams) {
    if (exam.status === "DRAFT" || exam.subjects.length === 0) continue;
    const students = st.students
      .filter(
        (s) =>
          s.status === "ACTIVE" &&
          s.academicYear === year &&
          s.className === exam.className &&
          (s.section ?? "") === exam.section,
      )
      .sort((a, b) => a.fullName.localeCompare(b.fullName));

    const fillRatio =
      exam.status === "PUBLISHED" || exam.status === "LOCKED"
        ? 1
        : exam.status === "COMPLETED"
          ? 0.95
          : exam.status === "IN_PROGRESS"
            ? 0.55
            : 0.2;

    students.forEach((student, si) => {
      const rand = rng(si * 17 + exam.id.length);
      exam.subjects.forEach((subject, subi) => {
        if (rand() > fillRatio) return;
        markSeq += 1;
        const m = Math.round(20 + rand() * (exam.maxMarks - 20));
        marks.push({
          id: `em_${markSeq}`,
          examId: exam.id,
          studentId: student.id,
          subject,
          marks: m,
          enteredBy: "Teacher",
          enteredAt: exam.endDate + "T10:00:00.000Z",
        });
      });
    });
  }

  return {
    examGroups,
    exams,
    marks,
    blockedStudents: [
      {
        id: "bs_1",
        studentId: st.students.find((s) => s.className === "Grade 8")?.id ?? "s_1",
        examId: "ex_1",
        academicYear: year,
        reason: "Outstanding Fees",
        blockedAt: "2024-09-20T08:00:00.000Z",
        blockedBy: "Admin User",
      },
    ],
    audit: [
      {
        id: "ea_1",
        action: "Exam Created",
        user: "Admin User",
        role: "ADMINISTRATOR",
        at: "2024-08-15T08:00:00.000Z",
        detail: "First Term Examination — Grade 8 A",
      },
    ],
    examSeq: exams.length,
    groupSeq: examGroups.length,
  };
}
