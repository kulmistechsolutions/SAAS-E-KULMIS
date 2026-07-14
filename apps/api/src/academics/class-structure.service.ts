import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  DEFAULT_GRADE_COUNT,
  DEFAULT_GRADE_NAMES,
  academicNameKey,
  normalizeAcademicName,
} from "@ekulmis/shared";
import { PrismaService } from "../prisma/prisma.service";
import type { Prisma } from "@prisma/client";

export interface ClassStructureRepairResult {
  academicYearId: string;
  classesCreated: number;
  classesMerged: number;
  sectionsMerged: number;
  excessClassesRemoved: number;
}

type Tx = Prisma.TransactionClient;

@Injectable()
export class ClassStructureService {
  constructor(private readonly prisma: PrismaService) {}

  /** Ensure exactly 12 default grade slots exist; dedupe first. */
  async repairAcademicYear(
    schoolId: string,
    academicYearId: string,
  ): Promise<ClassStructureRepairResult> {
    const year = await this.prisma.forTenant(schoolId, (tx) =>
      tx.academicYear.findFirst({
        where: { id: academicYearId },
        select: { id: true },
      }),
    );
    if (!year) {
      throw new NotFoundException("Academic year not found");
    }

    return this.prisma.forTenant(schoolId, async (tx) => {
      const dedupe = await this.deduplicateClassesInTx(tx, schoolId, academicYearId);
      const ensure = await this.ensureDefaultClassesInTx(tx, schoolId, academicYearId);
      const trim = await this.removeExcessClassesInTx(tx, schoolId, academicYearId);

      return {
        academicYearId,
        classesCreated: ensure.created,
        classesMerged: dedupe.classesMerged,
        sectionsMerged: dedupe.sectionsMerged,
        excessClassesRemoved: trim.removed,
      };
    });
  }

  async repairAllYears(schoolId: string): Promise<ClassStructureRepairResult[]> {
    const years = await this.prisma.forTenant(schoolId, (tx) =>
      tx.academicYear.findMany({ select: { id: true } }),
    );
    const results: ClassStructureRepairResult[] = [];
    for (const y of years) {
      results.push(await this.repairAcademicYear(schoolId, y.id));
    }
    return results;
  }

  async assertCanCreateClass(
    schoolId: string,
    academicYearId: string,
    name: string,
  ): Promise<void> {
    const normalized = normalizeAcademicName(name);
    const key = academicNameKey(normalized);

    await this.prisma.forTenant(schoolId, async (tx) => {
      const existing = await tx.class.findMany({
        where: { academicYearId },
        select: { id: true, name: true },
      });

      if (
        existing.some((c) => academicNameKey(c.name) === key)
      ) {
        throw new ConflictException(
          "A class with this name already exists in this academic year.",
        );
      }

      if (existing.length >= DEFAULT_GRADE_COUNT) {
        throw new ConflictException(
          `This academic year already has ${DEFAULT_GRADE_COUNT} classes. Rename an existing class instead of creating a new one.`,
        );
      }
    });
  }

  async assertCanRenameClass(
    schoolId: string,
    classId: string,
    academicYearId: string,
    name: string,
  ): Promise<void> {
    const normalized = normalizeAcademicName(name);
    const key = academicNameKey(normalized);

    await this.prisma.forTenant(schoolId, async (tx) => {
      const conflict = await tx.class.findFirst({
        where: {
          academicYearId,
          id: { not: classId },
          name: { equals: normalized, mode: "insensitive" },
        },
        select: { id: true },
      });
      if (conflict) {
        throw new ConflictException(
          "Another class in this year already uses this name.",
        );
      }

      const dup = await tx.class.findMany({
        where: { academicYearId, id: { not: classId } },
        select: { name: true },
      });
      if (dup.some((c) => academicNameKey(c.name) === key)) {
        throw new ConflictException(
          "Another class in this year already uses this name.",
        );
      }
    });
  }

