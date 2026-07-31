import type { StructureTree } from "./structure-api";

export type AcademicYearStatus = "ACTIVE" | "CLOSED";
export type EntityStatus = "ACTIVE" | "INACTIVE";

export interface AcademicYear {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: AcademicYearStatus;
}

export interface SchoolClass {
  id: string;
  name: string;
  academicYear: string;
  orderIndex: number;
  hasSections: boolean;
  status: EntityStatus;
  notes?: string | null;
  createdAt: string;
}

export interface Section {
  id: string;
  name: string;
  classId: string;
  academicYear: string;
  status: EntityStatus;
  createdAt: string;
}

export interface Subject {
  id: string;
  name: string;
  code?: string | null;
  status: EntityStatus;
  createdAt: string;
}

export interface ClassSubjectAssignment {
  id: string;
  academicYear: string;
  classId: string;
  /** null means applies to all sections / class-level. */
  sectionId: string | null;
  subjectId: string;
}

export interface AcademicAuditEntry {
  id: string;
  action: string;
  user: string;
  role: string;
  at: string;
  detail?: string;
}

export interface AcademicsState {
  academicYears: AcademicYear[];
  classes: SchoolClass[];
  sections: Section[];
  subjects: Subject[];
  classSubjects: ClassSubjectAssignment[];
  audit: AcademicAuditEntry[];
  classSeq: number;
  sectionSeq: number;
  subjectSeq: number;
  yearSeq: number;
  /** Keyed by academic year NAME (matching SchoolClass.academicYear), not id. Empty levels/ungrouped-only for a school not using a custom structure. */
  structureTrees: Record<string, StructureTree>;
  /** Whether to drop the default Grade 1-12 group entirely from class pickers. */
  hideDefaultGrades: boolean;
  /** The school's own on/off switch for the whole feature. Structure data
   *  (levels/stages/hideDefaultGrades) can still exist in the database after
   *  a school turns this off — nothing is deleted — so every consumer of
   *  that data must gate on this flag too, or a school that opts back out
   *  keeps seeing its old structure's effects. */
  customStructureEnabled: boolean;
}

export interface AcademicsDashboardSummary {
  totalAcademicYears: number;
  activeAcademicYear: string;
  totalClasses: number;
  totalSections: number;
  totalSubjects: number;
  totalStudents: number;
  teachersAssigned: number;
  classesWithoutTeachers: number;
  classesWithoutSubjects: number;
}

export interface ClassStatistics {
  totalStudents: number;
  maleStudents: number;
  femaleStudents: number;
  totalSections: number;
  assignedSubjects: number;
  assignedTeachers: number;
  attendancePercentage: number;
  feeCollected: number;
  feeExpected: number;
  examAverage: number;
}

export interface SectionStatistics {
  totalStudents: number;
  maleStudents: number;
  femaleStudents: number;
  assignedTeachers: number;
  assignedSubjects: number;
  attendanceRate: number;
  examPerformance: number;
}

export interface ClassRow {
  id: string;
  name: string;
  academicYear: string;
  hasSections: boolean;
  status: EntityStatus;
  sectionCount: number;
  studentCount: number;
  subjectCount: number;
  teacherCount: number;
}

export interface SectionRow {
  id: string;
  name: string;
  className: string;
  classId: string;
  academicYear: string;
  status: EntityStatus;
  studentCount: number;
}

export interface SubjectRow {
  id: string;
  name: string;
  code?: string | null;
  status: EntityStatus;
  classCount: number;
  usedByTeachers: number;
}

export interface AcademicYearInput {
  name: string;
  startDate: string;
  endDate: string;
  status?: AcademicYearStatus;
}

export interface ClassInput {
  name: string;
  academicYear: string;
  hasSections: boolean;
  status?: EntityStatus;
  notes?: string | null;
}

export interface SectionInput {
  name: string;
  classId: string;
  status?: EntityStatus;
}

export interface SubjectInput {
  name: string;
  code?: string | null;
  status?: EntityStatus;
}
