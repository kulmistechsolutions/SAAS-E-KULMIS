export type StudentAttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";
export type TeacherAttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "LEAVE";

export interface StudentAttendanceRecord {
  id: string;
  studentId: string;
  academicYear: string;
  className: string;
  section: string | null;
  date: string;
  status: StudentAttendanceStatus;
  markedAt: string;
}

export interface TeacherAttendanceRecord {
  id: string;
  teacherId: string;
  academicYear: string;
  shift: "MORNING" | "AFTERNOON";
  date: string;
  status: TeacherAttendanceStatus;
  markedAt: string;
}

export interface AttendanceState {
  studentRecords: StudentAttendanceRecord[];
  teacherRecords: TeacherAttendanceRecord[];
  defaultStudentStatus: StudentAttendanceStatus;
}

export interface StudentMarkRow {
  studentId: string;
  code: string;
  fullName: string;
  gender: string;
  status: StudentAttendanceStatus;
  eligible: boolean;
  reason?: string;
}

export interface TeacherMarkRow {
  teacherId: string;
  code: string;
  fullName: string;
  shift: "MORNING" | "AFTERNOON";
  status: TeacherAttendanceStatus;
  eligible: boolean;
  reason?: string;
}
