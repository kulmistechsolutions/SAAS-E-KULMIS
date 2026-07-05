import { Injectable, NotFoundException } from "@nestjs/common";
import type {
  CreateAcademicYearInput,
  UpdateAcademicYearInput,
} from "@ekulmis/shared";
import { PrismaService } from "../prisma/prisma.service";
import { onUniqueViolation } from "./prisma-errors";

@Injectable()
export class AcademicYearService {
  constructor(private readonly prisma: PrismaService) {}

  async create(schoolId: string, dto: CreateAcademicYearInput) {
    return this.prisma
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

  /** Make this the (single) active academic year; others become read-only. */
  async activate(schoolId: string, id: string) {
    await this.findOne(schoolId, id);
    return this.prisma.forTenant(schoolId, async (tx) => {
      await tx.academicYear.updateMany({
        where: { isActive: true, id: { not: id } },
        data: { isActive: false },
      });
      return tx.academicYear.update({
        where: { id },
        data: { isActive: true },
      });
    });
  }

  async remove(schoolId: string, id: string) {
    await this.findOne(schoolId, id);
    await this.prisma.forTenant(schoolId, (tx) =>
      tx.academicYear.delete({ where: { id } }),
    );
    return { success: true };
  }
}
