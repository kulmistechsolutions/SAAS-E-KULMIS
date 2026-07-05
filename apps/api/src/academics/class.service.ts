import { Injectable, NotFoundException } from "@nestjs/common";
import type { CreateClassInput, UpdateClassInput } from "@ekulmis/shared";
import { PrismaService } from "../prisma/prisma.service";
import { onUniqueViolation } from "./prisma-errors";

@Injectable()
export class ClassService {
  constructor(private readonly prisma: PrismaService) {}

  async create(schoolId: string, dto: CreateClassInput) {
    const year = await this.prisma.forTenant(schoolId, (tx) =>
      tx.academicYear.findFirst({
        where: { id: dto.academicYearId },
        select: { id: true },
      }),
    );
    if (!year) {
      throw new NotFoundException("Academic year not found");
    }
    return this.prisma
      .forTenant(schoolId, (tx) =>
        tx.class.create({
          data: {
            schoolId,
            academicYearId: dto.academicYearId,
            name: dto.name,
            orderIndex: dto.orderIndex ?? 0,
          },
        }),
      )
      .catch(
        onUniqueViolation("A class with this name already exists in this year"),
      );
  }

  findAll(schoolId: string, academicYearId?: string) {
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
    await this.findOne(schoolId, id);
    return this.prisma
      .forTenant(schoolId, (tx) =>
        tx.class.update({
          where: { id },
          data: { name: dto.name, orderIndex: dto.orderIndex },
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
}
