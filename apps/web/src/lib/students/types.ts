export type Gender = "MALE" | "FEMALE";
export type StudentStatus = "ACTIVE" | "INACTIVE" | "GRADUATED";
export type ParentStatus = "ACTIVE" | "INACTIVE";
export type FeeStartMode = "FULL_CURRENT" | "AGREEMENT" | "NEXT_MONTH";

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
  /** From the school's own neighborhood list — optional, null on every student registered before it existed. */
  village?: string | null;
  monthlyFee: number;
  academicYear: string;
  registrationDate: string;
  status: StudentStatus;
  notes?: string | null;
  /** Collected only by the DETAILED registration form — null otherwise. */
  placeOfBirth?: string | null;
  district?: string | null;
  motherName?: string | null;
  hasPhoto?: boolean;
  /** Supabase public/signed URL from the API when available. */
  photoUrl?: string | null;
  feeStartMode?: FeeStartMode | null;
  feeAgreementAmount?: number | null;
  annualFeeAmount?: number | null;
  /** Permanent tuition exemption — never charged the monthly/tuition fee until turned off. */
  feeWaived?: boolean;
  /**
   * Extra classes this student attends alongside `className`. One student,
   * one record — they simply appear in each of these classes' lists too.
   */
  extraClasses?: StudentExtraClass[];
}

export interface StudentExtraClass {
  /** Enrollment row id — what you pass back to remove this extra class. */
  id: string;
  classId: string;
  className: string;
  sectionId: string | null;
  section: string | null;
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
  village?: string | null;
  monthlyFee: number;
  academicYear: string;
  status?: StudentStatus;
  notes?: string | null;
  placeOfBirth?: string | null;
  district?: string | null;
  motherName?: string | null;
  feeStartMode?: FeeStartMode;
  agreementAmount?: number;
  feeWaived?: boolean;
  chargeRegistrationFee?: boolean;
}

export interface StudentPhotoChange {
  file?: File | null;
  remove?: boolean;
}

export interface StudentsState {
  students: Student[];
  parents: Parent[];
  studentSeq: number;
  parentSeq: number;
}

/**
 * Every class this student sits in — their home class first, then any extras.
 * Use this anywhere a student is matched against or labelled by a class, so a
 * student in two classes shows up in both without becoming two records.
 */
export function studentClassNames(s: Student): string[] {
  const names = [s.className, ...(s.extraClasses ?? []).map((e) => e.className)];
  return [...new Set(names.filter(Boolean))];
}

/** Same idea for sections; "" stands for a class that isn't split. */
export function studentSectionNames(s: Student): string[] {
  const names = [
    s.section ?? "",
    ...(s.extraClasses ?? []).map((e) => e.section ?? ""),
  ];
  return [...new Set(names)];
}

/** Display label: "Grade 5" or "Grade 5 + Grade 7". */
export function studentClassLabel(s: Student): string {
  return studentClassNames(s).join(" + ");
}
