import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { StudentPortalLoginInput } from "@ekulmis/shared";
import { PrismaService } from "../prisma/prisma.service";
import { ExaminationsService } from "../examinations/examinations.service";
import { FeesService } from "../finance/fees.service";
import { TimetableViewService } from "../timetable/timetable-view.service";
import { QuizService } from "../quiz/quiz.service";
import { StudentsService } from "../students/students.service";
import { verifyPassword } from "../auth/password.util";
import type { JwtPayload } from "../auth/auth.types";

/**
 * Student-facing portal: class, exam results, attendance, and fees — a real
 * password sign-in (unlike the library portal's ID-only access), since this
 * surfaces more sensitive data. A school must opt in via
 * School.studentPortalEnabled before any student can log in here.
 *
 * Like the library portal, students have no `User` row, so this issues its
 * own JWT rather than going through AuthService. No refresh token — a single
 * 24h access token, matching the library portal's model.
 */
@Injectable()
export class StudentPortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly exams: ExaminationsService,
    private readonly fees: FeesService,
    private readonly timetable: TimetableViewService,
    private readonly quiz: QuizService,
    private readonly students: StudentsService,
  ) {}

  async login(schoolId: string, dto: StudentPortalLoginInput) {
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
      select: { studentPortalEnabled: true },
    });
    if (!school?.studentPortalEnabled) {
      throw new UnauthorizedException(
        "The student portal is not enabled for this school.",
      );
    }

    const student = await this.prisma.forTenant(schoolId, (tx) =>
      tx.student.findFirst({
        where: { code: dto.studentCode.trim() },
        select: {
          id: true,
          code: true,
          fullName: true,
          status: true,
          portalPasswordHash: true,
          class: { select: { name: true } },
        },
      }),
    );
    if (
      !student ||
      student.status !== "ACTIVE" ||
      !student.portalPasswordHash ||
      !(await verifyPassword(dto.password, student.portalPasswordHash))
    ) {
      throw new UnauthorizedException("Invalid Student ID or password");
    }

    const payload: JwtPayload = {
      sub: student.id,
      sid: schoolId,
      role: "STUDENT",
      username: student.code,
    };
    const accessToken = await this.jwt.signAsync(payload, { expiresIn: "24h" });

    return {
      accessToken,
      student: {
        id: student.id,
        code: student.code,
        fullName: student.fullName,
        className: student.class.name,
      },
    };
  }

  private async requireActiveStudent(schoolId: string, studentId: string) {
    const student = await this.prisma.forTenant(schoolId, (tx) =>
      tx.student.findFirst({
        where: { id: studentId },
        select: {
          id: true,
          code: true,
          fullName: true,
          gender: true,
          phone: true,
          status: true,
          monthlyFee: true,
          feeWaived: true,
          registrationDate: true,
          class: { select: { id: true, name: true } },
          section: { select: { id: true, name: true } },
          parent: { select: { name: true, phone: true } },
        },
      }),
    );
    // The token is only 24h; a student marked inactive mid-day still gets
    // locked out immediately since every call re-checks status.
    if (!student || student.status !== "ACTIVE") {
      throw new UnauthorizedException("This account is no longer active");
    }
    return student;
  }

  async me(schoolId: string, studentId: string) {
    return this.requireActiveStudent(schoolId, studentId);
  }

  async attendance(schoolId: string, studentId: string) {
    await this.requireActiveStudent(schoolId, studentId);
    return this.prisma.forTenant(schoolId, (tx) =>
      tx.studentAttendance.findMany({
        where: { studentId },
        orderBy: { date: "desc" },
        take: 90,
        include: { shift: { select: { name: true } } },
      }),
    );
  }

  async feesLedger(schoolId: string, studentId: string) {
    await this.requireActiveStudent(schoolId, studentId);
    return this.fees.ledger(schoolId, studentId);
  }

  async results(schoolId: string, studentId: string) {
    await this.requireActiveStudent(schoolId, studentId);
    return this.exams.studentResults(schoolId, studentId);
  }

  /** A student's own photo — never anyone else's, since studentId always
   * comes from the caller's own JWT (see StudentPortalController.photo). */
  async photo(schoolId: string, studentId: string) {
    await this.requireActiveStudent(schoolId, studentId);
    return this.students.getPhoto(schoolId, studentId);
  }

  async timetableForStudent(schoolId: string, studentId: string) {
    await this.requireActiveStudent(schoolId, studentId);
    return this.timetable.forStudent(schoolId, studentId);
  }

  async quizzes(schoolId: string, studentId: string) {
    await this.requireActiveStudent(schoolId, studentId);
    return this.quiz.listForStudent(schoolId, studentId);
  }
}
