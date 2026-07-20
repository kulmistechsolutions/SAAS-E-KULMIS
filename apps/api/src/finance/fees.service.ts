import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  ChargeMonthInput,
  CreateExtraFeeInput,
  PayFeeInput,
  SetupAcademicYearFeesInput,
  StudentFeeStartInput,
  UpdateExtraFeeInput,
} from "@ekulmis/shared";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  buildMonthSlots,
  currentCalendarMonth,
  monthIndexInSequence,
  nextCalendarMonth,
  parseAcademicStartYear,
} from "./fee-billing.util";

function pad(n: number): string {
  return String(n).padStart(5, "0");
}

type SchoolFeeConfig = {
  billingMode: string;
  feeAcademicMonths: number;
  feeBillingStartMonth: number;
  feeBillingEndMonth: number;
  feeAllowPartial: boolean;
  feeAllowAdvance: boolean;
  feeCarryForward: boolean;
};

type StudentFeeProfile = {
  id: string;
  monthlyFee: number;
  feeStartMode: string | null;
  feeAgreementAmount: number | null;
  feeBillingStartYear: number | null;
  feeBillingStartMonth: number | null;
  annualFeeAmount: number | null;
  status: string;
};

type TenantTx = Parameters<Parameters<PrismaService["forTenant"]>[1]>[0];

@Injectable()
export class FeesService {
  constructor(private readonly prisma: PrismaService) {}

