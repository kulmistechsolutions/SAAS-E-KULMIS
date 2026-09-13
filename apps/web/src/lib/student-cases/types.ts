export interface StudentCaseRecord {
  id: string;
  studentId: string;
  studentCode: string;
  studentName: string;
  classId: string;
  sectionId: string | null;
  title: string;
  note: string | null;
  date: string;
  recordedByUsername: string | null;
  createdAt: string;
}

export interface StudentCaseTopStudent {
  studentId: string;
  studentCode: string;
  studentName: string;
  className: string;
  count: number;
}

export interface StudentCaseByClass {
  classId: string;
  className: string;
  count: number;
}

export interface StudentCaseRecent {
  id: string;
  studentId: string;
  studentCode: string;
  studentName: string;
  className: string;
  title: string;
  note: string | null;
  date: string;
  recordedByUsername: string | null;
}

export interface StudentCaseDashboard {
  total: number;
  /** Cases dated in the current calendar month. */
  thisMonth: number;
  /** Cases dated in the last seven days, today included. */
  thisWeek: number;
  /** Distinct children with at least one case — not the case count. */
  studentsInvolved: number;
  topStudents: StudentCaseTopStudent[];
  byClass: StudentCaseByClass[];
  recent: StudentCaseRecent[];
}

export interface StudentOwnCase {
  id: string;
  title: string;
  note: string | null;
  date: string;
  recordedByUsername: string | null;
  createdAt: string;
}
