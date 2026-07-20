export type Gender = "MALE" | "FEMALE";
/** BOTH is only ever valid on the teacher's own profile, never on one
 *  assignment row — see AssignmentShift below. */
export type Shift = "MORNING" | "AFTERNOON" | "BOTH";
/** The shift ONE assignment slot is taught in. */
export type AssignmentShift = "MORNING" | "AFTERNOON";
export type EmploymentStatus = "ACTIVE" | "INACTIVE";
export type AssignmentStatus = "ACTIVE" | "INACTIVE";

export interface Teacher {
  id: string;
  code: string;
  fullName: string;
  gender: Gender;
  phone: string;
  email?: string | null;
  address?: string | null;
  qualification?: string | null;
  salary: number;
  shift: Shift;
  status: EmploymentStatus;
  canViewStudents?: boolean;
  registrationDate: string;
  username: string;
  /** Demo-only: initial/generated password shown to admin once. */
  password: string;
}

export interface TeacherAssignment {
  id: string;
  teacherId: string;
  academicYear: string;
  className: string;
  /** null means all sections in the class. */
  section: string | null;
  subject: string;
  status: AssignmentStatus;
  /** Which shift this slot is taught in. Set for a BOTH-shift teacher, null
   *  for a single-shift teacher whose one shift is already implied. */
  shift: AssignmentShift | null;
}

export interface TeacherInput {
  fullName: string;
  gender: Gender;
  phone: string;
  email?: string | null;
  address?: string | null;
  qualification?: string | null;
  salary: number;
  shift: Shift;
  status?: EmploymentStatus;
  password?: string;
}

export interface AssignmentInput {
  teacherId: string;
  academicYear: string;
  className: string;
  section: string | null;
  subject: string;
  shift?: AssignmentShift | null;
}

/**
 * One teaching slot in a bulk request:
 * Class + Section + one or more Subjects.
 * Example: Grade 7 / Section A / [Mathematics, Physics, Chemistry]
 */
export interface AssignmentSlotInput {
  className: string;
  /** null = all sections of the class */
  section: string | null;
  subjects: string[];
  /** Required only when the teacher's own profile is BOTH. */
  shift?: AssignmentShift | null;
}

/** Bulk create from explicit class/section/subject slots (not a full cartesian product). */
export interface BulkAssignmentInput {
  teacherId: string;
  academicYear: string;
  slots: AssignmentSlotInput[];
}

export interface TeachersState {
  teachers: Teacher[];
  assignments: TeacherAssignment[];
  teacherSeq: number;
}
