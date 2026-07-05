import { Injectable, NotFoundException } from "@nestjs/common";
import type { CreateSectionInput, UpdateSectionInput } from "@ekulmis/shared";
import { PrismaService } from "../prisma/prisma.service";
import { onUniqueViolation } from "./prisma-errors";

@Injectable()
export class SectionService {
  constructor(private readonly prisma: PrismaService) {}

  async create(schoolId: string, dto: CreateSectionInput) {
    const cls = await this.prisma.forTenant(schoolId, (tx) =>
      tx.class.findFirst({ where: { id: dto.classId }, select: { id: true } }),
    );
    if (!cls) {
      throw new NotFoundException("Class not found");
    }
    return this.prisma
      .forTenant(schoolId, (tx) =>
        tx.section.create({
          data: { schoolId, classId: dto.classId, name: dto.name },
        }),
      )
      .catch(
        onUniqueViolation("A section with this name already exists in this class"),
      );
  }

  findAll(schoolId: string, classId?: string) {
    return this.prisma.forTenant(schoolId, (tx) =>
      tx.section.findMany({
        where: classId ? { classId } : {},
        orderBy: { name: "asc" },
      }),
    );
  }

  async findOne(schoolId: string, id: string) {
    const section = await this.prisma.forTenant(schoolId, (tx) =>
      tx.section.findFirst({ where: { id } }),
    );
    if (!section) {
      throw new NotFoundException("Section not found");
    }
    return section;
  }

  async update(schoolId: string, id: string, dto: UpdateSectionInput) {
    await this.findOne(schoolId, id);
    return this.prisma
      .forTenant(schoolId, (tx) =>
        tx.section.update({ where: { id }, data: { name: dto.name } }),
      )
      .catch(
        onUniqueViolation("A section with this name already exists in this class"),
      );
  }

  async remove(schoolId: string, id: string) {
    await this.findOne(schoolId, id);
    await this.prisma.forTenant(schoolId, (tx) =>
      tx.section.delete({ where: { id } }),
    );
    return { success: true };
  }
}
