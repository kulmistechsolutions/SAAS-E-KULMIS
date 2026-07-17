import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { LibraryPortalLoginInput } from "@ekulmis/shared";
import { PrismaService } from "../prisma/prisma.service";
import { LibraryService } from "../library/library.service";
import type { JwtPayload } from "../auth/auth.types";

/**
 * Students have no `User` row (see Student.portalPasswordHash — written but
 * never read), so this issues its own JWT rather than going through
 * AuthService. The payload still matches the standard `JwtPayload` shape so
 * it flows through the existing global JwtAuthGuard/RolesGuard pipeline
 * unmodified: `sub` is the student's id, `role` is STUDENT. No refresh token
 * — a single 24h access token is enough for a read-only portal a student
 * re-enters with just their ID.
 */
@Injectable()
export class LibraryPortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly library: LibraryService,
  ) {}

  async login(schoolId: string, dto: LibraryPortalLoginInput) {
    const student = await this.prisma.forTenant(schoolId, (tx) =>
      tx.student.findFirst({
        where: { code: dto.studentCode.trim() },
        select: {
          id: true,
          code: true,
          fullName: true,
          status: true,
          classId: true,
          class: { select: { name: true } },
        },
      }),
    );
    if (!student || student.status !== "ACTIVE") {
      throw new UnauthorizedException("Invalid Student ID");
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

  private async requireStudent(schoolId: string, studentId: string) {
    const student = await this.prisma.forTenant(schoolId, (tx) =>
      tx.student.findFirst({
        where: { id: studentId },
        select: {
          id: true,
          code: true,
          fullName: true,
          status: true,
          classId: true,
          class: { select: { name: true } },
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
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
      select: { name: true },
    });
    const student = await this.requireStudent(schoolId, studentId);
    return {
      schoolName: school?.name ?? "School",
      student: {
        id: student.id,
        code: student.code,
        fullName: student.fullName,
        className: student.class.name,
      },
    };
  }

  async listBooks(schoolId: string, studentId: string) {
    const student = await this.requireStudent(schoolId, studentId);
    return this.prisma.forTenant(schoolId, (tx) =>
      tx.libraryDocument.findMany({
        where: {
          status: "ACTIVE",
          OR: [{ classId: null }, { classId: student.classId }],
        },
        select: {
          id: true,
          title: true,
          description: true,
          author: true,
          fileSizeBytes: true,
          allowDownload: true,
          classId: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      }),
    );
  }

  async getBook(schoolId: string, studentId: string, bookId: string) {
    const student = await this.requireStudent(schoolId, studentId);
    return this.library.getVisibleDocument(schoolId, bookId, {
      studentClassId: student.classId,
    });
  }

  async getBookFile(schoolId: string, studentId: string, bookId: string) {
    const student = await this.requireStudent(schoolId, studentId);
    // A book locked to another class 404s the same way a missing id does —
    // getDocumentFile already treats "wrong class" as "not found".
    return this.library.getDocumentFile(schoolId, bookId, {
      studentClassId: student.classId,
    });
  }
}
