import {
  ACADEMIC_YEARS,
  ACTIVE_ACADEMIC_YEAR,
  CLASSES,
  SECTIONS,
} from "@/lib/students/constants";
import { SUBJECTS } from "@/lib/teachers/constants";
import type {
  AcademicsState,
  ClassSubjectAssignment,
  Section,
  SchoolClass,
  Subject,
} from "./types";

const YEAR_DATES: Record<string, { start: string; end: string }> = {
  "2024-2025": { start: "2024-09-01", end: "2025-06-30" },
  "2023-2024": { start: "2023-09-01", end: "2024-06-30" },
  "2022-2023": { start: "2022-09-01", end: "2023-06-30" },
};

export function buildSeed(): AcademicsState {
  const year = ACTIVE_ACADEMIC_YEAR;

  const academicYears = ACADEMIC_YEARS.map((y, i) => ({
    id: `ay_${i + 1}`,
    name: y,
    startDate: YEAR_DATES[y]?.start ?? `${y.slice(0, 4)}-09-01`,
    endDate: YEAR_DATES[y]?.end ?? `${Number(y.slice(0, 4)) + 1}-06-30`,
    status: (y === year ? "ACTIVE" : "CLOSED") as "ACTIVE" | "CLOSED",
  }));

  // Grade 12 has no sections (per PRD example); all others do.
  const classes: SchoolClass[] = CLASSES.map((name, i) => ({
    id: `cls_${i + 1}`,
    name,
    academicYear: year,
    orderIndex: i + 1,
    hasSections: name !== "Grade 12",
    status: "ACTIVE",
    notes: null,
    createdAt: "2024-08-01T08:00:00.000Z",
  }));

  const sections: Section[] = [];
  let sectionSeq = 0;
  for (const cls of classes) {
    if (!cls.hasSections) continue;
    for (const secName of SECTIONS) {
      sectionSeq += 1;
      sections.push({
        id: `sec_${sectionSeq}`,
        name: secName,
        classId: cls.id,
        academicYear: year,
        status: "ACTIVE",
        createdAt: "2024-08-01T08:00:00.000Z",
      });
    }
  }

  const subjects: Subject[] = SUBJECTS.map((name, i) => ({
    id: `sub_${i + 1}`,
    name,
    code: name.slice(0, 3).toUpperCase(),
    status: "ACTIVE",
    createdAt: "2024-08-01T08:00:00.000Z",
  }));

  // Assign a core set of subjects to every class; add specialization to upper grades.
  const core = ["Mathematics", "English", "Science", "Islamic Studies", "Arabic"];
  const upper = ["Physics", "Chemistry", "Biology", "History", "Geography", "Computer Science"];
  const subjectByName = new Map(subjects.map((s) => [s.name, s]));

  const classSubjects: ClassSubjectAssignment[] = [];
  let csSeq = 0;
  for (const cls of classes) {
    const gradeNum = Number(cls.name.replace(/\D/g, "")) || 0;
    const names = gradeNum >= 9 ? [...core, ...upper] : core;
    for (const subName of names) {
      const subject = subjectByName.get(subName);
      if (!subject) continue;
      csSeq += 1;
      classSubjects.push({
        id: `cs_${csSeq}`,
        academicYear: year,
        classId: cls.id,
        sectionId: null,
        subjectId: subject.id,
      });
    }
  }

  return {
    academicYears,
    classes,
    sections,
    subjects,
    classSubjects,
    audit: [
      {
        id: "aca_1",
        action: "Academic Year Created",
        user: "Admin User",
        role: "ADMINISTRATOR",
        at: "2024-08-01T08:00:00.000Z",
        detail: year,
      },
    ],
    classSeq: classes.length,
    sectionSeq,
    subjectSeq: subjects.length,
    yearSeq: academicYears.length,
  };
}
