import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type { CreateAssignmentInput } from "@ekulmis/shared";
import { PrismaService } from "../prisma/prisma.service";

const assignmentInclude = {
  teacher: { select: { id: true, code: true, fullName: true } },
  academicYear: { select: { id: true, name: true } },
  class: { select: { id: true, name: true } },
  section: { select: { id: true, name: true } },
  subject: { select: { id: true, name: true } },
} satisfies Prisma.TeacherAssignmentInclude;

@Injectable()
export class TeacherAssignmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(schoolId: string, dto: CreateAssignmentInput) {
    return this.prisma.forTenant(schoolId, async (tx) => {
      const [teacher, year, cls, subject] = await Promise.all([
        tx.teacher.findFirst({
          where: { id: dto.teacherId },
          select: { id: true },
        }),
        tx.academicYear.findFirst({
          where: { id: dto.academicYearId },
          select: { id: true },
        }),
        tx.class.findFirst({ where: { id: dto.classId }, select: { id: true } }),
        tx.subject.findFirst({
          where: { id: dto.subjectId },
          select: { id: true },
        }),
      ]);
      if (!teacher) throw new BadRequestException("Invalid teacher");
      if (!year) throw new BadRequestException("Invalid academic year");
      if (!cls) throw new BadRequestException("Invalid class");
      if (!subject) throw new BadRequestException("Invalid subject");

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

      const dup = await tx.teacherAssignment.findFirst({
        where: {
          teacherId: dto.teacherId,
          classId: dto.classId,
          sectionId,
          subjectId: dto.subjectId,
          academicYearId: dto.academicYearId,
        },
        select: { id: true },
      });
      if (dup) {
        throw new ConflictException("This assignment already exists");
      }

      return tx.teacherAssignment.create({
        data: {
          schoolId,
          teacherId: dto.teacherId,
          academicYearId: dto.academicYearId,
          classId: dto.classId,
          sectionId,
          subjectId: dto.subjectId,
        },
        include: assignmentInclude,
      });
    });
  }

  findAll(
    schoolId: string,
    filters: { teacherId?: string; classId?: string; academicYearId?: string } = {},
  ) {
    return this.prisma.forTenant(schoolId, (tx) =>
      tx.teacherAssignment.findMany({
        where: {
          teacherId: filters.teacherId,
          classId: filters.classId,
          academicYearId: filters.academicYearId,
        },
        include: assignmentInclude,
        orderBy: { createdAt: "desc" },
      }),
    );
  }

  async findOne(schoolId: string, id: string) {
    const a = await this.prisma.forTenant(schoolId, (tx) =>
      tx.teacherAssignment.findFirst({ where: { id }, include: assignmentInclude }),
    );
    if (!a) throw new NotFoundException("Assignment not found");
    return a;
  }

  async remove(schoolId: string, id: string) {
    await this.findOne(schoolId, id);
    await this.prisma.forTenant(schoolId, (tx) =>
      tx.teacherAssignment.delete({ where: { id } }),
    );
    return { success: true };
  }
}
