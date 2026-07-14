import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { PromoteClassInput, PromoteSchoolWideInput, PromoteStudentInput } from "@ekulmis/shared";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class PromotionsService {
  constructor(private readonly prisma: PrismaService) {}

  history(schoolId: string, academicYearId?: string) {
    return this.prisma.forTenant(schoolId, (tx) =>
      tx.promotionRecord.findMany({
        where: academicYearId ? { academicYearId } : undefined,
        orderBy: { promotedAt: "desc" },
        include: {
          student: {
            select: {
              code: true,
              fullName: true,
              class: { select: { name: true } },
              section: { select: { name: true } },
            },
          },
        },
      }),
    );
  }

  async promoteStudent(schoolId: string, dto: PromoteStudentInput, userId?: string) {
    return this.prisma.forTenant(schoolId, async (tx) => {
      const student = await tx.student.findFirst({
        where: { id: dto.studentId },
        select: { id: true, classId: true, sectionId: true, status: true },
      });
      if (!student) throw new NotFoundException("Student not found");

      const record = await tx.promotionRecord.create({
        data: {
          schoolId,
          studentId: student.id,
          academicYearId: dto.academicYearId,
          type: "INDIVIDUAL",
          fromClassId: student.classId,
          fromSectionId: student.sectionId,
          toClassId: dto.toClassId ?? null,
          toSectionId: dto.toSectionId ?? null,
          graduated: dto.graduate,
          promotedByUserId: userId ?? null,
        },
      });

      if (dto.graduate) {
        await tx.student.update({
          where: { id: student.id },
          data: { status: "GRADUATED" },
        });
      } else if (dto.toClassId) {
        await tx.student.update({
          where: { id: student.id },
          data: {
            classId: dto.toClassId,
            sectionId: dto.toSectionId ?? null,
          },
        });
      }
      return record;
    });
  }

  async promoteClass(schoolId: string, dto: PromoteClassInput, userId?: string) {
    return this.prisma.forTenant(schoolId, async (tx) => {
      const students = await tx.student.findMany({
        where: {
          classId: dto.fromClassId,
          sectionId: dto.fromSectionId ?? undefined,
          status: "ACTIVE",
        },
        select: { id: true, classId: true, sectionId: true },
      });

      let promoted = 0;
      for (const student of students) {
        await tx.promotionRecord.create({
          data: {
            schoolId,
            studentId: student.id,
            academicYearId: dto.academicYearId,
            type: "CLASS",
            fromClassId: student.classId,
            fromSectionId: student.sectionId,
            toClassId: dto.toClassId ?? null,
            toSectionId: dto.toSectionId ?? null,
            graduated: dto.graduate,
            promotedByUserId: userId ?? null,
          },
        });
        if (dto.graduate) {
          await tx.student.update({
            where: { id: student.id },
            data: { status: "GRADUATED" },
          });
        } else if (dto.toClassId) {
          await tx.student.update({
            where: { id: student.id },
            data: {
              classId: dto.toClassId,
              sectionId: dto.toSectionId ?? null,
            },
          });
        }
        promoted++;
      }
      return { promoted };
    });
  }

  async promoteSchoolWide(
    schoolId: string,
    dto: PromoteSchoolWideInput,
    userId?: string,
  ) {
    return this.prisma.forTenant(schoolId, async (tx) => {
      const classes = await tx.class.findMany({
        where: { academicYearId: dto.academicYearId },
        orderBy: { orderIndex: "asc" },
        select: { id: true, orderIndex: true },
      });
      const classByOrder = new Map(classes.map((c) => [c.orderIndex, c.id]));
      const maxOrder = Math.max(...classes.map((c) => c.orderIndex), 0);

      const students = await tx.student.findMany({
        where: { status: "ACTIVE", class: { academicYearId: dto.academicYearId } },
        select: {
          id: true,
          classId: true,
          sectionId: true,
          class: { select: { orderIndex: true } },
        },
      });

      let promoted = 0;
      for (const student of students) {
        const order = student.class.orderIndex;
        const toClassId =
          dto.graduate && order >= maxOrder
            ? null
            : classByOrder.get(order + 1) ?? null;
        const graduate = dto.graduate && order >= maxOrder;

        await tx.promotionRecord.create({
          data: {
            schoolId,
            studentId: student.id,
            academicYearId: dto.academicYearId,
            type: "SCHOOL_WIDE",
            fromClassId: student.classId,
            fromSectionId: student.sectionId,
            toClassId,
            toSectionId: null,
            graduated: graduate,
            promotedByUserId: userId ?? null,
          },
        });

        if (graduate) {
          await tx.student.update({
            where: { id: student.id },
            data: { status: "GRADUATED" },
          });
        } else if (toClassId) {
          await tx.student.update({
            where: { id: student.id },
            data: { classId: toClassId, sectionId: null },
          });
        }
        promoted++;
      }
      return { promoted };
    });
  }

  graduated(schoolId: string) {
    return this.prisma.forTenant(schoolId, (tx) =>
      tx.student.findMany({
        where: { status: "GRADUATED" },
        orderBy: { updatedAt: "desc" },
        include: {
          class: { select: { name: true } },
          section: { select: { name: true } },
        },
      }),
    );
  }
}
