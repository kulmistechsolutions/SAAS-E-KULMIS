import { Injectable, NotFoundException } from "@nestjs/common";
import type { CreateSubjectInput, UpdateSubjectInput } from "@ekulmis/shared";
import { PrismaService } from "../prisma/prisma.service";
import { onUniqueViolation } from "./prisma-errors";

@Injectable()
export class SubjectService {
  constructor(private readonly prisma: PrismaService) {}

  async create(schoolId: string, dto: CreateSubjectInput) {
    return this.prisma
      .forTenant(schoolId, (tx) =>
        tx.subject.create({
          data: { schoolId, name: dto.name, code: dto.code ?? null },
        }),
      )
      .catch(onUniqueViolation("A subject with this name already exists"));
  }

  findAll(schoolId: string) {
    return this.prisma.forTenant(schoolId, (tx) =>
      tx.subject.findMany({ orderBy: { name: "asc" } }),
    );
  }

  async findOne(schoolId: string, id: string) {
    const subject = await this.prisma.forTenant(schoolId, (tx) =>
      tx.subject.findFirst({ where: { id } }),
    );
    if (!subject) {
      throw new NotFoundException("Subject not found");
    }
    return subject;
  }

  async update(schoolId: string, id: string, dto: UpdateSubjectInput) {
    await this.findOne(schoolId, id);
    return this.prisma
      .forTenant(schoolId, (tx) =>
        tx.subject.update({
          where: { id },
          data: { name: dto.name, code: dto.code },
        }),
      )
      .catch(onUniqueViolation("A subject with this name already exists"));
  }

  async remove(schoolId: string, id: string) {
    await this.findOne(schoolId, id);
    await this.prisma.forTenant(schoolId, (tx) =>
      tx.subject.delete({ where: { id } }),
    );
    return { success: true };
  }
}
