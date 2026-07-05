import { Injectable, NotFoundException } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import type {
  RegisterTeacherInput,
  UpdateTeacherInput,
} from "@ekulmis/shared";
import { PrismaService } from "../prisma/prisma.service";
import { hashPassword } from "../auth/password.util";

function pad(n: number): string {
  return String(n).padStart(4, "0");
}

@Injectable()
export class TeachersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Register a teacher: auto ID from prefix + auto login User (role TEACHER). */
  async register(schoolId: string, dto: RegisterTeacherInput) {
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
      const initialPassword = randomBytes(6).toString("base64url");
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
          salary: dto.salary ?? 0,
          shift: dto.shift,
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

  async update(schoolId: string, id: string, dto: UpdateTeacherInput) {
    await this.findOne(schoolId, id);
    return this.prisma.forTenant(schoolId, (tx) =>
      tx.teacher.update({
        where: { id },
        data: {
          fullName: dto.fullName,
          gender: dto.gender,
          phone: dto.phone,
          salary: dto.salary,
          shift: dto.shift,
          status: dto.status,
        },
      }),
    );
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
}
