import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

interface ClassPlanEntry {
  fromClassId: string;
  fromClassName: string;
  toClassId: string | null;
  studentCount: number;
}

/**
 * Corrects a data-entry mistake — students registered under the wrong
 * academic year — by moving them to the right one. This is deliberately NOT
 * promotion: no ladder, no grade change, no PromotionRecord history, no
 * graduation. A student's class in the source year is matched to a class of
 * the same name in the destination year and the student is repointed there;
 * fee/attendance/exam history stays exactly where it happened. A class with
 * no same-named counterpart in the destination year is left alone and
 * reported back so the admin can see who wasn't moved.
 */
@Injectable()
export class AcademicYearTransferService {
  constructor(private readonly prisma: PrismaService) {}

  private async buildPlan(
    schoolId: string,
    fromYearId: string,
    toYearId: string,
  ) {
    return this.prisma.forTenant(schoolId, async (tx) => {
      if (fromYearId === toYearId) {
        throw new BadRequestException(
          "Source and destination academic years must be different.",
        );
      }
      const [fromYear, toYear] = await Promise.all([
        tx.academicYear.findFirst({
          where: { id: fromYearId },
          select: { id: true, name: true },
        }),
        tx.academicYear.findFirst({
          where: { id: toYearId },
          select: { id: true, name: true },
        }),
      ]);
      if (!fromYear) throw new NotFoundException("Source academic year not found.");
      if (!toYear) throw new NotFoundException("Destination academic year not found.");

      const [fromClasses, toClasses] = await Promise.all([
        tx.class.findMany({
          where: { academicYearId: fromYearId },
          select: {
            id: true,
            name: true,
            hasSections: true,
            sections: { select: { id: true, name: true } },
          },
        }),
        tx.class.findMany({
          where: { academicYearId: toYearId },
          select: {
            id: true,
            name: true,
            hasSections: true,
            sections: { select: { id: true, name: true } },
          },
        }),
      ]);
      const toByName = new Map(
        toClasses.map((c) => [c.name.trim().toLowerCase(), c]),
      );

      const classIds = fromClasses.map((c) => c.id);
      const studentCounts = classIds.length
        ? await tx.student.groupBy({
            by: ["classId"],
            where: { classId: { in: classIds }, status: "ACTIVE" },
            _count: { _all: true },
          })
        : [];
      const countByClassId = new Map(
        studentCounts.map((s) => [s.classId, s._count._all]),
      );

      const classes: ClassPlanEntry[] = fromClasses.map((c) => {
        const match = toByName.get(c.name.trim().toLowerCase());
        return {
          fromClassId: c.id,
          fromClassName: c.name,
          toClassId: match?.id ?? null,
          studentCount: countByClassId.get(c.id) ?? 0,
        };
      });

      const totalStudents = classes.reduce((sum, c) => sum + c.studentCount, 0);
      const matchedStudents = classes
        .filter((c) => c.toClassId)
        .reduce((sum, c) => sum + c.studentCount, 0);
      const unmatchedClasses = classes.filter(
        (c) => !c.toClassId && c.studentCount > 0,
      );

      return {
        fromYear,
        toYear,
        fromClasses,
        toClasses,
        classes,
        totalStudents,
        matchedStudents,
        unmatchedClasses,
      };
    });
  }

  /** Counts for the confirmation dialog — no data is changed. */
  async preview(schoolId: string, fromYearId: string, toYearId: string) {
    const plan = await this.buildPlan(schoolId, fromYearId, toYearId);
    return {
      fromYear: plan.fromYear.name,
      toYear: plan.toYear.name,
      totalStudents: plan.totalStudents,
      transferable: plan.matchedStudents,
      unmatched: plan.totalStudents - plan.matchedStudents,
      unmatchedClasses: plan.unmatchedClasses.map((c) => ({
        name: c.fromClassName,
        studentCount: c.studentCount,
      })),
      classes: plan.classes
        .filter((c) => c.studentCount > 0)
        .map((c) => ({
          name: c.fromClassName,
          studentCount: c.studentCount,
          matched: !!c.toClassId,
        })),
    };
  }

  /** Moves every matched student; classes with no same-named match are skipped. */
  async execute(schoolId: string, fromYearId: string, toYearId: string) {
    const plan = await this.buildPlan(schoolId, fromYearId, toYearId);
    if (plan.matchedStudents === 0) {
      throw new BadRequestException(
        "No students could be matched to a class in the destination year.",
      );
    }

    let transferred = 0;
    await this.prisma.forTenant(
      schoolId,
      async (tx) => {
        for (const cp of plan.classes) {
          if (!cp.toClassId || cp.studentCount === 0) continue;
          const toClass = plan.toClasses.find((c) => c.id === cp.toClassId)!;
          const fromClass = plan.fromClasses.find(
            (c) => c.id === cp.fromClassId,
          )!;
          const toSectionsByName = new Map(
            toClass.sections.map((s) => [s.name.trim().toLowerCase(), s.id]),
          );

          const students = await tx.student.findMany({
            where: { classId: cp.fromClassId, status: "ACTIVE" },
            select: { id: true, sectionId: true },
          });

          // Group by resolved destination section so each group moves in one
          // updateMany instead of one query per student.
          const bySection = new Map<string | null, string[]>();
          for (const st of students) {
            let destSectionId: string | null = null;
            if (toClass.hasSections && st.sectionId) {
              const srcSection = fromClass.sections.find(
                (s) => s.id === st.sectionId,
              );
              destSectionId = srcSection
                ? (toSectionsByName.get(srcSection.name.trim().toLowerCase()) ?? null)
                : null;
            }
            const arr = bySection.get(destSectionId) ?? [];
            arr.push(st.id);
            bySection.set(destSectionId, arr);
          }
          for (const [destSectionId, ids] of bySection) {
            await tx.student.updateMany({
              where: { id: { in: ids } },
              data: { classId: cp.toClassId, sectionId: destSectionId },
            });
            transferred += ids.length;
          }
        }
      },
      { timeout: 120_000, maxWait: 30_000 },
    );

    return {
      fromYear: plan.fromYear.name,
      toYear: plan.toYear.name,
      transferred,
      skipped: plan.totalStudents - transferred,
      skippedClasses: plan.unmatchedClasses.map((c) => c.fromClassName),
    };
  }
}
