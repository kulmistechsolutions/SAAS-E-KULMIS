import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  ChargeMonthInput,
  CreateExtraFeeInput,
  CreatePaymentPromiseInput,
  PayFamilyInput,
  PayFeeInput,
  SetupAcademicYearFeesInput,
  SetupMonthInput,
  StudentFeeStartInput,
  UpdateExtraFeeInput,
  UpdatePaymentPromiseInput,
} from "@ekulmis/shared";
import type { PaymentType, Prisma, UserRole } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { parseDateFrom, parseDateTo } from "../common/date-range.util";
import { AuditService } from "../audit/audit.service";
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

/**
 * A student registered mid-year can be told their fee starts next month. That
 * choice is stored as feeBillingStartYear/Month, and until it arrives the
 * school does not want them billed — so the monthly run has to leave them out,
 * not charge them and leave the school to reverse it.
 *
 * Students with no start recorded are billed as before.
 */
function notYetBillable(
  student: { feeBillingStartYear: number | null; feeBillingStartMonth: number | null },
  year: number,
  month: number,
): boolean {
  const { feeBillingStartYear: y, feeBillingStartMonth: m } = student;
  if (!y || !m) return false;
  return year * 100 + month < y * 100 + m;
}

@Injectable()
export class FeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

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
    // The "activate after the Nth" gate below is enforced client-side against
    // whatever clock the device reports — a school laptop with its date wrong
    // (common, and invisible to the person using it) then blocks or unlocks
    // setup on the wrong day with no way to tell why. Handing back the
    // server's own clock lets the page correct for that gap.
    return { ...school, serverNow: new Date().toISOString() };
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

      // Running the setup for a class-month turns billing on for it: future
      // registrations into this class will now be charged for this month.
      await tx.monthlyFeeActivation.upsert({
        where: {
          schoolId_year_month_classId: {
            schoolId,
            year: dto.year,
            month: dto.month,
            classId: dto.classId,
          },
        },
        create: {
          schoolId,
          year: dto.year,
          month: dto.month,
          classId: dto.classId,
        },
        update: {},
      });

      const students = await tx.student.findMany({
        where: {
          classId: dto.classId,
          sectionId,
          status: "ACTIVE",
          feeWaived: false,
        },
        select: {
          id: true,
          monthlyFee: true,
          feeBillingStartYear: true,
          feeBillingStartMonth: true,
        },
      });

      let charged = 0;
      let skipped = 0;
      for (const s of students) {
        if (notYetBillable(s, dto.year, dto.month)) {
          skipped++;
          continue;
        }
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

  /**
   * Monthly fee setup for a whole month at once. The school chooses either
   * every class or a specific set, and this turns billing on for each and
   * charges the students already enrolled. This is the deliberate act that
   * starts monthly billing — nothing bills before it.
   */
  async setupMonth(schoolId: string, dto: SetupMonthInput) {
    const config = await this.schoolConfig(schoolId);
    if (config.billingMode === "ACADEMIC_YEAR") {
      throw new BadRequestException(
        "Monthly setup is disabled while Academic Year billing mode is active",
      );
    }

    return this.prisma.forTenant(
      schoolId,
      async (tx) => {
        // "all" means every class in the *current* school year; otherwise
        // exactly the ones picked. Unknown ids are ignored rather than
        // failing the whole run. Without the academicYear/levelId scoping,
        // "all" pulled in every past year's classes too — a school on its
        // second year of Grade 1-12 would activate billing for last year's
        // graduated classes right alongside this year's.
        let classes;
        if (dto.scope === "all") {
          const school = await tx.school.findFirst({
            where: { id: schoolId },
            select: { customStructureEnabled: true },
          });
          classes = await tx.class.findMany({
            where: {
              status: "ACTIVE",
              academicYear: { isActive: true },
              ...(!school?.customStructureEnabled && { levelId: null }),
            },
            select: { id: true, name: true },
          });
        } else {
          classes = await tx.class.findMany({
            where: { id: { in: dto.classIds ?? [] } },
            select: { id: true, name: true },
          });
        }
        if (classes.length === 0) {
          throw new BadRequestException("No classes selected");
        }

        let charged = 0;
        let skipped = 0;
        for (const cls of classes) {
          await tx.monthlyFeeActivation.upsert({
            where: {
              schoolId_year_month_classId: {
                schoolId,
                year: dto.year,
                month: dto.month,
                classId: cls.id,
              },
            },
            create: {
              schoolId,
              year: dto.year,
              month: dto.month,
              classId: cls.id,
            },
            update: {},
          });

          const students = await tx.student.findMany({
            where: { classId: cls.id, status: "ACTIVE", feeWaived: false },
            select: {
              id: true,
              monthlyFee: true,
              feeBillingStartYear: true,
              feeBillingStartMonth: true,
            },
          });
          for (const s of students) {
            if (notYetBillable(s, dto.year, dto.month)) {
              skipped++;
              continue;
            }
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
                status: amount === 0 ? "PAID" : "UNPAID",
              },
            });
            charged++;
          }
        }
        return {
          year: dto.year,
          month: dto.month,
          classesActivated: classes.length,
          charged,
          skipped,
        };
      },
      { timeout: 180_000, maxWait: 60_000 },
    );
  }

  /**
   * What the school has set up for a given month: which classes are activated
   * and which are not yet. Drives the setup screen so the school sees at a
   * glance what still needs turning on.
   */
  async monthSetupStatus(schoolId: string, year: number, month: number) {
    return this.prisma.forTenant(schoolId, async (tx) => {
      const school = await tx.school.findFirst({
        where: { id: schoolId },
        select: { customStructureEnabled: true },
      });
      const [classes, activations] = await Promise.all([
        tx.class.findMany({
          where: {
            status: "ACTIVE",
            // A month's billing belongs to one academic year — without this,
            // every past year's classes piled in here too (a school with two
            // years of Grade 1-12 saw "Grade 11" and "Grade 12" listed
            // twice, one per year, with no way to tell them apart).
            academicYear: { isActive: true },
            // Once the school has turned Academic Structure off, a class
            // still carrying a levelId from when it was on shouldn't offer
            // billing setup either — same "off means off" rule as every
            // other class picker.
            ...(!school?.customStructureEnabled && { levelId: null }),
          },
          select: {
            id: true,
            name: true,
            academicYear: { select: { name: true } },
            _count: { select: { students: { where: { status: "ACTIVE" } } } },
          },
          orderBy: [{ orderIndex: "asc" }, { name: "asc" }],
        }),
        tx.monthlyFeeActivation.findMany({
          where: { year, month },
          select: { classId: true },
        }),
      ]);
      const activeSet = new Set(activations.map((a) => a.classId));
      return {
        year,
        month,
        classes: classes.map((c) => ({
          id: c.id,
          name: c.name,
          academicYear: c.academicYear.name,
          activeStudents: c._count.students,
          activated: activeSet.has(c.id),
        })),
      };
    });
  }

  /**
   * Every distinct (year, month) with at least one MonthlyFeeActivation row —
   * i.e. a real "Setup This/Next Month" run, not a month that merely has a
   * FeeCharge sitting in it (a registration fee posts to today's real
   * calendar month regardless of setup state, and an advance payment can
   * create genuine MONTHLY charges for a future month nobody activated yet).
   */
  async activatedMonths(
    schoolId: string,
  ): Promise<{ year: number; month: number }[]> {
    return this.prisma.forTenant(schoolId, async (tx) => {
      const rows = await tx.monthlyFeeActivation.findMany({
        distinct: ["year", "month"],
        select: { year: true, month: true },
        orderBy: [{ year: "asc" }, { month: "asc" }],
      });
      return rows;
    });
  }

  /**
   * Whether this school has ever set up billing at all — a monthly activation
   * or an academic-year setup. Payments are blocked until it has (see pay()).
   */
  private async hasAnyFeeSetup(tx: TenantTx): Promise<boolean> {
    const [monthly, yearly] = await Promise.all([
      tx.monthlyFeeActivation.count(),
      tx.academicYearFeeSetup.count(),
    ]);
    return monthly > 0 || yearly > 0;
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
          where: { status: "ACTIVE", feeWaived: false },
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
      const studentRow = await tx.student.findFirst({
        where: { id: studentId },
        select: {
          id: true,
          classId: true,
          monthlyFee: true,
          feeStartMode: true,
          feeAgreementAmount: true,
          feeBillingStartYear: true,
          feeBillingStartMonth: true,
          annualFeeAmount: true,
          feeWaived: true,
          status: true,
        },
      });
      if (!studentRow) throw new NotFoundException("Student not found");
      const { classId, ...student } = studentRow;

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

        // Telling the system a student's fee starts later must also undo the
        // months already billed before that date. Month setup skips a student
        // whose start is still ahead, but a school that runs the setup first
        // and sets the start date afterwards — the ordinary way round when
        // enrolling a new intake — left those charges standing, and the family
        // saw months they had been excused sitting there as debt. BARWAAQO hit
        // this with 149 students in one afternoon.
        //
        // Only unsettled months move, and they are marked INACTIVE rather than
        // deleted: the row stays as the record that it was raised and voided.
        if (opts.billingStartYear && opts.billingStartMonth) {
          const start = opts.billingStartYear * 100 + opts.billingStartMonth;
          const early = await tx.feeCharge.findMany({
            where: {
              studentId,
              kind: "MONTHLY",
              status: { in: ["UNPAID", "PARTIAL"] },
            },
            select: { id: true, year: true, month: true },
          });
          const voidable = early
            .filter((c) => c.year * 100 + c.month < start)
            .map((c) => c.id);
          if (voidable.length > 0) {
            await tx.feeCharge.updateMany({
              where: { id: { in: voidable } },
              data: { status: "INACTIVE" },
            });
          }
        }
      }

      // The registration fee is a separate, one-time item — independent of
      // billing mode and of whether tuition itself is waived below.
      let registrationFeeCharged = 0;
      if (opts?.chargeRegistrationFee) {
        registrationFeeCharged = await this.chargeRegistrationFeeOnce(
          tx,
          schoolId,
          studentId,
        );
      }

      // A permanently-waived student gets no tuition charge, in any billing
      // mode — that's the whole point of the flag. The registration fee
      // above still applies if asked for; it isn't tuition.
      if (student.feeWaived) {
        return {
          mode: config.billingMode,
          chargesCreated: registrationFeeCharged,
        };
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
          return {
            mode: "ACADEMIC_YEAR",
            chargesCreated: created + registrationFeeCharged,
          };
        }
      }

      if (config.billingMode === "MONTHLY") {
        const created = await this.createMonthlyAdmissionCharge(
          tx,
          schoolId,
          student,
          classId,
        );
        return {
          mode: "MONTHLY",
          chargesCreated: created + registrationFeeCharged,
        };
      }

      return { mode: config.billingMode, chargesCreated: registrationFeeCharged };
    });
  }

  /**
   * Charge the school's one-time registration fee, if it has one configured
   * and this student hasn't already been charged it. Idempotent — safe to
   * call more than once for the same student (e.g. a retried registration).
   */
  private async chargeRegistrationFeeOnce(
    tx: TenantTx,
    schoolId: string,
    studentId: string,
  ): Promise<number> {
    const school = await tx.school.findFirst({
      where: { id: schoolId },
      select: { registrationFeeAmount: true },
    });
    if (!school || school.registrationFeeAmount <= 0) return 0;

    const existing = await tx.feeCharge.findFirst({
      where: { studentId, kind: "REGISTRATION" },
      select: { id: true },
    });
    if (existing) return 0;

    const now = currentCalendarMonth();
    await tx.feeCharge.create({
      data: {
        schoolId,
        studentId,
        year: now.year,
        month: now.month,
        amount: school.registrationFeeAmount,
        kind: "REGISTRATION",
        label: "Registration Fee",
        status: "UNPAID",
      },
    });
    return 1;
  }

  private async createMonthlyAdmissionCharge(
    tx: TenantTx,
    schoolId: string,
    student: StudentFeeProfile,
    classId: string,
  ): Promise<number> {
    const mode = student.feeStartMode ?? "FULL_CURRENT";
    const now = currentCalendarMonth();

    // Billing never starts on its own. Unless the school has activated this
    // class for this month (via the monthly fee setup), a newly registered
    // student gets no charge at all — not even a scheduled one.
    const activated = await tx.monthlyFeeActivation.findUnique({
      where: {
        schoolId_year_month_classId: {
          schoolId,
          year: now.year,
          month: now.month,
          classId,
        },
      },
      select: { id: true },
    });

    // Schools set the next month up before it arrives — the setup day defaults
    // to the 25th. A student enrolling in those last days was checked against
    // the current month only, so they joined a class whose next month was
    // already billed and were the one child in it with no charge for that
    // month. Nothing re-ran afterwards to notice.
    const next = nextCalendarMonth(now.year, now.month);
    const nextActivated = await tx.monthlyFeeActivation.findUnique({
      where: {
        schoolId_year_month_classId: {
          schoolId,
          year: next.year,
          month: next.month,
          classId,
        },
      },
      select: { id: true },
    });

    if (!activated && !nextActivated) return 0;

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
    // A 0-amount month (fee waived/exempt) is settled by definition — it must
    // never sit in the ledger as UNPAID.
    const status =
      amount === 0
        ? "PAID"
        : mode === "AGREEMENT" && amount < student.monthlyFee
          ? "PARTIAL"
          : "UNPAID";

    let created = 0;
    const months = [
      ...(activated ? [now] : []),
      ...(nextActivated ? [next] : []),
    ];
    for (const slot of months) {
      const existing = await tx.feeCharge.findFirst({
        where: {
          studentId: student.id,
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
          studentId: student.id,
          year: slot.year,
          month: slot.month,
          amount,
          paidAmount: 0,
          status,
        },
      });
      created++;
    }
    return created;
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
      throw new BadRequestException(
        "Partial payments are disabled in settings",
      );
    }
    if (dto.type === "ADVANCE" && !config.feeAllowAdvance) {
      throw new BadRequestException(
        "Advance payments are disabled in settings",
      );
    }

    return this.prisma.forTenant(schoolId, async (tx) => {
      // No money can be collected until the school has actually set up billing.
      // A school with no setup is told to do it first, even if old charges
      // happen to exist.
      if (!(await this.hasAnyFeeSetup(tx))) {
        throw new BadRequestException(
          "Fee setup required — set up billing (Settings → Fees) before collecting any payment.",
        );
      }

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

      // Recorded alongside the payment so a later reversal knows exactly
      // which charges this money went to, instead of guessing from the total.
      // year/month travel with each allocation so the receipt can say which
      // months this payment actually covered — previously nothing recorded
      // that, so every receipt printed "Month(s): —" regardless of type.
      const allocations: { feeChargeId: string; amount: number; year: number; month: number }[] = [];

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
        allocations.push({ feeChargeId: charge.id, amount: applied, year: charge.year, month: charge.month });
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
          allocations.push({ feeChargeId: charge.id, amount: applied, year: charge.year, month: charge.month });
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
              allocations.push({ feeChargeId: dup.id, amount: applied, year: dup.year, month: dup.month });
              remaining -= applied;
              continue;
            }
            const applied = Math.min(student.monthlyFee, remaining);
            const newCharge = await tx.feeCharge.create({
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
            allocations.push({ feeChargeId: newCharge.id, amount: applied, year: y, month: m });
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
      if (allocations.length > 0) {
        await tx.paymentAllocation.createMany({
          data: allocations.map((a) => ({
            schoolId,
            paymentId: payment.id,
            feeChargeId: a.feeChargeId,
            amount: a.amount,
          })),
        });
      }

      // "YYYY-MM" per month this payment touched, de-duplicated (a single
      // charge can receive more than one allocation entry) and in order.
      const monthKeys = [...new Set(allocations.map((a) => `${a.year}-${String(a.month).padStart(2, "0")}`))].sort();

      // The parent paid — whatever they'd promised is settled, so any open
      // promise for this student closes itself rather than sitting on the
      // Collect Fees list looking unresolved.
      await tx.paymentPromise.updateMany({
        where: { studentId: student.id, status: { in: ["PENDING", "MISSED"] } },
        data: { status: "FULFILLED" },
      });

      return { receiptNumber, payment, unallocated: remaining, monthKeys };
    });
  }

  /**
   * One payment covering every active sibling under a parent at once — for
   * a family that pays together rather than one child at a time. Applied
   * oldest-first across the whole family's outstanding charges regardless of
   * which sibling owns them (same rule pay() uses within one student, just
   * spanning several). A separate receipt is issued per sibling that
   * actually received money, since a receipt belongs to one student's
   * ledger — but all of them come out of this single action and share a
   * note identifying them as one family payment.
   */
  async payFamily(
    schoolId: string,
    dto: PayFamilyInput,
    collectedByUserId: string,
  ) {
    return this.prisma.forTenant(
      schoolId,
      async (tx) => {
        if (!(await this.hasAnyFeeSetup(tx))) {
          throw new BadRequestException(
            "Fee setup required — set up billing (Settings → Fees) before collecting any payment.",
          );
        }

        const parent = await tx.parent.findFirst({
          where: { id: dto.parentId },
          select: { id: true, name: true },
        });
        if (!parent) throw new NotFoundException("Parent not found");

        const students = await tx.student.findMany({
          where: { parentId: dto.parentId, status: "ACTIVE" },
          select: { id: true, fullName: true },
        });
        if (students.length === 0) {
          throw new BadRequestException(
            "This parent has no active students",
          );
        }
        const studentIds = students.map((s) => s.id);
        const studentNameById = new Map(
          students.map((s) => [s.id, s.fullName]),
        );

        const outstanding = await tx.feeCharge.findMany({
          where: {
            studentId: { in: studentIds },
            status: { in: ["UNPAID", "PARTIAL"] },
          },
          orderBy: [
            { year: "asc" },
            { month: "asc" },
            { kind: "asc" },
            { createdAt: "asc" },
          ],
        });

        let remaining = dto.amount;
        const appliedByStudent = new Map<string, number>();
        // Same purpose as pay()'s allocations array, grouped per student
        // since payFamily() issues one receipt/payment row per sibling.
        const allocationsByStudent = new Map<
          string,
          { feeChargeId: string; amount: number }[]
        >();
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
          appliedByStudent.set(
            charge.studentId,
            (appliedByStudent.get(charge.studentId) ?? 0) + applied,
          );
          const list = allocationsByStudent.get(charge.studentId) ?? [];
          list.push({ feeChargeId: charge.id, amount: applied });
          allocationsByStudent.set(charge.studentId, list);
        }

        if (appliedByStudent.size === 0) {
          throw new BadRequestException(
            "This family has no outstanding balance to apply a payment to",
          );
        }

        const school = await tx.school.findUnique({
          where: { id: schoolId },
          select: { receiptPrefix: true },
        });

        const receipts: {
          studentId: string;
          studentName: string;
          receiptNumber: string;
          amountApplied: number;
        }[] = [];
        for (const [studentId, amountApplied] of appliedByStudent) {
          const seq = await tx.counter.upsert({
            where: { schoolId_name: { schoolId, name: "receipt" } },
            create: { schoolId, name: "receipt", value: 1 },
            update: { value: { increment: 1 } },
          });
          const receiptNumber = `${school?.receiptPrefix ?? "RCP"}${pad(seq.value)}`;
          const familyPayment = await tx.payment.create({
            data: {
              schoolId,
              studentId,
              receiptNumber,
              type: "PARTIAL",
              amount: amountApplied,
              method: dto.method ?? null,
              note: dto.note
                ? `${dto.note} (family payment — ${parent.name})`
                : `Family payment — ${parent.name}`,
              collectedByUserId,
            },
          });
          const studentAllocations = allocationsByStudent.get(studentId) ?? [];
          if (studentAllocations.length > 0) {
            await tx.paymentAllocation.createMany({
              data: studentAllocations.map((a) => ({
                schoolId,
                paymentId: familyPayment.id,
                feeChargeId: a.feeChargeId,
                amount: a.amount,
              })),
            });
          }
          receipts.push({
            studentId,
            studentName: studentNameById.get(studentId) ?? "",
            receiptNumber,
            amountApplied,
          });
        }

        // Same as pay(): any sibling who actually got paid has their open
        // promise settled, so it stops showing as unresolved.
        await tx.paymentPromise.updateMany({
          where: {
            studentId: { in: [...appliedByStudent.keys()] },
            status: { in: ["PENDING", "MISSED"] },
          },
          data: { status: "FULFILLED" },
        });

        return {
          parentName: parent.name,
          totalApplied: dto.amount - remaining,
          unallocated: remaining,
          receipts,
        };
      },
      { timeout: 60_000, maxWait: 30_000 },
    );
  }

  /**
   * Reverse a payment that was recorded wrong — wrong amount, wrong student,
   * a mistaken entry. This never edits or deletes the original: it creates a
   * second, negative Payment row linked back to it (its own receipt, its own
   * "why"), and marks the original REVERSED. The receipt trail then shows
   * both what was collected and that it was undone, which is the whole
   * point — a school can prove to itself and to a parent exactly what
   * happened, rather than history quietly changing shape.
   */
  async reversePayment(
    schoolId: string,
    paymentId: string,
    reason: string,
    actor: { userId: string; username: string; role: UserRole },
  ) {
    const result = await this.prisma.forTenant(schoolId, async (tx) => {
      const original = await tx.payment.findFirst({
        where: { id: paymentId },
        include: { allocations: true },
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

      // Undo exactly the charges this payment funded. Payments recorded
      // before allocation tracking existed have none on file — fall back to
      // unwinding the student's most recently touched paid/partial charges,
      // newest first, up to the payment amount, as the best reconstruction
      // available of what it most likely covered.
      let toUndo: { feeChargeId: string; amount: number }[] =
        original.allocations.map((a) => ({
          feeChargeId: a.feeChargeId,
          amount: a.amount,
        }));
      if (toUndo.length === 0) {
        let remaining = original.amount;
        const candidates = await tx.feeCharge.findMany({
          where: {
            studentId: original.studentId,
            status: { in: ["PAID", "PARTIAL"] },
          },
          orderBy: [
            { year: "desc" },
            { month: "desc" },
            { kind: "desc" },
            { updatedAt: "desc" },
          ],
        });
        for (const charge of candidates) {
          if (remaining <= 0) break;
          const undoable = Math.min(charge.paidAmount, remaining);
          if (undoable <= 0) continue;
          toUndo.push({ feeChargeId: charge.id, amount: undoable });
          remaining -= undoable;
        }
      }

      for (const u of toUndo) {
        const charge = await tx.feeCharge.findUnique({
          where: { id: u.feeChargeId },
        });
        if (!charge) continue;
        const paidAmount = Math.max(0, charge.paidAmount - u.amount);
        await tx.feeCharge.update({
          where: { id: charge.id },
          data: {
            paidAmount,
            status:
              charge.status === "INACTIVE"
                ? "INACTIVE"
                : paidAmount <= 0
                  ? "UNPAID"
                  : paidAmount < charge.amount
                    ? "PARTIAL"
                    : "PAID",
          },
        });
      }

      // Deterministic and guaranteed unique per school: the original number
      // is already unique, and no real receipt ends this way.
      const reversalReceiptNumber = `${original.receiptNumber}-REV`;
      const reversal = await tx.payment.create({
        data: {
          schoolId,
          studentId: original.studentId,
          receiptNumber: reversalReceiptNumber,
          type: original.type,
          amount: -original.amount,
          method: original.method,
          note: `Reversal of receipt ${original.receiptNumber}: ${reason}`,
          collectedByUserId: actor.userId,
          isReversal: true,
          reversalOfPaymentId: original.id,
        },
      });

      await tx.payment.update({
        where: { id: original.id },
        data: {
          status: "REVERSED",
          reversedAt: new Date(),
          reversedByUserId: actor.userId,
          reversalReason: reason,
        },
      });

      return {
        studentId: original.studentId,
        originalReceiptNumber: original.receiptNumber,
        reversalReceiptNumber,
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
      action: "PAYMENT_REVERSED",
      metadata: {
        originalReceiptNumber: result.originalReceiptNumber,
        reversalReceiptNumber: result.reversalReceiptNumber,
        amount: result.amount,
        studentId: result.studentId,
        reason,
      },
    });

    return result;
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
        // Carries every year the student has been billed in, so a ledger read
        // after a promotion still separates last year's fees from this one's.
        include: { academicYear: { select: { name: true } } },
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
      const paidMonths = billableMonthly.filter(
        (c) => c.status === "PAID",
      ).length;
      const unpaidMonths = billableMonthly.filter(
        (c) => c.status === "UNPAID" || c.status === "PARTIAL",
      ).length;
      const inactiveMonths = charges.filter(
        (c) => c.status === "INACTIVE",
      ).length;

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
          // Which months this payment actually covered, for the receipt. A
          // payment was previously returned with no way to answer that, so a
          // receipt reopened from the history list always printed "Month(s): —".
          allocations: {
            select: { feeCharge: { select: { year: true, month: true } } },
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
          // The charge's OWN year, not the school's current one. Labelling
          // every row with the active year meant a promotion silently moved
          // last year's fees into this year on screen.
          academicYear: { select: { name: true } },
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

  async updateExtraFee(schoolId: string, id: string, dto: UpdateExtraFeeInput) {
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

      await tx.feeCharge.deleteMany({
        where: { extraFeeId: id, kind: "EXTRA" },
      });
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
        const pending = targets.filter(
          (t) => !t.alreadyCharged && t.amount > 0,
        );

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

  /** One row per time a receipt was actually printed — how many, not just recorded. */
  async recordPrint(
    schoolId: string,
    paymentId: string,
    userId: string,
    username: string,
  ) {
    return this.prisma.forTenant(schoolId, async (tx) => {
      const payment = await tx.payment.findFirst({ where: { id: paymentId } });
      if (!payment) throw new NotFoundException("Payment not found");
      return tx.paymentPrintLog.create({
        data: {
          schoolId,
          paymentId,
          printedByUserId: userId,
          printedByUsername: username,
        },
      });
    });
  }

  /** Print history — how many receipts were printed, filterable by date and type. */
  async printHistory(
    schoolId: string,
    opts: { dateFrom?: string; dateTo?: string; type?: PaymentType },
  ) {
    const where: Prisma.PaymentPrintLogWhereInput = {};
    if (opts.dateFrom || opts.dateTo) {
      where.printedAt = {};
      if (opts.dateFrom) where.printedAt.gte = parseDateFrom(opts.dateFrom);
      if (opts.dateTo) where.printedAt.lte = parseDateTo(opts.dateTo);
    }
    if (opts.type) {
      where.payment = { type: opts.type };
    }

    return this.prisma.forTenant(schoolId, async (tx) => {
      const [total, logs] = await Promise.all([
        tx.paymentPrintLog.count({ where }),
        tx.paymentPrintLog.findMany({
          where,
          orderBy: { printedAt: "desc" },
          take: 500,
          include: {
            payment: {
              include: { student: { select: { code: true, fullName: true } } },
            },
          },
        }),
      ]);
      return {
        total,
        logs: logs.map((l) => ({
          id: l.id,
          printedAt: l.printedAt.toISOString(),
          printedByUsername: l.printedByUsername,
          receiptNumber: l.payment.receiptNumber,
          amount: l.payment.amount,
          type: l.payment.type,
          isReversal: l.payment.isReversal,
          status: l.payment.status,
          student: l.payment.student
            ? { code: l.payment.student.code, fullName: l.payment.student.fullName }
            : null,
        })),
      };
    });
  }

  // ── Payment promises ─────────────────────────────────────────────────
  // A parent's commitment to pay by a future date, recorded when reception
  // can't collect today. Purely a reminder — never touches FeeCharge/Payment.

  async createPaymentPromise(
    schoolId: string,
    dto: CreatePaymentPromiseInput,
    userId?: string,
  ) {
    return this.prisma.forTenant(schoolId, async (tx) => {
      const student = await tx.student.findFirst({
        where: { id: dto.studentId },
        select: { id: true },
      });
      if (!student) throw new NotFoundException("Student not found");

      return tx.paymentPromise.create({
        data: {
          schoolId,
          studentId: dto.studentId,
          promisedDate: dto.promisedDate,
          note: dto.note,
          amount: dto.amount ?? null,
          createdByUserId: userId ?? null,
        },
      });
    });
  }

  /**
   * Every still-open promise for the school, no date horizon — used to badge
   * a student's row on the Collect Fees list even when their promised date
   * is weeks out (the "due soon" banner only covers the next 3 days).
   */
  async listActivePaymentPromises(schoolId: string) {
    return this.prisma.forTenant(schoolId, async (tx) => {
      const promises = await tx.paymentPromise.findMany({
        where: { status: { in: ["PENDING", "MISSED"] } },
        orderBy: { promisedDate: "asc" },
        select: {
          id: true,
          studentId: true,
          promisedDate: true,
          note: true,
          amount: true,
          status: true,
          createdAt: true,
        },
      });
      return promises.map((p) => ({
        ...p,
        promisedDate: p.promisedDate.toISOString(),
        createdAt: p.createdAt.toISOString(),
      }));
    });
  }

  /** All promises for a student, newest first — shown on their fee ledger. */
  async listPaymentPromisesForStudent(schoolId: string, studentId: string) {
    return this.prisma.forTenant(schoolId, (tx) =>
      tx.paymentPromise.findMany({
        where: { studentId },
        orderBy: { promisedDate: "desc" },
      }),
    );
  }

  /**
   * Still-open promises for the Finance banner: overdue or due within the
   * next 3 days. Auto-flips anything PENDING and already past its date to
   * MISSED first, so the banner never quietly under-counts.
   */
  async listDuePaymentPromises(schoolId: string) {
    return this.prisma.forTenant(schoolId, async (tx) => {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      await tx.paymentPromise.updateMany({
        where: { status: "PENDING", promisedDate: { lt: today } },
        data: { status: "MISSED" },
      });

      const horizon = new Date(today);
      horizon.setUTCDate(horizon.getUTCDate() + 3);

      const promises = await tx.paymentPromise.findMany({
        where: {
          status: { in: ["PENDING", "MISSED"] },
          promisedDate: { lte: horizon },
        },
        orderBy: { promisedDate: "asc" },
        take: 50,
        include: {
          student: { select: { id: true, code: true, fullName: true } },
        },
      });

      return promises.map((p) => ({
        id: p.id,
        studentId: p.studentId,
        studentCode: p.student.code,
        studentName: p.student.fullName,
        promisedDate: p.promisedDate.toISOString(),
        note: p.note,
        amount: p.amount,
        status: p.status,
      }));
    });
  }

  async updatePaymentPromise(
    schoolId: string,
    id: string,
    dto: UpdatePaymentPromiseInput,
  ) {
    const existing = await this.prisma.forTenant(schoolId, (tx) =>
      tx.paymentPromise.findFirst({ where: { id }, select: { id: true } }),
    );
    if (!existing) throw new NotFoundException("Payment promise not found");
    return this.prisma.forTenant(schoolId, (tx) =>
      tx.paymentPromise.update({
        where: { id },
        data: {
          status: dto.status,
          promisedDate: dto.promisedDate,
          note: dto.note,
          amount: dto.amount,
        },
      }),
    );
  }
}
