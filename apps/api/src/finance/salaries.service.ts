import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type {
  CreateSalaryInput,
  PaySalaryInput,
  UpdateSalaryInput,
} from "@ekulmis/shared";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class SalariesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Idempotent by design — Generate Payroll calls this once per active
   * person, and must be safe to run again (a retry, two admins, a slow
   * network causing a resubmit) without creating a second row for the same
   * person+month. A DB-level unique constraint backs this up (see schema),
   * but checking first avoids the request just 500ing on that constraint.
   */
  async create(schoolId: string, dto: CreateSalaryInput) {
    const existing = await this.prisma.forTenant(schoolId, (tx) =>
      tx.salary.findFirst({
        where: dto.teacherId
          ? { teacherId: dto.teacherId, year: dto.year, month: dto.month }
          : { employeeId: dto.employeeId ?? undefined, year: dto.year, month: dto.month },
      }),
    );
    if (existing) return existing;

    const status = dto.status ?? "PENDING";
    return this.prisma.forTenant(schoolId, (tx) =>
      tx.salary.create({
        data: {
          schoolId,
          teacherId: dto.teacherId ?? null,
          employeeId: dto.employeeId ?? null,
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

  /** Records one collection against a payroll row's remaining balance. */
  async pay(
    schoolId: string,
    id: string,
    dto: PaySalaryInput,
    collectedByUserId?: string,
  ) {
    return this.prisma.forTenant(schoolId, async (tx) => {
      const salary = await tx.salary.findFirst({ where: { id } });
      if (!salary) throw new NotFoundException("Salary not found");
      if (salary.status === "PAID") {
        throw new BadRequestException("This payroll month is already fully paid.");
      }
      const remaining = salary.amount - salary.amountPaid;
      if (dto.amount > remaining) {
        throw new BadRequestException("Payment cannot exceed the remaining balance.");
      }

      const amountPaid = salary.amountPaid + dto.amount;
      const status = amountPaid >= salary.amount ? "PAID" : "PARTIAL";
      const updated = await tx.salary.update({
        where: { id },
        data: {
          amountPaid,
          status,
          paidAt: status === "PAID" ? new Date() : salary.paidAt,
        },
      });
      const payment = await tx.salaryPayment.create({
        data: {
          schoolId,
          salaryId: id,
          employeeName: salary.employeeName,
          amount: dto.amount,
          paymentMethod: dto.paymentMethod ?? null,
          note: dto.note ?? null,
          collectedByUserId: collectedByUserId ?? null,
        },
      });
      return { salary: updated, payment };
    });
  }

  paymentsFor(schoolId: string, salaryId: string) {
    return this.prisma.forTenant(schoolId, (tx) =>
      tx.salaryPayment.findMany({
        where: { salaryId },
        orderBy: { paidAt: "desc" },
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
