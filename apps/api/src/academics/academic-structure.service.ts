import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  AcademicStructureSettingsInput,
  CloneAcademicStructureInput,
  CreateAcademicLevelInput,
  CreateAcademicStageInput,
  ReorderInput,
  UpdateAcademicLevelInput,
  UpdateAcademicStageInput,
} from "@ekulmis/shared";
import { normalizeAcademicName } from "@ekulmis/shared";
import { PrismaService } from "../prisma/prisma.service";
import { onUniqueViolation } from "./prisma-errors";

/**
 * The optional Level and Stage tiers a school can put above its classes, plus
 * the settings that decide how promotion walks them.
 *
 * Everything here is inert for a school on the default Grade 1–12 ladder: it
 * owns no levels or stages, so these endpoints simply return empty lists.
 */
@Injectable()
export class AcademicStructureService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Settings ──────────────────────────────────────────────────────────────

  async getSettings(schoolId: string) {
    const school = await this.prisma.forTenant(schoolId, (tx) =>
      tx.school.findFirst({
        where: { id: schoolId },
        select: {
          customStructureEnabled: true,
          termsPerYear: true,
          repeatScope: true,
          hideDefaultGrades: true,
        },
      }),
    );
    if (!school) throw new NotFoundException("School not found");
    return school;
  }

  async updateSettings(schoolId: string, dto: AcademicStructureSettingsInput) {
    return this.prisma.forTenant(schoolId, (tx) =>
      tx.school.update({
        where: { id: schoolId },
        data: {
          ...(dto.customStructureEnabled !== undefined && {
            customStructureEnabled: dto.customStructureEnabled,
            // Turning the feature off must also stop everything it turned
            // on — otherwise a school that built a structure (multiple
            // terms per year, stage-based repeats, hidden default Grades)
            // then switched the whole thing back off keeps those settings
            // sitting orphaned in the database. termsPerYear/repeatScope
            // are meaningless without levels and stages to walk, and
            // repeatScope: STAGE in particular drives retainStudent's
            // hold-back logic regardless of whether the feature is on.
            ...(dto.customStructureEnabled === false && {
              hideDefaultGrades: false,
              termsPerYear: 1,
              repeatScope: "CLASS",
            }),
          }),
          ...(dto.termsPerYear !== undefined && {
            termsPerYear: dto.termsPerYear,
          }),
          ...(dto.repeatScope !== undefined && { repeatScope: dto.repeatScope }),
          ...(dto.hideDefaultGrades !== undefined && {
            hideDefaultGrades: dto.hideDefaultGrades,
          }),
        },
        select: {
          customStructureEnabled: true,
          termsPerYear: true,
          repeatScope: true,
          hideDefaultGrades: true,
        },
      }),
    );
  }

  // ── Levels ────────────────────────────────────────────────────────────────

  /**
   * The whole ladder for one year, ordered the way promotion walks it. Classes
   * that belong to no level come back under `ungrouped`, which is the normal
   * shape for a school that has not turned the custom structure on and for the
   * early classes an Arabic school leaves outside any stage.
   */
  async findTree(schoolId: string, academicYearId: string) {
    return this.prisma.forTenant(schoolId, async (tx) => {
      const [levels, classes] = await Promise.all([
        tx.academicLevel.findMany({
          where: { academicYearId },
          orderBy: [{ orderIndex: "asc" }, { name: "asc" }],
          include: {
            stages: { orderBy: [{ orderIndex: "asc" }, { name: "asc" }] },
          },
        }),
        tx.class.findMany({
          where: { academicYearId },
          orderBy: [{ orderIndex: "asc" }, { name: "asc" }],
          include: { sections: { orderBy: { name: "asc" } } },
        }),
      ]);

      const byLevel = new Map<string | null, typeof classes>();
      for (const c of classes) {
        const key = c.levelId ?? null;
        const bucket = byLevel.get(key);
        if (bucket) bucket.push(c);
        else byLevel.set(key, [c]);
      }

      return {
        levels: levels.map((level) => {
          const own = byLevel.get(level.id) ?? [];
          return {
            ...level,
            stages: level.stages.map((stage) => ({
              ...stage,
              classes: own.filter((c) => c.stageId === stage.id),
            })),
            // Classes hung straight off the level, e.g. التمهيد … الفصل الرابع.
            classes: own.filter((c) => c.stageId === null),
          };
        }),
        ungrouped: byLevel.get(null) ?? [],
      };
    });
  }

  async createLevel(schoolId: string, dto: CreateAcademicLevelInput) {
    await this.assertYear(schoolId, dto.academicYearId);
    const name = normalizeAcademicName(dto.name);
    return this.prisma
      .forTenant(schoolId, async (tx) =>
        tx.academicLevel.create({
          data: {
            schoolId,
            academicYearId: dto.academicYearId,
            name,
            orderIndex:
              dto.orderIndex ??
              (await this.nextOrderIndex(tx, "academicLevel", {
                academicYearId: dto.academicYearId,
              })),
            status: dto.status ?? "ACTIVE",
          },
        }),
      )
      .catch(
        onUniqueViolation("A level with this name already exists in this year"),
      );
  }

  async updateLevel(
    schoolId: string,
    id: string,
    dto: UpdateAcademicLevelInput,
  ) {
    await this.findLevel(schoolId, id);
    return this.prisma
      .forTenant(schoolId, (tx) =>
        tx.academicLevel.update({
          where: { id },
          data: {
            ...(dto.name !== undefined && {
              name: normalizeAcademicName(dto.name),
            }),
            ...(dto.orderIndex !== undefined && { orderIndex: dto.orderIndex }),
            ...(dto.status !== undefined && { status: dto.status }),
          },
        }),
      )
      .catch(
        onUniqueViolation("A level with this name already exists in this year"),
      );
  }

  /**
   * Deleting a level detaches its classes rather than destroying them — the
   * foreign keys are ON DELETE SET NULL, so the students stay put and the
   * classes fall back to being ungrouped.
   */
  async removeLevel(schoolId: string, id: string) {
    await this.findLevel(schoolId, id);
    await this.prisma.forTenant(schoolId, (tx) =>
      tx.academicLevel.delete({ where: { id } }),
    );
    return { success: true };
  }

  // ── Stages ────────────────────────────────────────────────────────────────

  async createStage(schoolId: string, dto: CreateAcademicStageInput) {
    await this.findLevel(schoolId, dto.levelId);
    const name = normalizeAcademicName(dto.name);
    return this.prisma
      .forTenant(schoolId, async (tx) =>
        tx.academicStage.create({
          data: {
            schoolId,
            levelId: dto.levelId,
            name,
            orderIndex:
              dto.orderIndex ??
              (await this.nextOrderIndex(tx, "academicStage", {
                levelId: dto.levelId,
              })),
            status: dto.status ?? "ACTIVE",
          },
        }),
      )
      .catch(
        onUniqueViolation("A stage with this name already exists in this level"),
      );
  }

  async updateStage(
    schoolId: string,
    id: string,
    dto: UpdateAcademicStageInput,
  ) {
    await this.findStage(schoolId, id);
    return this.prisma
      .forTenant(schoolId, (tx) =>
        tx.academicStage.update({
          where: { id },
          data: {
            ...(dto.name !== undefined && {
              name: normalizeAcademicName(dto.name),
            }),
            ...(dto.orderIndex !== undefined && { orderIndex: dto.orderIndex }),
            ...(dto.status !== undefined && { status: dto.status }),
          },
        }),
      )
      .catch(
        onUniqueViolation("A stage with this name already exists in this level"),
      );
  }

  async removeStage(schoolId: string, id: string) {
    await this.findStage(schoolId, id);
    await this.prisma.forTenant(schoolId, (tx) =>
      tx.academicStage.delete({ where: { id } }),
    );
    return { success: true };
  }

  // ── Ordering ──────────────────────────────────────────────────────────────

  /**
   * Rewrite orderIndex from array position. This is how a school edits its
   * promotion path, since promotion walks classes by orderIndex.
   *
   * Written as one updateMany per position rather than a read-then-write loop:
   * a fourteen-class ladder would otherwise round-trip twice per row and, on a
   * slow connection, blow the transaction timeout.
   */
  async reorder(
    schoolId: string,
    entity: "level" | "stage" | "class",
    dto: ReorderInput,
  ) {
    const ids = dto.ids;
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException("Duplicate ids in the requested order");
    }
    await this.prisma.forTenant(schoolId, async (tx) => {
      const table =
        entity === "level"
          ? tx.academicLevel
          : entity === "stage"
            ? tx.academicStage
            : tx.class;
      await Promise.all(
        ids.map((id, index) =>
          // updateMany, not update: it matches nothing instead of throwing when
          // an id belongs to another school, which RLS already hides.
          (table as { updateMany: Function }).updateMany({
            where: { id },
            data: { orderIndex: index },
          }),
        ),
      );
    });
    return { success: true, count: ids.length };
  }

  // ── Cloning a year's ladder ───────────────────────────────────────────────

  /**
   * Copy a whole ladder into another year so a school defines it once. The
   * target year must be empty of structure, because merging two ladders would
   * silently produce duplicate classes that promotion then walks twice.
   */
  async clone(schoolId: string, dto: CloneAcademicStructureInput) {
    if (dto.fromAcademicYearId === dto.toAcademicYearId) {
      throw new BadRequestException("Pick two different academic years");
    }
    await this.assertYear(schoolId, dto.fromAcademicYearId);
    await this.assertYear(schoolId, dto.toAcademicYearId);

    // Read outside the write transaction: nesting a big read inside would hold
    // the transaction open for the whole round-trip.
    const source = await this.prisma.forTenant(schoolId, async (tx) => ({
      levels: await tx.academicLevel.findMany({
        where: { academicYearId: dto.fromAcademicYearId },
        orderBy: { orderIndex: "asc" },
        include: { stages: { orderBy: { orderIndex: "asc" } } },
      }),
      classes: await tx.class.findMany({
        where: { academicYearId: dto.fromAcademicYearId },
        orderBy: { orderIndex: "asc" },
        include: { sections: { orderBy: { name: "asc" } } },
      }),
    }));

    if (source.classes.length === 0 && source.levels.length === 0) {
      throw new BadRequestException("That year has no structure to copy");
    }

    const existing = await this.prisma.forTenant(schoolId, (tx) =>
      tx.class.count({ where: { academicYearId: dto.toAcademicYearId } }),
    );
    if (existing > 0) {
      throw new BadRequestException(
        "The target year already has classes. Clear them first, or pick an empty year.",
      );
    }

    return this.prisma.forTenant(schoolId, async (tx) => {
      const levelIdMap = new Map<string, string>();
      const stageIdMap = new Map<string, string>();

      for (const level of source.levels) {
        const created = await tx.academicLevel.create({
          data: {
            schoolId,
            academicYearId: dto.toAcademicYearId,
            name: level.name,
            orderIndex: level.orderIndex,
            status: level.status,
          },
          select: { id: true },
        });
        levelIdMap.set(level.id, created.id);

        for (const stage of level.stages) {
          const s = await tx.academicStage.create({
            data: {
              schoolId,
              levelId: created.id,
              name: stage.name,
              orderIndex: stage.orderIndex,
              status: stage.status,
            },
            select: { id: true },
          });
          stageIdMap.set(stage.id, s.id);
        }
      }

      let classes = 0;
      let sections = 0;
      for (const cls of source.classes) {
        const created = await tx.class.create({
          data: {
            schoolId,
            academicYearId: dto.toAcademicYearId,
            name: cls.name,
            orderIndex: cls.orderIndex,
            hasSections: cls.hasSections,
            notes: cls.notes,
            status: cls.status,
            shiftId: null, // shifts belong to the year being copied into
            levelId: cls.levelId ? (levelIdMap.get(cls.levelId) ?? null) : null,
            stageId: cls.stageId ? (stageIdMap.get(cls.stageId) ?? null) : null,
          },
          select: { id: true },
        });
        classes++;

        if (dto.includeSections !== false && cls.sections.length > 0) {
          await tx.section.createMany({
            data: cls.sections.map((s) => ({
              schoolId,
              classId: created.id,
              name: s.name,
              status: s.status,
            })),
          });
          sections += cls.sections.length;
        }
      }

      return { levels: levelIdMap.size, stages: stageIdMap.size, classes, sections };
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async assertYear(schoolId: string, academicYearId: string) {
    const year = await this.prisma.forTenant(schoolId, (tx) =>
      tx.academicYear.findFirst({
        where: { id: academicYearId },
        select: { id: true },
      }),
    );
    if (!year) throw new NotFoundException("Academic year not found");
  }

  private async findLevel(schoolId: string, id: string) {
    const level = await this.prisma.forTenant(schoolId, (tx) =>
      tx.academicLevel.findFirst({ where: { id } }),
    );
    if (!level) throw new NotFoundException("Level not found");
    return level;
  }

  private async findStage(schoolId: string, id: string) {
    const stage = await this.prisma.forTenant(schoolId, (tx) =>
      tx.academicStage.findFirst({ where: { id } }),
    );
    if (!stage) throw new NotFoundException("Stage not found");
    return stage;
  }

  private async nextOrderIndex(
    tx: { [k: string]: any },
    model: "academicLevel" | "academicStage",
    where: Record<string, string>,
  ): Promise<number> {
    const last = await tx[model].findFirst({
      where,
      orderBy: { orderIndex: "desc" },
      select: { orderIndex: true },
    });
    return last ? last.orderIndex + 1 : 0;
  }
}
