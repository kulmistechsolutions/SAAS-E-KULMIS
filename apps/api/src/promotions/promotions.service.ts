import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type {
  PromoteClassInput,
  PromoteSchoolWideInput,
  PromoteStudentInput,
  RetainStudentInput,
} from "@ekulmis/shared";
import { PrismaService } from "../prisma/prisma.service";
import type { Prisma } from "@prisma/client";

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
      const ladder = await this.loadLadder(tx, dto.academicYearId);
      const lastClassId = ladder.ordered.at(-1)?.id ?? null;

      const students = await tx.student.findMany({
        where: { status: "ACTIVE", class: { academicYearId: dto.academicYearId } },
        select: {
          id: true,
          classId: true,
          sectionId: true,
        },
      });

      let promoted = 0;
      for (const student of students) {
        const isLast = student.classId === lastClassId;
        const graduate = dto.graduate && isLast;
        const toClassId = graduate
          ? null
          : (ladder.nextOf.get(student.classId) ?? null);

        // A student on the top rung who is not being graduated has nowhere to
        // go. Recording a promotion for them would put a no-op in the history
        // and inflate the count the screen reports back.
        if (!graduate && !toClassId) continue;

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

  /**
   * The year's classes in promotion order, plus what follows each one.
   *
   * `next` is the following entry in the sorted list rather than the class
   * whose orderIndex is one higher. Those were the same while every year held
   * exactly twelve contiguous grades, but a school that builds its own ladder
   * reorders and deletes classes, which leaves gaps — and on a gap the old
   * lookup quietly returned nothing, so promotion skipped the student while
   * still counting them as promoted.
   */
  private async loadLadder(tx: Prisma.TransactionClient, academicYearId: string) {
    const ordered = await tx.class.findMany({
      where: { academicYearId },
      orderBy: [{ orderIndex: "asc" }, { name: "asc" }],
      select: { id: true, orderIndex: true, stageId: true },
    });
    const nextOf = new Map<string, string>();
    for (let i = 0; i < ordered.length - 1; i++) {
      nextOf.set(ordered[i]!.id, ordered[i + 1]!.id);
    }
    return { ordered, nextOf };
  }

  /**
   * Hold a student back. What they repeat is the school's choice: the class
   * they failed, or — for a school whose stage is one indivisible year of two
   * semesters — every class in that stage, which means going back to its first.
   *
   * Recorded like any other promotion so the history explains why a student
   * appears twice in the same class.
   */
  async retainStudent(schoolId: string, dto: RetainStudentInput, userId?: string) {
    const school = await this.prisma.forTenant(schoolId, (tx) =>
      tx.school.findFirst({
        where: { id: schoolId },
        select: { repeatScope: true },
      }),
    );

    return this.prisma.forTenant(schoolId, async (tx) => {
      const student = await tx.student.findFirst({
        where: { id: dto.studentId },
        select: {
          id: true,
          classId: true,
          sectionId: true,
          class: { select: { academicYearId: true, stageId: true } },
        },
      });
      if (!student) throw new NotFoundException("Student not found");

      let toClassId = student.classId;

      if (school?.repeatScope === "STAGE" && student.class.stageId) {
        const first = await tx.class.findFirst({
          where: { stageId: student.class.stageId },
          orderBy: [{ orderIndex: "asc" }, { name: "asc" }],
          select: { id: true },
        });
        if (first) toClassId = first.id;
      }

      await tx.promotionRecord.create({
        data: {
          schoolId,
          studentId: student.id,
          academicYearId: dto.academicYearId,
          type: "INDIVIDUAL",
          fromClassId: student.classId,
          fromSectionId: student.sectionId,
          toClassId,
          toSectionId: null,
          graduated: false,
          promotedByUserId: userId ?? null,
        },
      });

      // Only write when the class actually changes — under CLASS scope the
      // student stays exactly where they are and the record alone is the point.
      if (toClassId !== student.classId) {
        await tx.student.update({
          where: { id: student.id },
          data: { classId: toClassId, sectionId: null },
        });
      }

      return {
        success: true,
        scope: school?.repeatScope ?? "CLASS",
        repeatedClassId: toClassId,
        movedBack: toClassId !== student.classId,
      };
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
