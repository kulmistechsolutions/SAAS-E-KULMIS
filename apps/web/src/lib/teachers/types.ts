export type Gender = "MALE" | "FEMALE";
export type Shift = "MORNING" | "AFTERNOON";
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
}

export interface AssignmentInput {
  teacherId: string;
  academicYear: string;
  className: string;
  section: string | null;
  subject: string;
}

export interface TeachersState {
  teachers: Teacher[];
  assignments: TeacherAssignment[];
  teacherSeq: number;
}
