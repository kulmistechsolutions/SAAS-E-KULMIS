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
  count: number;
}

export interface StudentCaseDashboard {
  total: number;
  topStudents: StudentCaseTopStudent[];
}

export interface StudentOwnCase {
  id: string;
  title: string;
  note: string | null;
  date: string;
  recordedByUsername: string | null;
  createdAt: string;
}
