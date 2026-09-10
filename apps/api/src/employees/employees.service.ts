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
    return this.prisma.forTenant(schoolId, async (tx) => {
      const existing = await tx.employee.findFirst({
        where: { id },
        select: { id: true },
      });
      if (!existing) throw new NotFoundException("Employee not found");

      // The same two rules the teacher side has had, which this side never
      // got. Money already paid to someone who has since left stays in the
      // ledger, or the finance reports stop telling the truth about what was
      // spent. A row with nothing paid against it is not history — it is an
      // unpaid obligation to a person who no longer works here, and leaving it
      // is how a deleted duplicate goes on appearing in payroll beside the
      // real one. NUURUL-YAQIIN's administrator was showing three times.
      const { count: payrollRemoved } = await tx.salary.deleteMany({
        where: { employeeId: id, amountPaid: 0 },
      });

      // What is kept loses its link, not its name: `employeeName` and
      // `position` were denormalised onto the row for exactly this, so it
      // reads as a former member of staff rather than as an id pointing at
      // nobody. A dangling id is indistinguishable from a fault.
      await tx.salary.updateMany({
        where: { employeeId: id },
        data: { employeeId: null },
      });

      await tx.employee.delete({ where: { id } });
      return { success: true, payrollRemoved };
    });
  }
}
