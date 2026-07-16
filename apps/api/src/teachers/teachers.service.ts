import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  RegisterTeacherInput,
  UpdateTeacherInput,
} from "@ekulmis/shared";
import { PrismaService } from "../prisma/prisma.service";
import { hashPassword } from "../auth/password.util";
import { SubscriptionsService } from "../subscriptions/subscriptions.service";

const meInclude = {
  assignments: {
    include: {
      academicYear: { select: { id: true, name: true } },
      class: { select: { id: true, name: true } },
      section: { select: { id: true, name: true } },
      subject: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" as const },
  },
};

function pad(n: number): string {
  return String(n).padStart(4, "0");
}

const DEFAULT_TEACHER_PASSWORD = "12345";

@Injectable()
export class TeachersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  /** Register a teacher: auto ID from prefix + auto login User (role TEACHER). */
  async register(schoolId: string, dto: RegisterTeacherInput) {
    await this.subscriptions.assertCanAddTeacher(schoolId);
    return this.prisma.forTenant(schoolId, async (tx) => {
      const school = await tx.school.findUnique({
        where: { id: schoolId },
        select: { teacherPrefix: true },
      });
      if (!school) throw new NotFoundException("School not found");

      const seq = await tx.counter.upsert({
        where: { schoolId_name: { schoolId, name: "teacher" } },
        create: { schoolId, name: "teacher", value: 1 },
        update: { value: { increment: 1 } },
      });
      const code = `${school.teacherPrefix}${pad(seq.value)}`;
      const initialPassword = dto.password?.trim() || DEFAULT_TEACHER_PASSWORD;
      const user = await tx.user.create({
        data: {
          schoolId,
          username: code,
          role: "TEACHER",
          passwordHash: await hashPassword(initialPassword),
        },
      });
      const teacher = await tx.teacher.create({
        data: {
          schoolId,
          code,
          fullName: dto.fullName,
          gender: dto.gender,
          phone: dto.phone ?? null,
          email: dto.email ?? null,
          address: dto.address ?? null,
          qualification: dto.qualification ?? null,
          salary: dto.salary ?? 0,
          shift: dto.shift,
          canViewStudents: false,
          userId: user.id,
        },
      });
      return { teacher, initialPassword };
    });
  }

  findAll(schoolId: string, shift?: string) {
    return this.prisma.forTenant(schoolId, (tx) =>
      tx.teacher.findMany({
        where: { shift: shift as never },
        orderBy: { fullName: "asc" },
      }),
    );
  }

  async findOne(schoolId: string, id: string) {
    const teacher = await this.prisma.forTenant(schoolId, (tx) =>
      tx.teacher.findFirst({
        where: { id },
        include: {
          assignments: {
            include: {
              class: { select: { name: true } },
              section: { select: { name: true } },
              subject: { select: { name: true } },
            },
          },
        },
      }),
    );
    if (!teacher) throw new NotFoundException("Teacher not found");
    return teacher;
  }

  /** Resolve the Teacher record linked to the logged-in user account. */
  async findByUserId(schoolId: string, userId: string) {
    const teacher = await this.prisma.forTenant(schoolId, (tx) =>
      tx.teacher.findFirst({
        where: { userId },
        include: meInclude,
      }),
    );
    if (!teacher) throw new NotFoundException("Teacher profile not found");
    return teacher;
  }

  async update(schoolId: string, id: string, dto: UpdateTeacherInput) {
    await this.findOne(schoolId, id);
    return this.prisma.forTenant(schoolId, (tx) =>
      tx.teacher.update({
        where: { id },
        data: {
          fullName: dto.fullName,
          gender: dto.gender,
          phone: dto.phone,
          email: dto.email,
          address: dto.address,
          qualification: dto.qualification,
          salary: dto.salary,
          shift: dto.shift,
          status: dto.status,
          canViewStudents: dto.canViewStudents,
        },
      }),
    );
  }

  /**
   * Teacher self-service profile update — only contact fields.
   * Salary, shift, status, and name changes remain admin-only.
   */
  async updateSelf(
    schoolId: string,
    userId: string,
    dto: { phone?: string | null; email?: string | null; address?: string | null },
  ) {
    const teacher = await this.findByUserId(schoolId, userId);
    return this.prisma.forTenant(schoolId, (tx) =>
      tx.teacher.update({
        where: { id: teacher.id },
        data: {
          phone: dto.phone,
          email: dto.email,
          address: dto.address,
        },
        include: meInclude,
      }),
    );
  }

  /** Students in classes/sections assigned to this teacher. Requires canViewStudents. */
  async myStudents(schoolId: string, userId: string) {
    const teacher = await this.findByUserId(schoolId, userId);
    if (!teacher.canViewStudents) {
      throw new ForbiddenException(
        "View Students permission has not been granted for your account",
      );
    }
    const classIds = [...new Set(teacher.assignments.map((a) => a.classId))];
    if (!classIds.length) return [];

    const students = await this.prisma.forTenant(schoolId, (tx) =>
      tx.student.findMany({
        where: {
          status: "ACTIVE",
          classId: { in: classIds },
        },
        include: {
          class: {
            select: {
              id: true,
              name: true,
              academicYear: { select: { name: true } },
            },
          },
          section: { select: { id: true, name: true } },
          parent: {
            select: { id: true, name: true, phone: true, code: true },
          },
        },
        orderBy: { fullName: "asc" },
      }),
    );

    // Keep students whose class+section matches at least one assignment
    // (null section on assignment = all sections of that class).
    return students.filter((s) =>
      teacher.assignments.some(
        (a) =>
          a.classId === s.classId &&
          (a.sectionId === null || a.sectionId === s.sectionId),
      ),
    );
  }

  async assertOwnsAssignment(
    schoolId: string,
    userId: string,
    opts: {
      classId: string;
      sectionId?: string | null;
      subjectId?: string;
      academicYearId?: string;
    },
  ): Promise<string> {
    const teacher = await this.findByUserId(schoolId, userId);
    const match = teacher.assignments.find(
      (a) =>
        a.classId === opts.classId &&
        (opts.academicYearId
          ? a.academicYearId === opts.academicYearId
          : true) &&
        (opts.subjectId ? a.subjectId === opts.subjectId : true) &&
        (a.sectionId === null ||
          a.sectionId === (opts.sectionId ?? null) ||
          opts.sectionId == null),
    );
    if (!match) {
      throw new ForbiddenException(
        "You are not assigned to this class, section, or subject",
      );
    }
    return teacher.id;
  }

  async remove(schoolId: string, id: string) {
    return this.prisma.forTenant(schoolId, async (tx) => {
      const teacher = await tx.teacher.findFirst({
        where: { id },
        select: { id: true, userId: true },
      });
      if (!teacher) throw new NotFoundException("Teacher not found");
      // Assignments cascade from the teacher; then remove the login account.
      await tx.teacher.delete({ where: { id } });
      await tx.user.delete({ where: { id: teacher.userId } });
      return { success: true };
    });
  }

  /** Reset the linked login account password and revoke refresh tokens. */
  async resetPassword(schoolId: string, id: string, newPassword: string) {
    const teacher = await this.prisma.forTenant(schoolId, (tx) =>
      tx.teacher.findFirst({ where: { id }, select: { userId: true } }),
    );
    if (!teacher) throw new NotFoundException("Teacher not found");
    const passwordHash = await hashPassword(newPassword);
    await this.prisma.forTenant(schoolId, (tx) =>
      tx.user.update({ where: { id: teacher.userId }, data: { passwordHash } }),
    );
    await this.prisma.refreshToken.updateMany({
      where: { userId: teacher.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { success: true };
  }
}
