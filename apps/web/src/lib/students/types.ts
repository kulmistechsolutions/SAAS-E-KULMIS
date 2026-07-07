export type Gender = "MALE" | "FEMALE";
export type StudentStatus = "ACTIVE" | "INACTIVE" | "GRADUATED";
export type ParentStatus = "ACTIVE" | "INACTIVE";

export interface Parent {
  id: string;
  code: string;
  name: string;
  phone: string;
  altPhone?: string | null;
  email?: string | null;
  address?: string | null;
  occupation?: string | null;
  registrationDate: string;
  status: ParentStatus;
  username: string;
  /** Demo-only: generated password shown to admin. */
  password: string;
}

export interface Student {
  id: string;
  code: string;
  fullName: string;
  gender: Gender;
  dob?: string | null;
  phone?: string | null;
  parentId: string;
  className: string;
  section?: string | null;
  monthlyFee: number;
  academicYear: string;
  registrationDate: string;
  status: StudentStatus;
  notes?: string | null;
}

/** A student joined with its parent, used by list/table views. */
export interface StudentWithParent extends Student {
  parent: Parent;
}

export interface StudentInput {
  fullName: string;
  gender: Gender;
  dob?: string | null;
  phone?: string | null;
  parentName: string;
  parentPhone: string;
  className: string;
  section?: string | null;
  monthlyFee: number;
  academicYear: string;
  status?: StudentStatus;
  notes?: string | null;
}

export interface StudentsState {
  students: Student[];
  parents: Parent[];
  studentSeq: number;
  parentSeq: number;
}
