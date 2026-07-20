import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, type Shift } from "@prisma/client";
import type {
  BulkCreateAssignmentsInput,
  CreateAssignmentInput,
} from "@ekulmis/shared";
import { PrismaService } from "../prisma/prisma.service";

/** True for a Postgres unique-constraint violation (the exact-duplicate index). */
function isUniqueViolation(e: unknown): boolean {
  return (
    e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002"
  );
}

const assignmentInclude = {
  teacher: { select: { id: true, code: true, fullName: true } },
  academicYear: { select: { id: true, name: true } },
  class: { select: { id: true, name: true } },
  section: { select: { id: true, name: true } },
  subject: { select: { id: true, name: true } },
} satisfies Prisma.TeacherAssignmentInclude;

type Tx = Prisma.TransactionClient;

function assignmentKey(
  teacherId: string,
  classId: string,
  sectionId: string | null,
  subjectId: string,
  academicYearId: string,
  shift: string | null,
): string {
  // Mirrors the database's exact-duplicate index: shift only distinguishes a
  // BOTH-shift teacher's morning row from their afternoon one; two rows that
  // agree on everything else INCLUDING an absent shift are true duplicates.
  return `${teacherId}|${classId}|${sectionId ?? ""}|${subjectId}|${academicYearId}|${shift ?? ""}`;
}

