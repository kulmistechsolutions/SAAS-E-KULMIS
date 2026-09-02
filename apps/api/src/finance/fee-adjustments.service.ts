import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { BalanceEngineService } from "./balance-engine.service";

/**
 * Discounts, waivers and the record of every fee change.
 *
 * Two things the module could not say before.
 *
 * A school that wanted to charge one family less for one month had only one
 * lever: the student's monthly fee. Pulling it changed every month that
 * followed, so a one-off kindness became a permanent rate nobody remembered
 * granting — and when the fee was later "corrected" back, the discount month
 * silently repriced too. A discount is now a fact about a month, recorded
 * against that month, leaving the student's own fee alone. That is the
 * distinction between what a student's fee *is* and what a particular month
 * *costs*, and losing it is what made BARWAAQO's seven students unreadable:
 * nobody could tell whether $20 against a $2,000 fee was a discount or a typo.
 *
 * And a fee that changed left no trace. KTS raised a student to $95, the month
 * being collected stayed at $60, and there was nothing to consult about when
 * it happened or what it was meant to touch. Every change now says who, when,
 * from what, to what, how far it reached and why.
 */
@Injectable()
export class FeeAdjustmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly balances: BalanceEngineService,
  ) {}

  /**
   * Take an amount off one month's charge, without touching the student's fee.
   *
   * The charge's own amount carries the adjusted figure, so every balance in
   * the system already reflects it — no screen has to know adjustments exist
   * to show the right number. What was there before is kept on the adjustment
   * row, which is the only place the original survives.
   */
  async adjust(
    schoolId: string,
    input: {
      feeChargeId: string;
      type: "DISCOUNT" | "WAIVER" | "ADJUSTMENT";
      /** How much to take off. Ignored for WAIVER, which clears the balance. */
      amount?: number;
      reason: string;
    },
    actor: { userId?: string; username?: string; role?: string },
  ) {
    const result = await this.prisma.forTenant(schoolId, async (tx) => {
      const charge = await tx.feeCharge.findFirst({
        where: { id: input.feeChargeId },
        select: {
          id: true,
          studentId: true,
          amount: true,
          paidAmount: true,
          status: true,
          year: true,
          month: true,
        },
      });
      if (!charge) throw new NotFoundException("Charge not found");
      if (charge.status === "INACTIVE") {
        throw new BadRequestException("That charge has already been withdrawn");
      }

      // A waiver clears whatever is still owed; a discount takes off what was
      // asked for. Neither may reach past the balance into money already
      // collected — refunding is a different decision, with its own approval.
      const remaining = Math.max(0, charge.amount - charge.paidAmount);
      const off =
        input.type === "WAIVER" ? remaining : Math.round(input.amount ?? 0);
      if (off <= 0) {
        throw new BadRequestException("Enter an amount to take off");
      }
      if (off > remaining) {
        throw new BadRequestException(
          `That is more than is still owed on this charge (${remaining})`,
        );
      }

      const newAmount = charge.amount - off;
      await tx.feeCharge.update({
        where: { id: charge.id },
        data: {
          amount: newAmount,
          status:
            charge.paidAmount >= newAmount
              ? "PAID"
              : charge.paidAmount > 0
                ? "PARTIAL"
                : "UNPAID",
        },
      });

      const adjustment = await tx.feeAdjustment.create({
        data: {
          schoolId,
          studentId: charge.studentId,
          feeChargeId: charge.id,
          type: input.type,
          originalAmount: charge.amount,
          amount: off,
          reason: input.reason,
          createdByUserId: actor.userId ?? null,
          createdByUsername: actor.username ?? null,
        },
      });

      return { adjustment, charge, off, newAmount };
    });

    await this.audit.record({
      schoolId,
      userId: actor.userId,
      username: actor.username,
      role: actor.role as never,
      module: "finance",
      action: "FEE_ADJUSTED",
      metadata: {
        studentId: result.charge.studentId,
        feeChargeId: result.charge.id,
        type: input.type,
        month: `${result.charge.year}-${String(result.charge.month).padStart(2, "0")}`,
        originalAmount: result.charge.amount,
        takenOff: result.off,
        newAmount: result.newAmount,
        reason: input.reason,
      },
    });

    return result.adjustment;
  }

  /** Every adjustment made to a student's charges, newest first. */
  listForStudent(schoolId: string, studentId: string) {
    return this.prisma.forTenant(schoolId, (tx) =>
      tx.feeAdjustment.findMany({
        where: { studentId },
        orderBy: { createdAt: "desc" },
        include: {
          feeCharge: { select: { year: true, month: true, kind: true, label: true } },
        },
      }),
    );
  }

  /**
   * Reprice a student's charges for a fee change, as far as the school says.
   *
   * The scope is chosen rather than assumed. "From now on" and "fix this month
   * too" are different intentions, and guessing between them either leaves the
   * month being collected at the old rate — which is what KTS hit — or
   * rewrites months a family has already settled around.
   *
   * Never touches a month that is already paid: that is history, and a fee
   * changed in October has no business rewriting September.
   */
  async applyFeeChange(
    schoolId: string,
    input: {
      studentId: string;
      oldFee: number;
      newFee: number;
      scope: "CURRENT_MONTH" | "FUTURE_MONTHS" | "CURRENT_AND_FUTURE" | "ALL_UNPAID";
      reason?: string;
    },
    actor: { userId?: string; username?: string; role?: string },
  ) {
    const live = await this.balances.liveMonth(schoolId);
    const liveYm = live.year * 100 + live.month;

    const updated = await this.prisma.forTenant(schoolId, async (tx) => {
      const open = await tx.feeCharge.findMany({
        where: {
          studentId: input.studentId,
          kind: "MONTHLY",
          status: { in: ["UNPAID", "PARTIAL"] },
          // Only rows still carrying the old rate. A month priced by hand — a
          // discount, an agreement — was set deliberately and is not swept up
          // by a change to the standing fee.
          amount: input.oldFee,
        },
        select: { id: true, year: true, month: true, paidAmount: true },
      });

      const inScope = open.filter((c) => {
        const ym = c.year * 100 + c.month;
        switch (input.scope) {
          case "CURRENT_MONTH":
            return ym === liveYm;
          case "FUTURE_MONTHS":
            return ym > liveYm;
          case "CURRENT_AND_FUTURE":
            return ym >= liveYm;
          case "ALL_UNPAID":
            return true;
        }
      });

      for (const c of inScope) {
        await tx.feeCharge.update({
          where: { id: c.id },
          data: {
            amount: input.newFee,
            status:
              c.paidAmount >= input.newFee
                ? "PAID"
                : c.paidAmount > 0
                  ? "PARTIAL"
                  : "UNPAID",
          },
        });
      }

      await tx.feeChangeLog.create({
        data: {
          schoolId,
          studentId: input.studentId,
          oldFee: input.oldFee,
          newFee: input.newFee,
          scope: input.scope,
          chargesUpdated: inScope.length,
          reason: input.reason ?? null,
          changedByUserId: actor.userId ?? null,
          changedByUsername: actor.username ?? null,
        },
      });

      return inScope.length;
    });

    await this.audit.record({
      schoolId,
      userId: actor.userId,
      username: actor.username,
      role: actor.role as never,
      module: "finance",
      action: "FEE_CHANGED",
      metadata: {
        studentId: input.studentId,
        oldFee: input.oldFee,
        newFee: input.newFee,
        scope: input.scope,
        chargesUpdated: updated,
        reason: input.reason ?? null,
      },
    });

    return { chargesUpdated: updated, liveMonth: live.monthKey };
  }

  /** A student's fee-change history, newest first. */
  feeHistory(schoolId: string, studentId: string) {
    return this.prisma.forTenant(schoolId, (tx) =>
      tx.feeChangeLog.findMany({
        where: { studentId },
        orderBy: { createdAt: "desc" },
      }),
    );
  }
}
