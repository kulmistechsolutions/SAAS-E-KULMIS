import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Prisma, UserRole } from "@prisma/client";
import type {
  CreateSalaryInput,
  PaySalaryInput,
  UpdateSalaryInput,
} from "@ekulmis/shared";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";

@Injectable()
export class SalariesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

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

  /**
   * A school's Salary Settings. Partial pay defaults to allowed, so a school
   * that has never opened that page keeps paying the way it does today.
   */
  private async salaryRules(schoolId: string): Promise<{ allowPartialSalary: boolean }> {
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
      select: { salarySettings: true },
    });
    const s = school?.salarySettings as { allowPartialSalary?: boolean } | null;
    return { allowPartialSalary: s?.allowPartialSalary ?? true };
  }

  /** Records one collection against a payroll row's remaining balance. */
  async pay(
    schoolId: string,
    id: string,
    dto: PaySalaryInput,
    collectedByUserId?: string,
  ) {
    // Read outside the write transaction: this opens its own connection, and
    // nesting one inside forTenant is what has timed out on the pooler before.
    const { allowPartialSalary } = await this.salaryRules(schoolId);
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
      // A school that switched partial salary off wants each month settled in
      // one payment, not left half-paid on the books.
      if (!allowPartialSalary && dto.amount < remaining) {
        throw new BadRequestException(
          "Partial salary payments are switched off for this school (Settings → Salary). Pay the full remaining balance.",
        );
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

  /**
   * Reverse a salary payment that was recorded wrong — mirrors
   * FeesService.reversePayment for student fees. The original row is never
   * edited or deleted: it is marked REVERSED and a second, negative
   * SalaryPayment row is created linking back to it, so the ledger proves
   * both the original collection and its undo.
   */
  async reversePayment(
    schoolId: string,
    paymentId: string,
    reason: string,
    actor: { userId: string; username: string; role: UserRole },
  ) {
    const result = await this.prisma.forTenant(schoolId, async (tx) => {
      const original = await tx.salaryPayment.findFirst({
        where: { id: paymentId },
      });
      if (!original) throw new NotFoundException("Payment not found");
      if (original.isReversal) {
        throw new BadRequestException(
          "This is itself a reversal entry — it cannot be reversed again.",
        );
      }
      if (original.status === "REVERSED") {
        throw new ConflictException("This payment has already been reversed.");
      }

      const salary = await tx.salary.findFirst({
        where: { id: original.salaryId },
      });
      if (!salary) throw new NotFoundException("Salary not found");

      const amountPaid = Math.max(0, salary.amountPaid - original.amount);
      await tx.salary.update({
        where: { id: salary.id },
        data: {
          amountPaid,
          status:
            amountPaid <= 0
              ? "PENDING"
              : amountPaid < salary.amount
                ? "PARTIAL"
                : "PAID",
          paidAt: amountPaid <= 0 ? null : salary.paidAt,
        },
      });

      const reversal = await tx.salaryPayment.create({
        data: {
          schoolId,
          salaryId: salary.id,
          employeeName: original.employeeName,
          amount: -original.amount,
          paymentMethod: original.paymentMethod,
          note: `Reversal of a prior payment: ${reason}`,
          collectedByUserId: actor.userId,
          isReversal: true,
          reversalOfPaymentId: original.id,
        },
      });

      await tx.salaryPayment.update({
        where: { id: original.id },
        data: {
          status: "REVERSED",
          reversedAt: new Date(),
          reversedByUserId: actor.userId,
          reversalReason: reason,
        },
      });

      return {
        salaryId: salary.id,
        employeeName: original.employeeName,
        amount: original.amount,
        reversal,
      };
    });

    await this.audit.record({
      schoolId,
      userId: actor.userId,
      username: actor.username,
      role: actor.role,
      module: "finance",
      action: "SALARY_PAYMENT_REVERSED",
      metadata: {
        salaryId: result.salaryId,
        employeeName: result.employeeName,
        amount: result.amount,
        reason,
      },
    });

    return result;
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
