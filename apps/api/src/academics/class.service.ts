import {
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { CreateClassInput, UpdateClassInput } from "@ekulmis/shared";
import { normalizeAcademicName } from "@ekulmis/shared";
import { PrismaService } from "../prisma/prisma.service";
import { ClassStructureService } from "./class-structure.service";
import { onUniqueViolation } from "./prisma-errors";

@Injectable()
export class ClassService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly structure: ClassStructureService,
  ) {}

  async create(schoolId: string, dto: CreateClassInput) {
    const name = normalizeAcademicName(dto.name);
    const year = await this.prisma.forTenant(schoolId, (tx) =>
      tx.academicYear.findFirst({
        where: { id: dto.academicYearId },
        select: { id: true },
      }),
    );
    if (!year) {
      throw new NotFoundException("Academic year not found");
    }

    await this.structure.assertCanCreateClass(schoolId, dto.academicYearId, name);

    return this.prisma
      .forTenant(schoolId, (tx) =>
        tx.class.create({
          data: {
            schoolId,
            academicYearId: dto.academicYearId,
            name,
            orderIndex: dto.orderIndex ?? 0,
            hasSections: dto.hasSections ?? false,
            notes: dto.notes ?? null,
            status: dto.status ?? "ACTIVE",
          },
        }),
      )
      .catch(
        onUniqueViolation("A class with this name already exists in this year"),
      );
  }

  async findAll(schoolId: string, academicYearId?: string) {
    // NOTE: this is a hot read path (loaded on every academics-dependent page).
    // Class provisioning/repair is an explicit operation via
    // POST /classes/structure/repair — it must NOT run on every read, or each
    // GET pays for a heavy write transaction (previously ~12s per call).
    return this.prisma.forTenant(schoolId, (tx) =>
      tx.class.findMany({
        where: academicYearId ? { academicYearId } : {},
        orderBy: [{ orderIndex: "asc" }, { name: "asc" }],
        include: { sections: { orderBy: { name: "asc" } } },
      }),
    );
  }

  async findOne(schoolId: string, id: string) {
    const cls = await this.prisma.forTenant(schoolId, (tx) =>
      tx.class.findFirst({
        where: { id },
        include: { sections: { orderBy: { name: "asc" } } },
      }),
    );
    if (!cls) {
      throw new NotFoundException("Class not found");
    }
    return cls;
  }

  async update(schoolId: string, id: string, dto: UpdateClassInput) {
    const existing = await this.findOne(schoolId, id);
    const name =
      dto.name !== undefined ? normalizeAcademicName(dto.name) : undefined;

    if (name !== undefined) {
      await this.structure.assertCanRenameClass(
        schoolId,
        id,
        existing.academicYearId,
        name,
      );
    }

    return this.prisma
      .forTenant(schoolId, (tx) =>
        tx.class.update({
          where: { id },
          data: {
            name,
            orderIndex: dto.orderIndex,
            hasSections: dto.hasSections,
            notes: dto.notes,
            status: dto.status,
          },
        }),
      )
      .catch(
        onUniqueViolation("A class with this name already exists in this year"),
      );
  }

  async remove(schoolId: string, id: string) {
    await this.findOne(schoolId, id);
    await this.prisma.forTenant(schoolId, (tx) =>
      tx.class.delete({ where: { id } }),
    );
    return { success: true };
  }

  repairStructure(schoolId: string, academicYearId?: string) {
    if (academicYearId) {
      return this.structure.repairAcademicYear(schoolId, academicYearId);
    }
    return this.structure.repairAllYears(schoolId);
  }
}
