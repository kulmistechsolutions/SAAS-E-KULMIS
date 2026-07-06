import { Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type { CreateSalaryInput, UpdateSalaryInput } from "@ekulmis/shared";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class SalariesService {
  constructor(private readonly prisma: PrismaService) {}

  create(schoolId: string, dto: CreateSalaryInput) {
    const status = dto.status ?? "PENDING";
    return this.prisma.forTenant(schoolId, (tx) =>
      tx.salary.create({
        data: {
          schoolId,
          teacherId: dto.teacherId ?? null,
          employeeName: dto.employeeName,
          position: dto.position ?? null,
          amount: dto.amount,
          year: dto.year,
          month: dto.month,
          status,
          paidAt: status === "PAID" ? new Date() : null,
          note: dto.note ?? null,
        },
      }),
    );
  }

  findAll(schoolId: string, year?: number, month?: number) {
    const where: Prisma.SalaryWhereInput = {};
    if (year) where.year = year;
    if (month) where.month = month;
    return this.prisma.forTenant(schoolId, (tx) =>
      tx.salary.findMany({ where, orderBy: { createdAt: "desc" } }),
    );
  }

  async update(schoolId: string, id: string, dto: UpdateSalaryInput) {
    const existing = await this.prisma.forTenant(schoolId, (tx) =>
      tx.salary.findFirst({ where: { id }, select: { id: true, status: true } }),
    );
    if (!existing) throw new NotFoundException("Salary not found");
    const becomingPaid = dto.status === "PAID" && existing.status !== "PAID";
    return this.prisma.forTenant(schoolId, (tx) =>
      tx.salary.update({
        where: { id },
        data: {
          amount: dto.amount,
          status: dto.status,
          note: dto.note,
          ...(becomingPaid ? { paidAt: new Date() } : {}),
        },
      }),
    );
  }

  async remove(schoolId: string, id: string) {
    const existing = await this.prisma.forTenant(schoolId, (tx) =>
      tx.salary.findFirst({ where: { id }, select: { id: true } }),
    );
    if (!existing) throw new NotFoundException("Salary not found");
    await this.prisma.forTenant(schoolId, (tx) =>
      tx.salary.delete({ where: { id } }),
    );
    return { success: true };
  }
}