  private async deduplicateClassesInTx(
    tx: Tx,
    schoolId: string,
    academicYearId: string,
  ): Promise<{ classesMerged: number; sectionsMerged: number }> {
    const classes = await tx.class.findMany({
      where: { schoolId, academicYearId },
      orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }],
      include: {
        _count: { select: { students: true } },
        sections: true,
      },
    });

    const groups = new Map<string, typeof classes>();
    for (const cls of classes) {
      const key = academicNameKey(cls.name);
      const list = groups.get(key) ?? [];
      list.push(cls);
      groups.set(key, list);
    }

    let classesMerged = 0;
    let sectionsMerged = 0;

    for (const group of groups.values()) {
      if (group.length <= 1) continue;

      const sorted = [...group].sort((a, b) => {
        const studentDiff = b._count.students - a._count.students;
        if (studentDiff !== 0) return studentDiff;
        const orderDiff = a.orderIndex - b.orderIndex;
        if (orderDiff !== 0) return orderDiff;
        return a.createdAt.getTime() - b.createdAt.getTime();
      });

      const canonical = sorted[0];
      for (const dup of sorted.slice(1)) {
        sectionsMerged += await this.mergeClassInto(tx, schoolId, dup.id, canonical.id);
        classesMerged++;
      }
    }

    return { classesMerged, sectionsMerged };
  }

  private async mergeClassInto(
    tx: Tx,
    schoolId: string,
    fromClassId: string,
    toClassId: string,
  ): Promise<number> {
    if (fromClassId === toClassId) return 0;

    const dupSections = await tx.section.findMany({
      where: { schoolId, classId: fromClassId },
    });
    const canonSections = await tx.section.findMany({
      where: { schoolId, classId: toClassId },
    });
    const canonByKey = new Map(
      canonSections.map((s) => [academicNameKey(s.name), s]),
    );

    let sectionsMerged = 0;
    for (const sec of dupSections) {
      const key = academicNameKey(sec.name);
      const target = canonByKey.get(key);
      if (target) {
        await this.repointSectionReferences(tx, sec.id, target.id, toClassId);
        await tx.section.delete({ where: { id: sec.id } });
        sectionsMerged++;
      } else {
        await tx.section.update({
          where: { id: sec.id },
          data: { classId: toClassId },
        });
        canonByKey.set(key, sec);
      }
    }

    await tx.student.updateMany({
      where: { classId: fromClassId },
      data: { classId: toClassId },
    });

    await this.repointClassOnlyReferences(tx, fromClassId, toClassId);

    await tx.class.delete({ where: { id: fromClassId } });

    const remainingSections = await tx.section.count({
      where: { classId: toClassId },
    });
    await tx.class.update({
      where: { id: toClassId },
      data: { hasSections: remainingSections > 0 },
    });

    return sectionsMerged;
  }

  private async repointSectionReferences(
    tx: Tx,
    fromSectionId: string,
    toSectionId: string,
    toClassId: string,
  ) {
    await tx.student.updateMany({
      where: { sectionId: fromSectionId },
      data: { sectionId: toSectionId, classId: toClassId },
    });

    const assignments = await tx.teacherAssignment.findMany({
      where: { sectionId: fromSectionId },
    });
    for (const a of assignments) {
      const exists = await tx.teacherAssignment.findFirst({
        where: {
          schoolId: a.schoolId,
          teacherId: a.teacherId,
          classId: toClassId,
          sectionId: toSectionId,
          subjectId: a.subjectId,
          academicYearId: a.academicYearId,
        },
      });
      if (exists) {
        await tx.teacherAssignment.delete({ where: { id: a.id } });
      } else {
        await tx.teacherAssignment.update({
          where: { id: a.id },
          data: { classId: toClassId, sectionId: toSectionId },
        });
      }
    }

    const classSubjects = await tx.classSubject.findMany({
      where: { sectionId: fromSectionId },
    });
    for (const cs of classSubjects) {
      const exists = await tx.classSubject.findFirst({
        where: {
          schoolId: cs.schoolId,
          classId: toClassId,
          sectionId: toSectionId,
          subjectId: cs.subjectId,
        },
      });
      if (exists) {
        await tx.classSubject.delete({ where: { id: cs.id } });
      } else {
        await tx.classSubject.update({
          where: { id: cs.id },
          data: { classId: toClassId, sectionId: toSectionId },
        });
      }
    }

    await tx.studentAttendance.updateMany({
      where: { sectionId: fromSectionId },
      data: { sectionId: toSectionId, classId: toClassId },
    });

    await tx.exam.updateMany({
      where: { sectionId: fromSectionId },
      data: { sectionId: toSectionId, classId: toClassId },
    });

    await tx.quiz.updateMany({
      where: { sectionId: fromSectionId },
      data: { sectionId: toSectionId, classId: toClassId },
    });
  }

  private async repointClassOnlyReferences(tx: Tx, fromClassId: string, toClassId: string) {
    await tx.teacherAssignment.updateMany({
      where: { classId: fromClassId, sectionId: null },
      data: { classId: toClassId },
    });

    const wholeClassSubjects = await tx.classSubject.findMany({
      where: { classId: fromClassId, sectionId: null },
    });
    for (const cs of wholeClassSubjects) {
      const exists = await tx.classSubject.findFirst({
        where: {
          schoolId: cs.schoolId,
          classId: toClassId,
          sectionId: null,
          subjectId: cs.subjectId,
        },
      });
      if (exists) {
        await tx.classSubject.delete({ where: { id: cs.id } });
      } else {
        await tx.classSubject.update({
          where: { id: cs.id },
          data: { classId: toClassId },
        });
      }
    }

    await tx.studentAttendance.updateMany({
      where: { classId: fromClassId },
      data: { classId: toClassId },
    });

    await tx.exam.updateMany({
      where: { classId: fromClassId },
      data: { classId: toClassId },
    });

    await tx.quiz.updateMany({
      where: { classId: fromClassId },
      data: { classId: toClassId },
    });

    await tx.promotionRecord.updateMany({
      where: { fromClassId },
      data: { fromClassId: toClassId },
    });
    await tx.promotionRecord.updateMany({
      where: { toClassId: fromClassId },
      data: { toClassId },
    });

    await tx.smsCampaign.updateMany({
      where: { classId: fromClassId },
      data: { classId: toClassId },
    });
  }

  private async ensureDefaultClassesInTx(
    tx: Tx,
    schoolId: string,
    academicYearId: string,
  ): Promise<{ created: number }> {
    const existing = await tx.class.findMany({
      where: { schoolId, academicYearId },
      orderBy: [{ orderIndex: "asc" }, { name: "asc" }],
    });

    const usedOrderIndexes = new Set(existing.map((c) => c.orderIndex));
    let created = 0;

    for (let i = 0; i < DEFAULT_GRADE_NAMES.length; i++) {
      const orderIndex = i + 1;
      const defaultName = DEFAULT_GRADE_NAMES[i];

      const hasSlot = existing.some((c) => c.orderIndex === orderIndex);
      if (hasSlot) continue;

      const nameTaken = existing.some(
        (c) => academicNameKey(c.name) === academicNameKey(defaultName),
      );
      if (nameTaken) continue;

      const row = await tx.class.create({
        data: {
          schoolId,
          academicYearId,
          name: defaultName,
          orderIndex,
          hasSections: false,
          status: "ACTIVE",
        },
      });
      existing.push(row);
      usedOrderIndexes.add(orderIndex);
      created++;
    }

    // Backfill orderIndex on legacy rows missing a slot assignment.
    const unindexed = existing.filter((c) => c.orderIndex <= 0);
    for (const cls of unindexed) {
      let slot = 1;
      while (usedOrderIndexes.has(slot) && slot <= DEFAULT_GRADE_COUNT) slot++;
      if (slot > DEFAULT_GRADE_COUNT) continue;
      await tx.class.update({
        where: { id: cls.id },
        data: { orderIndex: slot },
      });
      usedOrderIndexes.add(slot);
      cls.orderIndex = slot;
    }

    return { created };
  }

  /** Remove empty duplicate slots beyond the 12-grade ladder when safe. */
  private async removeExcessClassesInTx(
    tx: Tx,
    schoolId: string,
    academicYearId: string,
  ): Promise<{ removed: number }> {
    const classes = await tx.class.findMany({
      where: { schoolId, academicYearId },
      orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }],
      include: { _count: { select: { students: true, sections: true } } },
    });

    if (classes.length <= DEFAULT_GRADE_COUNT) {
      return { removed: 0 };
    }

    const keepIds = new Set<string>();
    for (let i = 1; i <= DEFAULT_GRADE_COUNT; i++) {
      const match = classes.find(
        (c) => c.orderIndex === i && !keepIds.has(c.id),
      );
      if (match) keepIds.add(match.id);
    }

    for (const cls of classes) {
      if (keepIds.has(cls.id)) continue;
      if (cls._count.students > 0) {
        keepIds.add(cls.id);
      }
    }

    let removed = 0;
    for (const cls of classes) {
      if (keepIds.has(cls.id)) continue;
      if (cls._count.students > 0) continue;
      await tx.section.deleteMany({ where: { classId: cls.id } });
      await tx.class.delete({ where: { id: cls.id } });
      removed++;
    }

    return { removed };
  }
}
