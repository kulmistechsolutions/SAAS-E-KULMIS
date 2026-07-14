import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ExaminationsService } from "../examinations/examinations.service";
import { DashboardService } from "../dashboard/dashboard.service";
import { NotificationsService } from "../notifications/notifications.service";
import { TeachersService } from "../teachers/teachers.service";

function gradeFromAverage(avg: number): string {
  if (avg >= 90) return "A+";
  if (avg >= 80) return "A";
  if (avg >= 70) return "B";
  if (avg >= 60) return "C";
  if (avg >= 50) return "D";
  return "F";
}

@Injectable()
export class TeacherPortalService {
  constructor(
    private readonly teachers: TeachersService,
    private readonly dashboardService: DashboardService,
    private readonly exams: ExaminationsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  profile(schoolId: string, userId: string) {
    return this.teachers.findByUserId(schoolId, userId);
  }

  dashboard(schoolId: string, userId: string) {
    return this.dashboardService.teacher(schoolId, userId);
  }

  async students(schoolId: string, userId: string) {
    return this.teachers.myStudents(schoolId, userId);
  }

  announcements(schoolId: string) {
    return this.notificationsService.listAnnouncements(schoolId);
  }

  notifications(schoolId: string, userId: string) {
    return this.notificationsService.list(schoolId, userId);
  }

  async studentResults(
    schoolId: string,
    userId: string,
    studentId: string,
    academicYearId?: string,
  ) {
    const teacher = await this.teachers.findByUserId(schoolId, userId);
    if (!teacher.canViewStudents) {
      throw new ForbiddenException(
        "View Students permission has not been granted for your account",
      );
    }
    const mine = await this.teachers.myStudents(schoolId, userId);
    if (!mine.some((s) => s.id === studentId)) {
      throw new ForbiddenException(
        "You can only view results for students in your assigned classes",
      );
    }
    return this.exams.studentResults(schoolId, studentId, academicYearId);
  }

  /**
   * Class/section results for subjects this teacher is assigned to.
   * Only PUBLISHED exams are included.
   */
  async classResults(
    schoolId: string,
    userId: string,
    filters: {
      academicYearId: string;
      classId: string;
      sectionId: string;
      examId?: string;
    },
  ) {
    const teacher = await this.teachers.findByUserId(schoolId, userId);
    if (!teacher.canViewStudents) {
      throw new ForbiddenException(
        "View Students permission is required to access class results",
      );
    }
    const relevantAssignments = teacher.assignments.filter(
      (a) =>
        a.academicYearId === filters.academicYearId &&
        a.classId === filters.classId &&
        (a.sectionId === null || a.sectionId === filters.sectionId),
    );
    if (!relevantAssignments.length) {
      throw new ForbiddenException(
        "You are not assigned to this class and section",
      );
    }

    const subjectIds = new Set(relevantAssignments.map((a) => a.subjectId));

    const students = await this.teachers.myStudents(schoolId, userId);
    const classStudents = students.filter(
      (s) =>
        s.classId === filters.classId && s.sectionId === filters.sectionId,
    );

    const exams = await this.exams.listExams(schoolId, {
      academicYearId: filters.academicYearId,
      classId: filters.classId,
    });
    const scopedExams = exams.filter((exam) => {
      if (filters.examId && exam.id !== filters.examId) return false;
      if (exam.status !== "PUBLISHED") return false;
      if (exam.sectionId && exam.sectionId !== filters.sectionId) return false;
      return exam.subjects.some((es) => subjectIds.has(es.subjectId));
    });

    const rows: {
      studentId: string;
      studentCode: string;
      studentName: string;
      examId: string;
      examName: string;
      subjectId: string;
      subjectName: string;
      maxMarks: number;
      marksObtained: number | null;
      percentage: number | null;
      grade: string;
    }[] = [];

    for (const exam of scopedExams) {
      const marks = await this.exams.getMarks(schoolId, exam.id);
      const ownedSubjects = exam.subjects.filter((es) =>
        subjectIds.has(es.subjectId),
      );
      for (const student of classStudents) {
        for (const es of ownedSubjects) {
          const mark = marks.find(
            (m) =>
              m.studentId === student.id && m.subjectId === es.subjectId,
          );
          const obtained = mark?.marks ?? null;
          const pct =
            obtained !== null && exam.maxMarks
              ? (obtained / exam.maxMarks) * 100
              : null;
          rows.push({
            studentId: student.id,
            studentCode: student.code,
            studentName: student.fullName,
            examId: exam.id,
            examName: exam.name,
            subjectId: es.subjectId,
            subjectName: es.subject.name,
            maxMarks: exam.maxMarks,
            marksObtained: obtained,
            percentage:
              pct !== null ? Math.round(pct * 10) / 10 : null,
            grade: pct !== null ? gradeFromAverage(pct) : "—",
          });
        }
      }
    }

    const subjectSummaries = [...subjectIds].map((subjectId) => {
      const subjectRows = rows.filter((r) => r.subjectId === subjectId);
      const graded = subjectRows.filter((r) => r.percentage !== null);
      const avg =
        graded.length === 0
          ? 0
          : graded.reduce((s, r) => s + (r.percentage ?? 0), 0) / graded.length;
      const name = subjectRows[0]?.subjectName ?? "Subject";
      return {
        subjectId,
        subjectName: name,
        studentCount: new Set(subjectRows.map((r) => r.studentId)).size,
        averagePercentage: Math.round(avg * 10) / 10,
        grade: gradeFromAverage(avg),
      };
    });

    return {
      classId: filters.classId,
      sectionId: filters.sectionId,
      academicYearId: filters.academicYearId,
      students: classStudents.map((s) => ({
        id: s.id,
        code: s.code,
        fullName: s.fullName,
      })),
      exams: scopedExams.map((e) => ({
        id: e.id,
        name: e.name,
        term: e.term,
        maxMarks: e.maxMarks,
      })),
      rows,
      subjectSummaries,
    };
  }
}
