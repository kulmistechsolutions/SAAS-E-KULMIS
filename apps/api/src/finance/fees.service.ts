import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { ChargeMonthInput, PayFeeInput } from "@ekulmis/shared";
import { PrismaService } from "../prisma/prisma.service";

function pad(n: number): string {
  return String(n).padStart(5, "0");
}

@Injectable()
export class FeesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Create monthly charges for all active students in a section (idempotent). */
  async chargeMonth(schoolId: string, dto: ChargeMonthInput) {
    const sectionId = dto.sectionId ?? null;
    return this.prisma.forTenant(schoolId, async (tx) => {
      const cls = await tx.class.findFirst({
        where: { id: dto.classId },
        select: { id: true },
      });
      if (!cls) throw new BadRequestException("Invalid class");

      const students = await tx.student.findMany({
        where: { classId: dto.classId, sectionId, status: "ACTIVE" },
        select: { id: true, monthlyFee: true },
      });

      let charged = 0;
      let skipped = 0;
      for (const s of students) {
        const existing = await tx.feeCharge.findUnique({
          where: {
            schoolId_studentId_year_month: {
              schoolId,
              studentId: s.id,
              year: dto.year,
              month: dto.month,
            },
          },
          select: { id: true },
        });
        if (existing) {
          skipped++;
          continue;
        }
        await tx.feeCharge.create({
          data: {
            schoolId,
            studentId: s.id,
            year: dto.year,
            month: dto.month,
            amount: dto.amount ?? s.monthlyFee,
          },
        });
        charged++;
      }
      return { year: dto.year, month: dto.month, charged, skipped };
    });
  }

  /**
   * Collect a payment. The amount is allocated to the student's outstanding
   * charges oldest-first (carry-forward). For ADVANCE, leftover after clearing
   * dues prepays future months at the student's monthly fee.
   */
  async pay(schoolId: string, dto: PayFeeInput, collectedByUserId: string) {
    return this.prisma.forTenant(schoolId, async (tx) => {
      const student = await tx.student.findFirst({
        where: { id: dto.studentId },
        select: { id: true, monthlyFee: true },
      });
      if (!student) throw new NotFoundException("Student not found");

      const outstanding = await tx.feeCharge.findMany({
        where: { studentId: student.id, status: { not: "PAID" } },
        orderBy: [{ year: "asc" }, { month: "asc" }],
      });

      let remaining = dto.amount;
      for (const charge of outstanding) {
        if (remaining <= 0) break;
        const due = charge.amount - charge.paidAmount;
        const applied = Math.min(due, remaining);
        const paidAmount = charge.paidAmount + applied;
        await tx.feeCharge.update({
          where: { id: charge.id },
          data: {
            paidAmount,
            status: paidAmount >= charge.amount ? "PAID" : "PARTIAL",
          },
        });
        remaining -= applied;
      }

      // Advance: prepay future months with any leftover.
      if (dto.type === "ADVANCE" && remaining > 0 && student.monthlyFee > 0) {
        const last = await tx.feeCharge.findFirst({
          where: { studentId: student.id },
          orderBy: [{ year: "desc" }, { month: "desc" }],
          select: { year: true, month: true },
        });
        let y = last?.year ?? new Date().getUTCFullYear();
        let m = last?.month ?? new Date().getUTCMonth() + 1;
        while (remaining > 0) {
          m += 1;
          if (m > 12) {
            m = 1;
            y += 1;
          }
          const applied = Math.min(student.monthlyFee, remaining);
          await tx.feeCharge.create({
            data: {
              schoolId,
              studentId: student.id,
              year: y,
              month: m,
              amount: student.monthlyFee,
              paidAmount: applied,
              status: applied >= student.monthlyFee ? "PAID" : "PARTIAL",
            },
          });
          remaining -= applied;
        }
      }

      const seq = await tx.counter.upsert({
        where: { schoolId_name: { schoolId, name: "receipt" } },
        create: { schoolId, name: "receipt", value: 1 },
        update: { value: { increment: 1 } },
      });
      const school = await tx.school.findUnique({
        where: { id: schoolId },
        select: { receiptPrefix: true },
      });
      const receiptNumber = `${school?.receiptPrefix ?? "RCP"}${pad(seq.value)}`;

      const payment = await tx.payment.create({
        data: {
          schoolId,
          studentId: student.id,
          receiptNumber,
          type: dto.type,
          amount: dto.amount,
          method: dto.method ?? null,
          note: dto.note ?? null,
          collectedByUserId,
        },
      });

      return { receiptNumber, payment, unallocated: remaining };
    });
  }

  /** Student fee ledger: charges, payments, and total outstanding. */
  async ledger(schoolId: string, studentId: string) {
    return this.prisma.forTenant(schoolId, async (tx) => {
      const student = await tx.student.findFirst({
        where: { id: studentId },
        select: { id: true, code: true, fullName: true, monthlyFee: true },
      });
      if (!student) throw new NotFoundException("Student not found");
      const charges = await tx.feeCharge.findMany({
        where: { studentId },
        orderBy: [{ year: "asc" }, { month: "asc" }],
      });
      const payments = await tx.payment.findMany({
        where: { studentId },
        orderBy: { paidAt: "desc" },
      });
      const outstanding = charges.reduce(
        (sum, c) => sum + (c.amount - c.paidAmount),
        0,
      );
      return { student, charges, payments, outstanding };
    });
  }

  /** Outstanding charges across the school (optionally by class/section). */
  async outstanding(schoolId: string, classId?: string, sectionId?: string) {
    return this.prisma.forTenant(schoolId, (tx) =>
      tx.feeCharge.findMany({
        where: {
          status: { not: "PAID" },
          student: { classId, sectionId },
        },
        include: {
          student: { select: { id: true, code: true, fullName: true } },
        },
        orderBy: [{ year: "asc" }, { month: "asc" }],
      }),
    );
  }
}
