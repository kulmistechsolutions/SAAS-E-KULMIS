import { Injectable, NotFoundException } from "@nestjs/common";
import type { CreateClassSubjectInput } from "@ekulmis/shared";
import { PrismaService } from "../prisma/prisma.service";
import { onUniqueViolation } from "./prisma-errors";

@Injectable()
export class ClassSubjectService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(
    schoolId: string,
    filter?: { academicYearId?: string; classId?: string },
  ) {
    return this.prisma.forTenant(schoolId, (tx) =>
      tx.classSubject.findMany({
        where: {
          ...(filter?.academicYearId
            ? { academicYearId: filter.academicYearId }
            : {}),
          ...(filter?.classId ? { classId: filter.classId } : {}),
        },
        orderBy: { createdAt: "asc" },
      }),
    );
  }

  async create(schoolId: string, dto: CreateClassSubjectInput) {
    const [cls, subject] = await this.prisma.forTenant(schoolId, (tx) =>
      Promise.all([
        tx.class.findFirst({
          where: { id: dto.classId },
          select: { id: true, academicYearId: true },
        }),
        tx.subject.findFirst({
          where: { id: dto.subjectId },
          select: { id: true },
        }),
      ]),
    );
    if (!cls) throw new NotFoundException("Class not found");
    if (!subject) throw new NotFoundException("Subject not found");

    return this.prisma
      .forTenant(schoolId, (tx) =>
        tx.classSubject.create({
          data: {
            schoolId,
            academicYearId: dto.academicYearId || cls.academicYearId,
            classId: dto.classId,
            sectionId: dto.sectionId ?? null,
            subjectId: dto.subjectId,
          },
        }),
      )
      .catch(
        onUniqueViolation("This subject is already assigned to the class/section"),
      );
  }

  async remove(schoolId: string, id: string) {
    const existing = await this.prisma.forTenant(schoolId, (tx) =>
      tx.classSubject.findFirst({ where: { id }, select: { id: true } }),
    );
    if (!existing) throw new NotFoundException("Assignment not found");
    await this.prisma.forTenant(schoolId, (tx) =>
      tx.classSubject.delete({ where: { id } }),
    );
    return { success: true };
  }
}