  private async schoolConfig(schoolId: string): Promise<SchoolFeeConfig> {
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
      select: {
        billingMode: true,
        feeAcademicMonths: true,
        feeBillingStartMonth: true,
        feeBillingEndMonth: true,
        feeAllowPartial: true,
        feeAllowAdvance: true,
        feeCarryForward: true,
      },
    });
    if (!school) throw new NotFoundException("School not found");
    return school;
  }

  async getSettings(schoolId: string) {
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
      select: {
        billingMode: true,
        feeAcademicMonths: true,
        feeBillingStartMonth: true,
        feeBillingEndMonth: true,
        feeAllowPartial: true,
        feeAllowAdvance: true,
        feeCarryForward: true,
        feeMonthSetupDay: true,
        receiptPrefix: true,
        currency: true,
      },
    });
    if (!school) throw new NotFoundException("School not found");
    return school;
  }

  async chargeMonth(schoolId: string, dto: ChargeMonthInput) {
    const config = await this.schoolConfig(schoolId);
    if (config.billingMode === "ACADEMIC_YEAR") {
      throw new BadRequestException(
        "Monthly setup is disabled while Academic Year billing mode is active",
      );
    }

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
        const existing = await tx.feeCharge.findFirst({
          where: {
            studentId: s.id,
            year: dto.year,
            month: dto.month,
            kind: "MONTHLY",
          },
          select: { id: true },
        });
        if (existing) {
          skipped++;
          continue;
        }
        const amount = dto.amount ?? s.monthlyFee;
        await tx.feeCharge.create({
          data: {
            schoolId,
            studentId: s.id,
            year: dto.year,
            month: dto.month,
            amount,
            // A 0-amount month (fee waived/exempt) is settled by definition —
            // it must never sit in the ledger as UNPAID, which would show a
            // free student as owing money and pull them into outstanding
            // reports and reminder SMS runs.
            status: amount === 0 ? "PAID" : "UNPAID",
          },
        });
        charged++;
      }
      return { year: dto.year, month: dto.month, charged, skipped };
    });
  }

  async setupAcademicYear(schoolId: string, dto: SetupAcademicYearFeesInput) {
    const config = await this.schoolConfig(schoolId);
    if (config.billingMode !== "ACADEMIC_YEAR") {
      throw new BadRequestException(
        "Academic year setup requires Academic Year billing mode in fee settings",
      );
    }

    return this.prisma.forTenant(
      schoolId,
      async (tx) => {
      const year = await tx.academicYear.findFirst({
        where: { id: dto.academicYearId },
        select: { id: true, name: true },
      });
      if (!year) throw new NotFoundException("Academic year not found");

      const existing = await tx.academicYearFeeSetup.findUnique({
        where: {
          schoolId_academicYearId: {
            schoolId,
            academicYearId: dto.academicYearId,
          },
        },
      });
      if (existing) {
        throw new ConflictException(
          "Academic year fees are already activated for this year",
        );
      }

      const months = dto.academicMonths ?? config.feeAcademicMonths;
      const startMonth = dto.billingStartMonth ?? config.feeBillingStartMonth;
      const endMonth = dto.billingEndMonth ?? config.feeBillingEndMonth;
      const monthlyFee = dto.monthlyFee ?? null;
      const totalAnnual = (monthlyFee ?? 0) * months;

      await tx.academicYearFeeSetup.create({
        data: {
          schoolId,
          academicYearId: dto.academicYearId,
          academicMonths: months,
          billingStartMonth: startMonth,
          billingEndMonth: endMonth,
          monthlyFee,
          totalAnnualFee: totalAnnual,
        },
      });

      const students = await tx.student.findMany({
        where: { status: "ACTIVE" },
        select: {
          id: true,
          monthlyFee: true,
          feeStartMode: true,
          feeAgreementAmount: true,
          feeBillingStartYear: true,
          feeBillingStartMonth: true,
          annualFeeAmount: true,
          status: true,
        },
      });

      const charged = await this.createBulkStudentYearCharges(tx, schoolId, {
        students,
        academicYearId: dto.academicYearId,
        academicYearName: year.name,
        config,
        defaultMonthlyFee: monthlyFee,
      });

      return {
        academicYearId: dto.academicYearId,
        academicMonths: months,
        totalAnnualFee: totalAnnual,
        studentsProcessed: students.length,
        chargesCreated: charged,
      };
    },
      { timeout: 180_000, maxWait: 60_000 },
    );
  }

  async initializeStudentFees(
    schoolId: string,
    studentId: string,
    opts?: StudentFeeStartInput,
  ) {
    const config = await this.schoolConfig(schoolId);
    return this.prisma.forTenant(schoolId, async (tx) => {
      const student = await tx.student.findFirst({
        where: { id: studentId },
        select: {
          id: true,
          monthlyFee: true,
          feeStartMode: true,
          feeAgreementAmount: true,
          feeBillingStartYear: true,
          feeBillingStartMonth: true,
          annualFeeAmount: true,
          status: true,
        },
      });
      if (!student) throw new NotFoundException("Student not found");

      if (opts?.feeStartMode) {
        await tx.student.update({
          where: { id: studentId },
          data: {
            feeStartMode: opts.feeStartMode,
            feeAgreementAmount: opts.agreementAmount ?? null,
            feeBillingStartYear: opts.billingStartYear ?? null,
            feeBillingStartMonth: opts.billingStartMonth ?? null,
          },
        });
        Object.assign(student, {
          feeStartMode: opts.feeStartMode,
          feeAgreementAmount: opts.agreementAmount ?? null,
          feeBillingStartYear: opts.billingStartYear ?? null,
          feeBillingStartMonth: opts.billingStartMonth ?? null,
        });
      }

      const activeYear = await tx.academicYear.findFirst({
        where: { isActive: true },
        select: { id: true, name: true },
        orderBy: { createdAt: "desc" },
      });

      if (config.billingMode === "ACADEMIC_YEAR" && activeYear) {
        const setup = await tx.academicYearFeeSetup.findUnique({
          where: {
            schoolId_academicYearId: {
              schoolId,
              academicYearId: activeYear.id,
            },
          },
        });
        if (setup) {
          const created = await this.createStudentYearCharges(tx, schoolId, {
            student,
            academicYearId: activeYear.id,
            academicYearName: activeYear.name,
            config,
            defaultMonthlyFee: setup.monthlyFee,
          });
          return { mode: "ACADEMIC_YEAR", chargesCreated: created };
        }
      }

      if (config.billingMode === "MONTHLY") {
        const created = await this.createMonthlyAdmissionCharge(
          tx,
          schoolId,
          student,
        );
        return { mode: "MONTHLY", chargesCreated: created };
      }

      return { mode: config.billingMode, chargesCreated: 0 };
    });
  }

  private async createMonthlyAdmissionCharge(
    tx: TenantTx,
    schoolId: string,
    student: StudentFeeProfile,
  ): Promise<number> {
    const mode = student.feeStartMode ?? "FULL_CURRENT";
    const now = currentCalendarMonth();

    if (mode === "NEXT_MONTH") {
      const next = nextCalendarMonth(now.year, now.month);
      await tx.student.update({
        where: { id: student.id },
        data: {
          feeBillingStartYear: next.year,
          feeBillingStartMonth: next.month,
        },
      });
      return 0;
    }

    const amount =
      mode === "AGREEMENT"
        ? (student.feeAgreementAmount ?? student.monthlyFee)
        : student.monthlyFee;

    const existing = await tx.feeCharge.findFirst({
      where: {
        studentId: student.id,
        year: now.year,
        month: now.month,
        kind: "MONTHLY",
      },
      select: { id: true },
    });
    if (existing) return 0;

    await tx.feeCharge.create({
      data: {
        schoolId,
        studentId: student.id,
        year: now.year,
        month: now.month,
        amount,
        paidAmount: 0,
        // A 0-amount month (fee waived/exempt) is settled by definition — it
        // must never sit in the ledger as UNPAID.
        status:
          amount === 0
            ? "PAID"
            : mode === "AGREEMENT" && amount < student.monthlyFee
              ? "PARTIAL"
              : "UNPAID",
      },
    });
    return 1;
  }

  private async createStudentYearCharges(
    tx: TenantTx,
    schoolId: string,
    ctx: {
      student: StudentFeeProfile;
      academicYearId: string;
      academicYearName: string;
      config: SchoolFeeConfig;
      defaultMonthlyFee: number | null;
    },
  ): Promise<number> {
    const monthlyFee = ctx.student.monthlyFee || ctx.defaultMonthlyFee || 0;
    const startMonth = ctx.config.feeBillingStartMonth;
    const academicStartYear = parseAcademicStartYear(ctx.academicYearName);
    const slots = buildMonthSlots(
      startMonth,
      ctx.config.feeAcademicMonths,
      academicStartYear,
    );

    const billingStart = this.resolveBillingStart(ctx.student, slots);
    let activeCount = 0;
    let created = 0;

    for (const slot of slots) {
      const isInactive = slot.sequenceIndex < billingStart.sequenceIndex;

      let amount = monthlyFee;
      if (
        !isInactive &&
        slot.sequenceIndex === billingStart.sequenceIndex &&
        ctx.student.feeStartMode === "AGREEMENT"
      ) {
        amount = ctx.student.feeAgreementAmount ?? monthlyFee;
      }

      // A 0-amount month (fee waived/exempt) is settled by definition — it
      // must never sit in the ledger as UNPAID.
      const status: "INACTIVE" | "UNPAID" | "PARTIAL" | "PAID" = isInactive
        ? "INACTIVE"
        : amount === 0
          ? "PAID"
          : amount < monthlyFee
            ? "PARTIAL"
            : "UNPAID";

      if (!isInactive) activeCount++;

      const existing = await tx.feeCharge.findFirst({
        where: {
          studentId: ctx.student.id,
          year: slot.year,
          month: slot.month,
          kind: "MONTHLY",
        },
        select: { id: true },
      });
      if (existing) continue;

      await tx.feeCharge.create({
        data: {
          schoolId,
          studentId: ctx.student.id,
          academicYearId: ctx.academicYearId,
          year: slot.year,
          month: slot.month,
          amount: isInactive ? 0 : amount,
          paidAmount: 0,
          status,
        },
      });
      created++;
    }

    await tx.student.update({
      where: { id: ctx.student.id },
      data: {
        annualFeeAmount: monthlyFee * activeCount,
        feeBillingStartYear: billingStart.year,
        feeBillingStartMonth: billingStart.month,
      },
    });

    return created;
  }

  /** Bulk-create academic year charges for many students in a few DB round-trips. */
  private async createBulkStudentYearCharges(
    tx: TenantTx,
    schoolId: string,
    ctx: {
      students: StudentFeeProfile[];
      academicYearId: string;
      academicYearName: string;
      config: SchoolFeeConfig;
      defaultMonthlyFee: number | null;
    },
  ): Promise<number> {
    if (ctx.students.length === 0) return 0;

    const academicStartYear = parseAcademicStartYear(ctx.academicYearName);
    const slots = buildMonthSlots(
      ctx.config.feeBillingStartMonth,
      ctx.config.feeAcademicMonths,
      academicStartYear,
    );
    const slotYears = [...new Set(slots.map((s) => s.year))];
    const slotMonths = [...new Set(slots.map((s) => s.month))];
    const studentIds = ctx.students.map((s) => s.id);

    const existing = await tx.feeCharge.findMany({
      where: {
        schoolId,
        studentId: { in: studentIds },
        year: { in: slotYears },
        month: { in: slotMonths },
        // An EXTRA charge in a month must not make us think the regular fee
        // for that month already exists.
        kind: "MONTHLY",
      },
      select: { studentId: true, year: true, month: true },
    });
    const existingKeys = new Set(
      existing.map((row) => `${row.studentId}:${row.year}:${row.month}`),
    );

    const toCreate: Prisma.FeeChargeCreateManyInput[] = [];
    const studentUpdates: {
      id: string;
      annualFeeAmount: number;
      feeBillingStartYear: number;
      feeBillingStartMonth: number;
    }[] = [];

    for (const student of ctx.students) {
      const monthlyFee = student.monthlyFee || ctx.defaultMonthlyFee || 0;
      const billingStart = this.resolveBillingStart(student, slots);
      let activeCount = 0;

      for (const slot of slots) {
        const isInactive = slot.sequenceIndex < billingStart.sequenceIndex;

        let amount = monthlyFee;
        if (
          !isInactive &&
          slot.sequenceIndex === billingStart.sequenceIndex &&
          student.feeStartMode === "AGREEMENT"
        ) {
          amount = student.feeAgreementAmount ?? monthlyFee;
        }

        // A 0-amount month (fee waived/exempt) is settled by definition — it
        // must never sit in the ledger as UNPAID.
        const status: "INACTIVE" | "UNPAID" | "PARTIAL" | "PAID" = isInactive
          ? "INACTIVE"
          : amount === 0
            ? "PAID"
            : amount < monthlyFee
              ? "PARTIAL"
              : "UNPAID";

        if (!isInactive) activeCount++;

        const key = `${student.id}:${slot.year}:${slot.month}`;
        if (existingKeys.has(key)) continue;
        existingKeys.add(key);

        toCreate.push({
          schoolId,
          studentId: student.id,
          academicYearId: ctx.academicYearId,
          year: slot.year,
          month: slot.month,
          amount: isInactive ? 0 : amount,
          paidAmount: 0,
          status,
        });
      }

      studentUpdates.push({
        id: student.id,
        annualFeeAmount: monthlyFee * activeCount,
        feeBillingStartYear: billingStart.year,
        feeBillingStartMonth: billingStart.month,
      });
    }

    let created = 0;
    const CREATE_CHUNK = 500;
    for (let i = 0; i < toCreate.length; i += CREATE_CHUNK) {
      const chunk = toCreate.slice(i, i + CREATE_CHUNK);
      const result = await tx.feeCharge.createMany({
        data: chunk,
        skipDuplicates: true,
      });
      created += result.count;
    }

    const UPDATE_CHUNK = 25;
    for (let i = 0; i < studentUpdates.length; i += UPDATE_CHUNK) {
      const chunk = studentUpdates.slice(i, i + UPDATE_CHUNK);
      await Promise.all(
        chunk.map((row) =>
          tx.student.update({
            where: { id: row.id },
            data: {
              annualFeeAmount: row.annualFeeAmount,
              feeBillingStartYear: row.feeBillingStartYear,
              feeBillingStartMonth: row.feeBillingStartMonth,
            },
          }),
        ),
      );
    }

    return created;
  }

  private resolveBillingStart(
    student: StudentFeeProfile,
    slots: ReturnType<typeof buildMonthSlots>,
  ) {
    if (student.feeBillingStartYear && student.feeBillingStartMonth) {
      const idx = monthIndexInSequence(
        slots,
        student.feeBillingStartYear,
        student.feeBillingStartMonth,
      );
      if (idx >= 0) return slots[idx]!;
    }

    const mode = student.feeStartMode ?? "FULL_CURRENT";
    const now = currentCalendarMonth();

    if (mode === "NEXT_MONTH") {
      const next = nextCalendarMonth(now.year, now.month);
      const idx = monthIndexInSequence(slots, next.year, next.month);
      return idx >= 0 ? slots[idx]! : slots[0]!;
    }

    const idx = monthIndexInSequence(slots, now.year, now.month);
    return idx >= 0 ? slots[idx]! : slots[0]!;
  }

  async pay(schoolId: string, dto: PayFeeInput, collectedByUserId: string) {
    const config = await this.schoolConfig(schoolId);

    if (dto.type === "PARTIAL" && !config.feeAllowPartial) {
      throw new BadRequestException("Partial payments are disabled in settings");
    }
    if (dto.type === "ADVANCE" && !config.feeAllowAdvance) {
      throw new BadRequestException("Advance payments are disabled in settings");
    }

    return this.prisma.forTenant(schoolId, async (tx) => {
      const student = await tx.student.findFirst({
        where: { id: dto.studentId, status: "ACTIVE" },
        select: { id: true, monthlyFee: true },
      });
      if (!student) throw new NotFoundException("Student not found");

      const outstanding = await tx.feeCharge.findMany({
        where: {
          studentId: student.id,
          status: { in: ["UNPAID", "PARTIAL"] },
        },
        // A month can now hold both the regular fee and extra charges, so
        // year+month alone is no longer a total order — settle the regular fee
        // first, then extras by age, so allocation is deterministic.
        orderBy: [
          { year: "asc" },
          { month: "asc" },
          { kind: "asc" },
          { createdAt: "asc" },
        ],
      });

      if (dto.type === "ADVANCE" && outstanding.length > 0) {
        throw new BadRequestException(
          "Clear outstanding balances before accepting advance payments",
        );
      }

      let remaining = dto.amount;
      for (const charge of outstanding) {
        if (remaining <= 0) break;
        const due = charge.amount - charge.paidAmount;
        if (due <= 0) continue;
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

      if (dto.type === "ADVANCE" && remaining > 0 && student.monthlyFee > 0) {
        const unpaidFuture = await tx.feeCharge.findMany({
          where: {
            studentId: student.id,
            status: { in: ["UNPAID", "PARTIAL"] },
          },
          orderBy: [
            { year: "asc" },
            { month: "asc" },
            { kind: "asc" },
            { createdAt: "asc" },
          ],
        });
        for (const charge of unpaidFuture) {
          if (remaining <= 0) break;
          const due = charge.amount - charge.paidAmount;
          if (due <= 0) continue;
          const applied = Math.min(due, remaining);
          await tx.feeCharge.update({
            where: { id: charge.id },
            data: {
              paidAmount: charge.paidAmount + applied,
              status:
                charge.paidAmount + applied >= charge.amount
                  ? "PAID"
                  : "PARTIAL",
            },
          });
          remaining -= applied;
        }

        if (remaining > 0) {
          const last = await tx.feeCharge.findFirst({
            where: {
              studentId: student.id,
              status: { not: "INACTIVE" },
              // Advance months continue the regular fee schedule; an extra
              // charge billed into a later month must not shift it forward.
              kind: "MONTHLY",
            },
            orderBy: [{ year: "desc" }, { month: "desc" }],
            select: { year: true, month: true },
          });
          let y = last?.year ?? new Date().getUTCFullYear();
          let m = last?.month ?? new Date().getUTCMonth() + 1;
          while (remaining > 0) {
            const next = nextCalendarMonth(y, m);
            y = next.year;
            m = next.month;
            const dup = await tx.feeCharge.findFirst({
              where: {
                studentId: student.id,
                year: y,
                month: m,
                kind: "MONTHLY",
              },
            });
            if (dup?.status === "PAID") continue;
            if (dup) {
              const due = dup.amount - dup.paidAmount;
              const applied = Math.min(due, remaining);
              await tx.feeCharge.update({
                where: { id: dup.id },
                data: {
                  paidAmount: dup.paidAmount + applied,
                  status:
                    dup.paidAmount + applied >= dup.amount ? "PAID" : "PARTIAL",
                },
              });
              remaining -= applied;
              continue;
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

  async ledger(schoolId: string, studentId: string) {
    const config = await this.schoolConfig(schoolId);
    return this.prisma.forTenant(schoolId, async (tx) => {
      const student = await tx.student.findFirst({
        where: { id: studentId },
        select: {
          id: true,
          code: true,
          fullName: true,
          monthlyFee: true,
          annualFeeAmount: true,
          feeStartMode: true,
        },
      });
      if (!student) throw new NotFoundException("Student not found");
      const charges = await tx.feeCharge.findMany({
        where: { studentId },
        orderBy: [
          { year: "asc" },
          { month: "asc" },
          { kind: "asc" },
          { createdAt: "asc" },
        ],
      });
      const payments = await tx.payment.findMany({
        where: { studentId },
        orderBy: { paidAt: "desc" },
      });

      const billable = charges.filter((c) => c.status !== "INACTIVE");
      const totalDue = billable.reduce((s, c) => s + c.amount, 0);
      const totalPaid = billable.reduce((s, c) => s + c.paidAmount, 0);
      const outstanding = billable.reduce(
        (s, c) => s + Math.max(0, c.amount - c.paidAmount),
        0,
      );

      // Month counts describe the regular fee schedule, so they only count
      // MONTHLY rows — an exam fee is not "a month" and would otherwise
      // inflate totalMonths and skew the progress bar.
      const billableMonthly = billable.filter((c) => c.kind === "MONTHLY");
      const paidMonths = billableMonthly.filter((c) => c.status === "PAID").length;
      const unpaidMonths = billableMonthly.filter(
        (c) => c.status === "UNPAID" || c.status === "PARTIAL",
      ).length;
      const inactiveMonths = charges.filter((c) => c.status === "INACTIVE").length;

      const extras = billable.filter((c) => c.kind === "EXTRA");
      const extraTotal = extras.reduce((s, c) => s + c.amount, 0);
      const monthlyTotal = billableMonthly.reduce((s, c) => s + c.amount, 0);

      return {
        student,
        charges,
        payments,
        outstanding,
        summary: {
          billingMode: config.billingMode,
          monthlyFee: student.monthlyFee,
          // annualFeeAmount only covers the monthly schedule, so extras are
          // added on top — otherwise the headline total under-reports what the
          // student actually owes.
          totalAcademicFee:
            (student.annualFeeAmount ?? monthlyTotal) + extraTotal,
          extraFeesTotal: extraTotal,
          amountPaid: totalPaid,
          outstandingBalance: outstanding,
          paidMonths,
          unpaidMonths,
          inactiveMonths,
          totalMonths: billableMonthly.length,
          progressPercent:
            billableMonthly.length > 0
              ? Math.round((paidMonths / billableMonthly.length) * 1000) / 10
              : 0,
        },
      };
    });
  }

  async outstanding(schoolId: string, classId?: string, sectionId?: string) {
    return this.prisma.forTenant(schoolId, (tx) =>
      tx.feeCharge.findMany({
        where: {
          status: { in: ["UNPAID", "PARTIAL"] },
          student: { classId, sectionId, status: "ACTIVE" },
        },
        include: {
          student: { select: { id: true, code: true, fullName: true } },
        },
        orderBy: [{ year: "asc" }, { month: "asc" }],
      }),
    );
  }

  listPayments(schoolId: string, limit = 100) {
    return this.prisma.forTenant(schoolId, (tx) =>
      tx.payment.findMany({
        orderBy: { paidAt: "desc" },
        take: limit,
        include: {
          student: {
            select: {
              code: true,
              fullName: true,
              class: { select: { name: true } },
            },
          },
        },
      }),
    );
  }

  listCharges(schoolId: string, year?: number, month?: number) {
    return this.prisma.forTenant(schoolId, (tx) =>
      tx.feeCharge.findMany({
        where: {
          ...(year ? { year } : {}),
          ...(month ? { month } : {}),
        },
        include: {
          student: {
            select: {
              code: true,
              fullName: true,
              class: { select: { name: true } },
              section: { select: { name: true } },
            },
          },
        },
        orderBy: [{ year: "desc" }, { month: "desc" }],
      }),
    );
  }

  // ── Extra fees ───────────────────────────────────────────────────────────

  /** Extra fee setups with their class prices and how much has been applied. */
  async listExtraFees(schoolId: string) {
    return this.prisma.forTenant(schoolId, async (tx) => {
      const fees = await tx.extraFee.findMany({
        include: {
          classAmounts: {
            include: { class: { select: { id: true, name: true } } },
          },
        },
        orderBy: [{ year: "desc" }, { month: "desc" }, { createdAt: "desc" }],
      });

      // One grouped query rather than a count per fee.
      const grouped = await tx.feeCharge.groupBy({
        by: ["extraFeeId"],
        where: { kind: "EXTRA", extraFeeId: { not: null } },
        _count: { _all: true },
        _sum: { amount: true, paidAmount: true },
      });
      const stats = new Map(grouped.map((g) => [g.extraFeeId, g]));

      return fees.map((f) => {
        const s = stats.get(f.id);
        return {
          ...f,
          appliedCount: s?._count._all ?? 0,
          appliedTotal: s?._sum.amount ?? 0,
          collectedTotal: s?._sum.paidAmount ?? 0,
        };
      });
    });
  }

  private async assertClassesExist(
    tx: TenantTx,
    classIds: string[],
  ): Promise<void> {
    if (classIds.length === 0) return;
    const found = await tx.class.findMany({
      where: { id: { in: classIds } },
      select: { id: true },
    });
    if (found.length !== new Set(classIds).size) {
      throw new BadRequestException("One or more selected classes are invalid");
    }
  }

  async createExtraFee(
    schoolId: string,
    dto: CreateExtraFeeInput,
    userId?: string,
  ) {
    return this.prisma.forTenant(schoolId, async (tx) => {
      const classAmounts = dto.appliesToAllClasses ? [] : dto.classAmounts;
      await this.assertClassesExist(
        tx,
        classAmounts.map((c) => c.classId),
      );
      const activeYear = await tx.academicYear.findFirst({
        where: { isActive: true },
        select: { id: true },
      });

      return tx.extraFee.create({
        data: {
          schoolId,
          academicYearId: activeYear?.id ?? null,
          name: dto.name,
          description: dto.description ?? null,
          year: dto.year,
          month: dto.month,
          appliesToAllClasses: dto.appliesToAllClasses,
          defaultAmount: dto.appliesToAllClasses
            ? (dto.defaultAmount ?? 0)
            : null,
          createdByUserId: userId ?? null,
          classAmounts: {
            create: classAmounts.map((c) => ({
              schoolId,
              classId: c.classId,
              amount: c.amount,
            })),
          },
        },
        include: {
          classAmounts: {
            include: { class: { select: { id: true, name: true } } },
          },
        },
      });
    });
  }

  async updateExtraFee(
    schoolId: string,
    id: string,
    dto: UpdateExtraFeeInput,
  ) {
    return this.prisma.forTenant(schoolId, async (tx) => {
      const existing = await tx.extraFee.findFirst({
        where: { id },
        select: { id: true, appliedAt: true },
      });
      if (!existing) throw new NotFoundException("Extra fee not found");
      // Editing after it has been billed would silently disagree with the
      // charges already sitting on students' accounts.
      if (existing.appliedAt) {
        throw new BadRequestException(
          "This extra fee has already been applied to students. Delete it and create a new one instead.",
        );
      }

      const classAmounts = dto.appliesToAllClasses ? [] : dto.classAmounts;
      await this.assertClassesExist(
        tx,
        classAmounts.map((c) => c.classId),
      );

      await tx.extraFeeClassAmount.deleteMany({ where: { extraFeeId: id } });
      return tx.extraFee.update({
        where: { id },
        data: {
          name: dto.name,
          description: dto.description ?? null,
          year: dto.year,
          month: dto.month,
          appliesToAllClasses: dto.appliesToAllClasses,
          defaultAmount: dto.appliesToAllClasses
            ? (dto.defaultAmount ?? 0)
            : null,
          classAmounts: {
            create: classAmounts.map((c) => ({
              schoolId,
              classId: c.classId,
              amount: c.amount,
            })),
          },
        },
        include: {
          classAmounts: {
            include: { class: { select: { id: true, name: true } } },
          },
        },
      });
    });
  }

  async deleteExtraFee(schoolId: string, id: string) {
    return this.prisma.forTenant(schoolId, async (tx) => {
      const existing = await tx.extraFee.findFirst({
        where: { id },
        select: { id: true },
      });
      if (!existing) throw new NotFoundException("Extra fee not found");

      // Money already collected against it must not silently disappear.
      const paid = await tx.feeCharge.aggregate({
        where: { extraFeeId: id, kind: "EXTRA" },
        _sum: { paidAmount: true },
      });
      if ((paid._sum.paidAmount ?? 0) > 0) {
        throw new BadRequestException(
          "Payments have already been collected against this extra fee, so it cannot be deleted.",
        );
      }

      await tx.feeCharge.deleteMany({ where: { extraFeeId: id, kind: "EXTRA" } });
      await tx.extraFee.delete({ where: { id } });
      return { ok: true };
    });
  }

  /** Which students an extra fee would hit, and for how much — without billing. */
  async previewExtraFee(schoolId: string, id: string) {
    return this.prisma.forTenant(schoolId, (tx) =>
      this.resolveExtraFeeTargets(tx, id),
    );
  }

  private async resolveExtraFeeTargets(tx: TenantTx, id: string) {
    const fee = await tx.extraFee.findFirst({
      where: { id },
      include: { classAmounts: true },
    });
    if (!fee) throw new NotFoundException("Extra fee not found");

    const amountByClass = new Map(
      fee.classAmounts.map((c) => [c.classId, c.amount]),
    );
    const students = await tx.student.findMany({
      where: {
        status: "ACTIVE",
        ...(fee.appliesToAllClasses
          ? {}
          : { classId: { in: [...amountByClass.keys()] } }),
      },
      select: {
        id: true,
        code: true,
        fullName: true,
        classId: true,
        class: { select: { name: true } },
      },
      orderBy: { fullName: "asc" },
    });

    const already = await tx.feeCharge.findMany({
      where: { extraFeeId: id, kind: "EXTRA" },
      select: { studentId: true },
    });
    const alreadyCharged = new Set(already.map((a) => a.studentId));

    const targets = students.map((s) => ({
      studentId: s.id,
      code: s.code,
      fullName: s.fullName,
      className: s.class.name,
      amount: fee.appliesToAllClasses
        ? (fee.defaultAmount ?? 0)
        : (amountByClass.get(s.classId) ?? 0),
      alreadyCharged: alreadyCharged.has(s.id),
    }));

    const pending = targets.filter((t) => !t.alreadyCharged);
    return {
      fee,
      targets,
      studentCount: targets.length,
      pendingCount: pending.length,
      totalAmount: pending.reduce((s, t) => s + t.amount, 0),
    };
  }

  /**
   * Bill the extra fee onto every matching active student as an EXTRA charge
   * in its month. Safe to run twice: students already charged are skipped, so
   * a retry after a partial failure tops up the rest instead of double-billing.
   */
  async applyExtraFee(schoolId: string, id: string) {
    return this.prisma.forTenant(
      schoolId,
      async (tx) => {
        const { fee, targets } = await this.resolveExtraFeeTargets(tx, id);
        const pending = targets.filter((t) => !t.alreadyCharged && t.amount > 0);

        if (pending.length > 0) {
          await tx.feeCharge.createMany({
            data: pending.map((t) => ({
              schoolId,
              studentId: t.studentId,
              academicYearId: fee.academicYearId,
              year: fee.year,
              month: fee.month,
              amount: t.amount,
              paidAmount: 0,
              status: "UNPAID" as const,
              kind: "EXTRA" as const,
              label: fee.name,
              extraFeeId: fee.id,
            })),
          });
        }

        await tx.extraFee.update({
          where: { id },
          data: { appliedAt: fee.appliedAt ?? new Date() },
        });

        return {
          applied: pending.length,
          skipped: targets.length - pending.length,
          totalAmount: pending.reduce((s, t) => s + t.amount, 0),
        };
      },
      { timeout: 120_000, maxWait: 30_000 },
    );
  }
}
