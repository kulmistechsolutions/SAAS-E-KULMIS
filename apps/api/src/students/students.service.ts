import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import type {
  RegisterStudentInput,
  UpdateStudentInput,
} from "@ekulmis/shared";
import { PrismaService } from "../prisma/prisma.service";
import { hashPassword } from "../auth/password.util";

function pad(n: number): string {
  return String(n).padStart(4, "0");
}

const studentInclude = {
  parent: { select: { id: true, code: true, name: true, phone: true } },
  class: { select: { id: true, name: true } },
  section: { select: { id: true, name: true } },
} satisfies Prisma.StudentInclude;

@Injectable()
export class StudentsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Register a student. Auto-creates the parent (reused by phone), auto-assigns
   * sequential Student/Parent IDs from the school prefixes, prevents duplicates,
   * and validates the class/section — all in one tenant transaction.
   */
  async register(schoolId: string, dto: RegisterStudentInput) {
    return this.prisma.forTenant(schoolId, async (tx) => {
      const school = await tx.school.findUnique({
        where: { id: schoolId },
        select: { studentPrefix: true, parentPrefix: true },
      });
      if (!school) throw new NotFoundException("School not found");

      const cls = await tx.class.findFirst({
        where: { id: dto.classId },
        select: { id: true },
      });
      if (!cls) throw new BadRequestException("Invalid class");

      const sectionId = dto.sectionId ?? null;
      if (sectionId) {
        const sec = await tx.section.findFirst({
          where: { id: sectionId, classId: dto.classId },
          select: { id: true },
        });
        if (!sec) {
          throw new BadRequestException("Invalid section for this class");
        }
      }

      // Resolve or create the parent (reuse by phone).
      let parent = await tx.parent.findFirst({
        where: { phone: dto.parentPhone },
      });
      let initialParentPassword: string | undefined;
      if (!parent) {
        const seq = await tx.counter.upsert({
          where: { schoolId_name: { schoolId, name: "parent" } },
          create: { schoolId, name: "parent", value: 1 },
          update: { value: { increment: 1 } },
        });
        const parentCode = `${school.parentPrefix}${pad(seq.value)}`;
        initialParentPassword = randomBytes(6).toString("base64url");
        const user = await tx.user.create({
          data: {
            schoolId,
            username: parentCode,
            role: "PARENT",
            passwordHash: await hashPassword(initialParentPassword),
          },
        });
        parent = await tx.parent.create({
          data: {
            schoolId,
            code: parentCode,
            name: dto.parentName,
            phone: dto.parentPhone,
            userId: user.id,
          },
        });
      }

      // Duplicate: same name + parent + class + section.
      const dup = await tx.student.findFirst({
        where: {
          fullName: dto.fullName,
          parentId: parent.id,
          classId: dto.classId,
          sectionId,
        },
        select: { id: true },
      });
      if (dup) {
        throw new ConflictException(
          "A student with the same name, parent, class and section already exists",
        );
      }

      const seq = await tx.counter.upsert({
        where: { schoolId_name: { schoolId, name: "student" } },
        create: { schoolId, name: "student", value: 1 },
        update: { value: { increment: 1 } },
      });
      const code = `${school.studentPrefix}${pad(seq.value)}`;

      const student = await tx.student.create({
        data: {
          schoolId,
          code,
          fullName: dto.fullName,
          gender: dto.gender,
          phone: dto.phone ?? null,
          parentId: parent.id,
          classId: dto.classId,
          sectionId,
          monthlyFee: dto.monthlyFee ?? 0,
        },
        include: studentInclude,
      });

      return {
        student,
        parentCreated: initialParentPassword !== undefined,
        // Returned once so the admin can share it; never stored in plaintext.
        initialParentPassword,
      };
    });
  }

  findAll(
    schoolId: string,
    filters: {
      classId?: string;
      sectionId?: string;
      status?: string;
      gender?: string;
    } = {},
  ) {
    return this.prisma.forTenant(schoolId, (tx) =>
      tx.student.findMany({
        where: {
          classId: filters.classId,
          sectionId: filters.sectionId,
          status: filters.status as never,
          gender: filters.gender as never,
        },
        orderBy: { fullName: "asc" },
        include: studentInclude,
      }),
    );
  }

  async findOne(schoolId: string, id: string) {
    const student = await this.prisma.forTenant(schoolId, (tx) =>
      tx.student.findFirst({ where: { id }, include: studentInclude }),
    );
    if (!student) throw new NotFoundException("Student not found");
    return student;
  }

  async update(schoolId: string, id: string, dto: UpdateStudentInput) {
    await this.findOne(schoolId, id);
    return this.prisma.forTenant(schoolId, async (tx) => {
      if (dto.classId) {
        const cls = await tx.class.findFirst({
          where: { id: dto.classId },
          select: { id: true },
        });
        if (!cls) throw new BadRequestException("Invalid class");
      }
      if (dto.sectionId) {
        const sec = await tx.section.findFirst({
          where: { id: dto.sectionId },
          select: { id: true },
        });
        if (!sec) throw new BadRequestException("Invalid section");
      }
      // Editing never changes the student code (Module 1 rule).
      return tx.student.update({
        where: { id },
        data: {
          fullName: dto.fullName,
          gender: dto.gender,
          phone: dto.phone,
          classId: dto.classId,
          sectionId: dto.sectionId,
          monthlyFee: dto.monthlyFee,
          status: dto.status,
        },
        include: studentInclude,
      });
    });
  }

  /** Delete a student; delete the parent too iff it has no other children. */
  async remove(schoolId: string, id: string) {
    return this.prisma.forTenant(schoolId, async (tx) => {
      const student = await tx.student.findFirst({
        where: { id },
        select: { id: true, parentId: true },
      });
      if (!student) throw new NotFoundException("Student not found");

      await tx.student.delete({ where: { id } });

      const remaining = await tx.student.count({
        where: { parentId: student.parentId },
      });
      if (remaining === 0) {
        const parent = await tx.parent.findFirst({
          where: { id: student.parentId },
          select: { userId: true },
        });
        await tx.parent.delete({ where: { id: student.parentId } });
        if (parent) {
          await tx.user.delete({ where: { id: parent.userId } });
        }
      }
      return { success: true, parentDeleted: remaining === 0 };
    });
  }
}
