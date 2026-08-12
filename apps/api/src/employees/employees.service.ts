import { Injectable, NotFoundException } from "@nestjs/common";
import type { CreateEmployeeInput, UpdateEmployeeInput } from "@ekulmis/shared";
import { PrismaService } from "../prisma/prisma.service";

function pad(n: number): string {
  return String(n).padStart(4, "0");
}

@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Register a non-teaching staff member (guard, cleaner, and similar roles). */
  async create(schoolId: string, dto: CreateEmployeeInput) {
    return this.prisma.forTenant(schoolId, async (tx) => {
      const seq = await tx.counter.upsert({
        where: { schoolId_name: { schoolId, name: "employee" } },
        create: { schoolId, name: "employee", value: 1 },
        update: { value: { increment: 1 } },
      });
      const code = `EMP${pad(seq.value)}`;
      return tx.employee.create({
        data: {
          schoolId,
          code,
          fullName: dto.fullName,
          position: dto.position,
          phone: dto.phone ?? null,
          salary: dto.salary ?? 0,
          status: dto.status ?? "ACTIVE",
          notes: dto.notes ?? null,
        },
      });
    });
  }

  findAll(schoolId: string) {
    return this.prisma.forTenant(schoolId, (tx) =>
      tx.employee.findMany({ orderBy: { fullName: "asc" } }),
    );
  }

  async update(schoolId: string, id: string, dto: UpdateEmployeeInput) {
    const existing = await this.prisma.forTenant(schoolId, (tx) =>
      tx.employee.findFirst({ where: { id }, select: { id: true } }),
    );
    if (!existing) throw new NotFoundException("Employee not found");
    return this.prisma.forTenant(schoolId, (tx) =>
      tx.employee.update({
        where: { id },
        data: {
          fullName: dto.fullName,
          position: dto.position,
          phone: dto.phone,
          salary: dto.salary,
          status: dto.status,
          notes: dto.notes,
        },
      }),
    );
  }

  async remove(schoolId: string, id: string) {
    const existing = await this.prisma.forTenant(schoolId, (tx) =>
      tx.employee.findFirst({ where: { id }, select: { id: true } }),
    );
    if (!existing) throw new NotFoundException("Employee not found");
    await this.prisma.forTenant(schoolId, (tx) =>
      tx.employee.delete({ where: { id } }),
    );
    return { success: true };
  }
}
