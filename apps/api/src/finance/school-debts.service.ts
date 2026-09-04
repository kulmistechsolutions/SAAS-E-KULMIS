import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type {
  CreateDebtRepaymentInput,
  CreateSchoolDebtInput,
  UpdateSchoolDebtInput,
} from "@ekulmis/shared";
import { PrismaService } from "../prisma/prisma.service";

/**
 * What the school owes, and what it has paid back.
 *
 * Borrowing is not income. A loan does not make a school richer — it creates
 * an obligation, and the money that actually leaves is the repayment. So the
 * principal is tracked here as a debt and never counted as money taken in,
 * while every repayment reaches net income the same way an expense does.
 *
 * Before this, a school with a bank loan had nowhere to write it down. The
 * obligation lived in somebody's head and the repayments went in as ordinary
 * expenses, if they went in at all — so the finance page could not say what
 * the school owed, and the same repayment could be entered twice under two
 * different names without anything noticing.
 */
@Injectable()
export class SchoolDebtsService {
  constructor(private readonly prisma: PrismaService) {}

  private date(value?: string | null): Date | undefined {
    if (!value) return undefined;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) {
      throw new BadRequestException("Invalid date");
    }
    return d;
  }

  /** Every debt with what has been repaid against it. */
  async list(schoolId: string, status?: string) {
    return this.prisma.forTenant(schoolId, async (tx) => {
      const debts = await tx.schoolDebt.findMany({
        where: status ? { status: status as never } : {},
        orderBy: [{ status: "asc" }, { takenAt: "desc" }],
      });
      if (debts.length === 0) return [];

      // One grouped query rather than one per debt — the pooler is slow
      // enough that a loop would be felt on a school with a few years of
      // borrowing behind it.
      const paid = await tx.schoolDebtRepayment.groupBy({
        by: ["debtId"],
        where: { debtId: { in: debts.map((d) => d.id) } },
        _sum: { amount: true },
        _count: { _all: true },
        _max: { paidAt: true },
      });
      const paidOf = new Map(paid.map((p) => [p.debtId, p]));

      return debts.map((d) => {
        const p = paidOf.get(d.id);
        const repaid = p?._sum.amount ?? 0;
        return {
          ...d,
          repaid,
          outstanding: Math.max(0, d.principal - repaid),
          repaymentCount: p?._count._all ?? 0,
          lastRepaidAt: p?._max.paidAt ?? null,
          // A debt is overdue when its own date has passed and money is still
          // on it. Settled debts never read as overdue, whatever their date.
          overdue:
            d.status === "OPEN" &&
            !!d.dueAt &&
            d.dueAt < new Date() &&
            d.principal - repaid > 0,
        };
      });
    });
  }

  /** One debt with its full repayment history — the statement view. */
  async get(schoolId: string, id: string) {
    return this.prisma.forTenant(schoolId, async (tx) => {
      const debt = await tx.schoolDebt.findFirst({ where: { id } });
      if (!debt) throw new NotFoundException("Debt not found");

      const repayments = await tx.schoolDebtRepayment.findMany({
        where: { debtId: id },
        orderBy: { paidAt: "desc" },
      });
      const repaid = repayments.reduce((n, r) => n + r.amount, 0);

      const userIds = [
        ...new Set(
          [debt.recordedByUserId, ...repayments.map((r) => r.recordedByUserId)].filter(
            (x): x is string => Boolean(x),
          ),
        ),
      ];
      const users = userIds.length
        ? await tx.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, fullName: true, username: true },
          })
        : [];
      const nameOf = new Map(users.map((u) => [u.id, u.fullName || u.username]));

      return {
        ...debt,
        recordedBy: debt.recordedByUserId
          ? (nameOf.get(debt.recordedByUserId) ?? null)
          : null,
        repaid,
        outstanding: Math.max(0, debt.principal - repaid),
        overdue:
          debt.status === "OPEN" &&
          !!debt.dueAt &&
          debt.dueAt < new Date() &&
          debt.principal - repaid > 0,
        repayments: repayments.map((r) => ({
          ...r,
          recordedBy: r.recordedByUserId
            ? (nameOf.get(r.recordedByUserId) ?? null)
            : null,
        })),
      };
    });
  }

  create(schoolId: string, dto: CreateSchoolDebtInput, userId?: string) {
    return this.prisma.forTenant(schoolId, (tx) =>
      tx.schoolDebt.create({
        data: {
          schoolId,
          lender: dto.lender.trim(),
          purpose: dto.purpose?.trim() || null,
          principal: dto.principal,
          reference: dto.reference?.trim() || null,
          takenAt: this.date(dto.takenAt) ?? new Date(),
          dueAt: this.date(dto.dueAt) ?? null,
          note: dto.note?.trim() || null,
          recordedByUserId: userId ?? null,
        },
      }),
    );
  }

  async update(schoolId: string, id: string, dto: UpdateSchoolDebtInput) {
    return this.prisma.forTenant(schoolId, async (tx) => {
      const debt = await tx.schoolDebt.findFirst({
        where: { id },
        select: { id: true, principal: true },
      });
      if (!debt) throw new NotFoundException("Debt not found");

      // Lowering the principal below what has already been paid back would
      // leave the school owed money by its own lender, which is not a state
      // this is meant to describe.
      if (dto.principal !== undefined) {
        const paid = await tx.schoolDebtRepayment.aggregate({
          where: { debtId: id },
          _sum: { amount: true },
        });
        const repaid = paid._sum.amount ?? 0;
        if (dto.principal < repaid) {
          throw new BadRequestException(
            `This debt already has ${repaid} repaid against it — the amount cannot be set below that.`,
          );
        }
      }

      return tx.schoolDebt.update({
        where: { id },
        data: {
          ...(dto.lender !== undefined ? { lender: dto.lender.trim() } : {}),
          ...(dto.purpose !== undefined ? { purpose: dto.purpose?.trim() || null } : {}),
          ...(dto.principal !== undefined ? { principal: dto.principal } : {}),
          ...(dto.reference !== undefined
            ? { reference: dto.reference?.trim() || null }
            : {}),
          ...(dto.takenAt !== undefined ? { takenAt: this.date(dto.takenAt) } : {}),
          ...(dto.dueAt !== undefined ? { dueAt: this.date(dto.dueAt) ?? null } : {}),
          ...(dto.note !== undefined ? { note: dto.note?.trim() || null } : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
        },
      });
    });
  }

  /**
   * Record a repayment.
   *
   * Refused once it would take the debt past its principal: a school paying
   * more than it borrowed is almost always the same repayment entered twice,
   * and letting it through would quietly overstate what has left the school.
   * The debt closes itself when the last of it is cleared, so nobody has to
   * remember to.
   */
  async repay(
    schoolId: string,
    debtId: string,
    dto: CreateDebtRepaymentInput,
    userId?: string,
  ) {
    return this.prisma.forTenant(schoolId, async (tx) => {
      const debt = await tx.schoolDebt.findFirst({ where: { id: debtId } });
      if (!debt) throw new NotFoundException("Debt not found");
      if (debt.status === "CANCELLED") {
        throw new BadRequestException("This debt has been cancelled.");
      }

      const paid = await tx.schoolDebtRepayment.aggregate({
        where: { debtId },
        _sum: { amount: true },
      });
      const repaid = paid._sum.amount ?? 0;
      const remaining = debt.principal - repaid;
      if (remaining <= 0) {
        throw new BadRequestException("This debt is already fully repaid.");
      }
      if (dto.amount > remaining) {
        throw new BadRequestException(
          `Only ${remaining} is left on this debt — this repayment is for ${dto.amount}.`,
        );
      }

      const repayment = await tx.schoolDebtRepayment.create({
        data: {
          schoolId,
          debtId,
          amount: dto.amount,
          method: dto.method?.trim() || null,
          reference: dto.reference?.trim() || null,
          note: dto.note?.trim() || null,
          paidAt: this.date(dto.paidAt) ?? new Date(),
          recordedByUserId: userId ?? null,
        },
      });

      if (repaid + dto.amount >= debt.principal) {
        await tx.schoolDebt.update({
          where: { id: debtId },
          data: { status: "SETTLED" },
        });
      }

      return repayment;
    });
  }

  async deleteRepayment(schoolId: string, repaymentId: string) {
    return this.prisma.forTenant(schoolId, async (tx) => {
      // Read before the delete: afterwards there is no amount left to name,
      // and money coming back off the books is exactly what somebody asks
      // about later.
      const row = await tx.schoolDebtRepayment.findFirst({
        where: { id: repaymentId },
        select: { id: true, debtId: true, amount: true },
      });
      if (!row) throw new NotFoundException("Repayment not found");
      await tx.schoolDebtRepayment.delete({ where: { id: repaymentId } });
      // Removing a repayment reopens the debt it had closed.
      await tx.schoolDebt.updateMany({
        where: { id: row.debtId, status: "SETTLED" },
        data: { status: "OPEN" },
      });
      return { success: true, debtId: row.debtId, amount: row.amount };
    });
  }

  /**
   * The school's borrowing position, and the repayments that belong to a
   * period — the figure net income needs.
   */
  async summary(schoolId: string, range?: { gte: Date; lt: Date }) {
    return this.prisma.forTenant(schoolId, async (tx) => {
      const [debts, repaidAll, repaidInRange] = await Promise.all([
        tx.schoolDebt.findMany({
          where: { status: { not: "CANCELLED" } },
          select: { id: true, principal: true, status: true, dueAt: true },
        }),
        tx.schoolDebtRepayment.aggregate({ _sum: { amount: true } }),
        range
          ? tx.schoolDebtRepayment.aggregate({
              where: { paidAt: range },
              _sum: { amount: true },
            })
          : Promise.resolve({ _sum: { amount: null as number | null } }),
      ]);

      const borrowed = debts.reduce((n, d) => n + d.principal, 0);
      const repaid = repaidAll._sum.amount ?? 0;

      return {
        debts: debts.length,
        open: debts.filter((d) => d.status === "OPEN").length,
        settled: debts.filter((d) => d.status === "SETTLED").length,
        borrowed,
        repaid,
        outstanding: Math.max(0, borrowed - repaid),
        repaidInPeriod: repaidInRange._sum.amount ?? 0,
      };
    });
  }

  /** Repayments in a period — what net income subtracts. */
  async repaidBetween(schoolId: string, range?: { gte: Date; lt: Date }) {
    const agg = await this.prisma.forTenant(schoolId, (tx) =>
      tx.schoolDebtRepayment.aggregate({
        where: range ? { paidAt: range } : {},
        _sum: { amount: true },
      }),
    );
    return agg._sum.amount ?? 0;
  }
}