@Injectable()
export class TeacherAssignmentsService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertFks(
    tx: Tx,
    dto: {
      teacherId: string;
      academicYearId: string;
      classId: string;
      subjectId: string;
      sectionId: string | null;
    },
  ): Promise<void> {
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

    if (dto.sectionId) {
      const sec = await tx.section.findFirst({
        where: { id: dto.sectionId, classId: dto.classId },
        select: { id: true },
      });
      if (!sec) {
        throw new BadRequestException("Invalid section for this class");
      }
    }
  }

  /**
   * A "whole class" assignment (no section chosen) implicitly covers every
   * section of that class. When a class's own sections span more than one
   * shift — a school running one class as a morning group and an afternoon
   * group — that single row would silently attach one teacher to both
   * groups, even though only one shift's group is really theirs.
   *
   * Timetable generation and exam teacher-resolution both trust
   * TeacherAssignment's section scoping to tell the two shifts apart, so this
   * has to be caught here, at the source, not downstream.
   */
  private async assertClassesNotMultiShift(
    tx: Tx,
    classIds: string[],
  ): Promise<void> {
    if (classIds.length === 0) return;
    const [classes, sections] = await Promise.all([
      tx.class.findMany({
        where: { id: { in: classIds } },
        select: { id: true, name: true, shiftId: true },
      }),
      tx.section.findMany({
        where: { classId: { in: classIds }, status: "ACTIVE" },
        select: { classId: true, shiftId: true },
      }),
    ]);
    const classById = new Map(classes.map((c) => [c.id, c]));
    const shiftsByClass = new Map<string, Set<string | null>>();
    for (const s of sections) {
      const effective = s.shiftId ?? classById.get(s.classId)?.shiftId ?? null;
      const set = shiftsByClass.get(s.classId) ?? new Set<string | null>();
      set.add(effective);
      shiftsByClass.set(s.classId, set);
    }
    for (const [classId, shifts] of shiftsByClass) {
      if (shifts.size > 1) {
        const name = classById.get(classId)?.name ?? "This class";
        throw new BadRequestException(
          `${name} has sections in different shifts. Pick a specific section rather than assigning the whole class, so the assignment applies to one shift only.`,
        );
      }
    }
  }

  async create(schoolId: string, dto: CreateAssignmentInput) {
    return this.prisma.forTenant(schoolId, async (tx) => {
      const sectionId = dto.sectionId ?? null;
      await this.assertFks(tx, {
        teacherId: dto.teacherId,
        academicYearId: dto.academicYearId,
        classId: dto.classId,
        subjectId: dto.subjectId,
        sectionId,
      });
      if (!sectionId) {
        await this.assertClassesNotMultiShift(tx, [dto.classId]);
      }

      const shift = dto.shift ?? null;
      const dup = await tx.teacherAssignment.findFirst({
        where: {
          teacherId: dto.teacherId,
          classId: dto.classId,
          sectionId,
          subjectId: dto.subjectId,
          academicYearId: dto.academicYearId,
          shift,
        },
        select: { id: true },
      });
      if (dup) {
        throw new ConflictException(
          "Exact duplicate: this teacher already has this subject for the same class, section, shift, and academic year",
        );
      }

      try {
        return await tx.teacherAssignment.create({
          data: {
            schoolId,
            teacherId: dto.teacherId,
            academicYearId: dto.academicYearId,
            classId: dto.classId,
            sectionId,
            subjectId: dto.subjectId,
            shift,
          },
          include: assignmentInclude,
        });
      } catch (e) {
        // A concurrent request may have inserted the same row between the check
        // above and this insert — the DB unique index (teacher_assignments_
        // exact_dup_key) is the source of truth. Surface a clean 409.
        if (isUniqueViolation(e)) {
          throw new ConflictException(
            "Exact duplicate: this teacher already has this subject for the same class, section, shift, and academic year",
          );
        }
        throw e;
      }
    });
  }

  /**
   * Create many independent assignment rows for one teacher + year.
   * Skips exact duplicates (same teacher/class/section/subject/year).
   * Each row remains linked only to the given teacherId.
   */
  async createBulk(schoolId: string, dto: BulkCreateAssignmentsInput) {
    return this.prisma.forTenant(
      schoolId,
      async (tx) => {
      const teacher = await tx.teacher.findFirst({
        where: { id: dto.teacherId },
        select: { id: true },
      });
      if (!teacher) throw new BadRequestException("Invalid teacher");

      const year = await tx.academicYear.findFirst({
        where: { id: dto.academicYearId },
        select: { id: true },
      });
      if (!year) throw new BadRequestException("Invalid academic year");

      // Deduplicate within the request itself
      const seen = new Set<string>();
      const uniqueItems: {
        classId: string;
        sectionId: string | null;
        subjectId: string;
        shift: Shift | null;
      }[] = [];
      for (const item of dto.items) {
        const sectionId = item.sectionId ?? null;
        const shift = (item.shift ?? null) as Shift | null;
        const key = assignmentKey(
          dto.teacherId,
          item.classId,
          sectionId,
          item.subjectId,
          dto.academicYearId,
          shift,
        );
        if (seen.has(key)) continue;
        seen.add(key);
        uniqueItems.push({
          classId: item.classId,
          sectionId,
          subjectId: item.subjectId,
          shift,
        });
      }

      // Validate FKs for unique class/subject/section combos
      const classIds = [...new Set(uniqueItems.map((i) => i.classId))];
      const subjectIds = [...new Set(uniqueItems.map((i) => i.subjectId))];
      const sectionIds = [
        ...new Set(
          uniqueItems
            .map((i) => i.sectionId)
            .filter((id): id is string => !!id),
        ),
      ];

      const [classes, subjects, sections] = await Promise.all([
        tx.class.findMany({
          where: { id: { in: classIds } },
          select: { id: true },
        }),
        tx.subject.findMany({
          where: { id: { in: subjectIds } },
          select: { id: true },
        }),
        sectionIds.length
          ? tx.section.findMany({
              where: { id: { in: sectionIds } },
              select: { id: true, classId: true },
            })
          : Promise.resolve([] as { id: string; classId: string }[]),
      ]);
      const classSet = new Set(classes.map((c) => c.id));
      const subjectSet = new Set(subjects.map((s) => s.id));
      const sectionMap = new Map(sections.map((s) => [s.id, s.classId]));

      for (const item of uniqueItems) {
        if (!classSet.has(item.classId)) {
          throw new BadRequestException(`Invalid class: ${item.classId}`);
        }
        if (!subjectSet.has(item.subjectId)) {
          throw new BadRequestException(`Invalid subject: ${item.subjectId}`);
        }
        if (item.sectionId) {
          const ownerClass = sectionMap.get(item.sectionId);
          if (!ownerClass || ownerClass !== item.classId) {
            throw new BadRequestException(
              "Invalid section for one of the selected classes",
            );
          }
        }
      }

      const wholeClassIds = [
        ...new Set(
          uniqueItems.filter((i) => !i.sectionId).map((i) => i.classId),
        ),
      ];
      await this.assertClassesNotMultiShift(tx, wholeClassIds);

      const existing = await tx.teacherAssignment.findMany({
        where: {
          teacherId: dto.teacherId,
          academicYearId: dto.academicYearId,
          OR: uniqueItems.map((i) => ({
            classId: i.classId,
            sectionId: i.sectionId,
            subjectId: i.subjectId,
            shift: i.shift,
          })),
        },
        select: {
          classId: true,
          sectionId: true,
          subjectId: true,
          shift: true,
        },
      });
      const existingKeys = new Set(
        existing.map((e) =>
          assignmentKey(
            dto.teacherId,
            e.classId,
            e.sectionId,
            e.subjectId,
            dto.academicYearId,
            e.shift,
          ),
        ),
      );

      const toCreate = uniqueItems.filter(
        (i) =>
          !existingKeys.has(
            assignmentKey(
              dto.teacherId,
              i.classId,
              i.sectionId,
              i.subjectId,
              dto.academicYearId,
              i.shift,
            ),
          ),
      );
      const skipped = uniqueItems.length - toCreate.length;

      // Insert every new row in ONE round-trip. A per-row create loop made this
      // transaction grow with the number of slots and, over a remote pooler,
      // could blow past the transaction timeout (P2028). `skipDuplicates` leans
      // on the exact-duplicate unique index to stay safe under concurrency.
      let insertedCount = 0;
      if (toCreate.length > 0) {
        const res = await tx.teacherAssignment.createMany({
          data: toCreate.map((item) => ({
            schoolId,
            teacherId: dto.teacherId,
            academicYearId: dto.academicYearId,
            classId: item.classId,
            sectionId: item.sectionId,
            subjectId: item.subjectId,
            shift: item.shift,
          })),
          skipDuplicates: true,
        });
        insertedCount = res.count;
      }

      // Re-fetch the rows for this batch (with relations) for the response.
      const created = toCreate.length
        ? await tx.teacherAssignment.findMany({
            where: {
              teacherId: dto.teacherId,
              academicYearId: dto.academicYearId,
              OR: toCreate.map((i) => ({
                classId: i.classId,
                sectionId: i.sectionId,
                subjectId: i.subjectId,
                shift: i.shift,
              })),
            },
            include: assignmentInclude,
            orderBy: { createdAt: "desc" },
          })
        : [];

      return {
        created,
        createdCount: insertedCount,
        // Anything not freshly inserted (pre-existing or a concurrent insert).
        skippedCount: skipped + (toCreate.length - insertedCount),
        requestedCount: dto.items.length,
      };
      },
      { timeout: 30_000, maxWait: 30_000 },
    );
  }

  findAll(
    schoolId: string,
    filters: {
      teacherId?: string;
      classId?: string;
      academicYearId?: string;
    } = {},
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
      tx.teacherAssignment.findFirst({
        where: { id },
        include: assignmentInclude,
      }),
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
