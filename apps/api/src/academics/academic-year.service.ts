import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import type {
  CreateAcademicYearInput,
  UpdateAcademicYearInput,
} from "@ekulmis/shared";
import { PrismaService } from "../prisma/prisma.service";
import { ClassStructureService } from "./class-structure.service";
import { onUniqueViolation } from "./prisma-errors";

@Injectable()
export class AcademicYearService {
  private readonly logger = new Logger(AcademicYearService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly structure: ClassStructureService,
  ) {}

  async create(schoolId: string, dto: CreateAcademicYearInput) {
    const year = await this.prisma
      .forTenant(schoolId, async (tx) => {
        if (dto.isActive) {
          await tx.academicYear.updateMany({
            where: { isActive: true },
            data: { isActive: false },
          });
        }
        return tx.academicYear.create({
          data: {
            schoolId,
            name: dto.name,
            startDate: dto.startDate,
            endDate: dto.endDate,
            isActive: dto.isActive ?? false,
          },
        });
      })
      .catch(onUniqueViolation("An academic year with this name already exists"));

    // Provision the default 12-grade ladder. This is best-effort: the year is
    // already committed, so a transient repair failure (e.g. a pooler hiccup)
    // must not turn a successful creation into a 500. The grades self-heal on
    // the next repair/structure access.
    try {
      await this.structure.repairAcademicYear(schoolId, year.id);
    } catch (err) {
      this.logger.warn(
        `Academic year ${year.id} created, but default-class provisioning failed and will be retried on next access: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
    return year;
  }

  findAll(schoolId: string) {
    return this.prisma.forTenant(schoolId, (tx) =>
      tx.academicYear.findMany({ orderBy: { name: "desc" } }),
    );
  }

  async findOne(schoolId: string, id: string) {
    const year = await this.prisma.forTenant(schoolId, (tx) =>
      tx.academicYear.findFirst({ where: { id } }),
    );
    if (!year) {
      throw new NotFoundException("Academic year not found");
    }
    return year;
  }

  async update(schoolId: string, id: string, dto: UpdateAcademicYearInput) {
    await this.findOne(schoolId, id);
    return this.prisma
      .forTenant(schoolId, async (tx) => {
        if (dto.isActive) {
          await tx.academicYear.updateMany({
            where: { isActive: true, id: { not: id } },
            data: { isActive: false },
          });
        }
        return tx.academicYear.update({
          where: { id },
          data: {
            name: dto.name,
            startDate: dto.startDate,
            endDate: dto.endDate,
            isActive: dto.isActive,
          },
        });
      })
      .catch(onUniqueViolation("An academic year with this name already exists"));
  }

  async activate(schoolId: string, id: string) {
    await this.findOne(schoolId, id);
    const year = await this.prisma.forTenant(schoolId, async (tx) => {
      await tx.academicYear.updateMany({
        where: { isActive: true, id: { not: id } },
        data: { isActive: false },
      });
      return tx.academicYear.update({
        where: { id },
        data: { isActive: true },
      });
    });
    await this.structure.repairAcademicYear(schoolId, id);
    return year;
  }

  async remove(schoolId: string, id: string) {
    await this.findOne(schoolId, id);
    await this.prisma.forTenant(schoolId, (tx) =>
      tx.academicYear.delete({ where: { id } }),
    );
    return { success: true };
  }
}
