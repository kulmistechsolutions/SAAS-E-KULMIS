import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Finance Dashboard (Module 10): Net Income = Income − Expenses − Salaries.
 *
 * These totals are computed here, in SQL, over the school's whole dataset on
 * purpose. The pages used to add them up in the browser from whatever the fee
 * and salary stores happened to have cached — a list capped at the most recent
 * 200 payments, and a refresh that swallowed its own errors — so two people
 * looking at the same school on the same day could see different numbers, and
 * a failed load showed a confident $0 rather than an error.
 */
@Injectable()
export class FinanceService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * `month` is "YYYY-MM". Given it, every figure covers that calendar month;
   * omitted, they cover all time.
   */
  dashboard(schoolId: string, month?: string) {
    const period = parseMonth(month);

    return this.prisma.forTenant(schoolId, async (tx) => {
      const paidAt = period ? { gte: period.start, lt: period.end } : undefined;
      const spentAt = period ? { gte: period.start, lt: period.end } : undefined;
      const salaryWhere = period
        ? { year: period.year, month: period.month }
        : {};

      const [payAgg, expAgg, salAgg, otherAgg, outstandingCharges] = await Promise.all([
        // Reversals are stored as a second, negative Payment row, so summing
        // every row already nets a reversed collection back out.
        tx.payment.aggregate({ _sum: { amount: true }, where: { paidAt } }),
        tx.expense.aggregate({ _sum: { amount: true }, where: { spentAt } }),
        // Money that actually left the school is `amountPaid`, on every row —
        // a PARTIAL payroll row is real cash out too.
        tx.salary.aggregate({
          _sum: { amountPaid: true },
          where: salaryWhere,
        }),
        // Donations, rent, canteen, grants — income that never passes through
        // fee collection, and without which Net Income only ever described the
        // part of the school's money that came from parents.
        tx.otherIncome.aggregate({
          _sum: { amount: true },
          where: period ? { receivedAt: { gte: period.start, lt: period.end } } : {},
        }),
        tx.feeCharge.findMany({
          where: { status: { not: "PAID" } },
          select: { amount: true, paidAmount: true },
        }),
      ]);

      const feeIncome = payAgg._sum.amount ?? 0;
      const otherIncome = otherAgg._sum.amount ?? 0;
      const totalIncome = feeIncome + otherIncome;
      const totalExpenses = expAgg._sum.amount ?? 0;
      const totalSalaries = salAgg._sum.amountPaid ?? 0;
      const totalOutstanding = outstandingCharges.reduce(
        (sum, c) => sum + (c.amount - c.paidAmount),
        0,
      );

      return {
        month: month ?? null,
        totalIncome,
        feeIncome,
        otherIncome,
        totalExpenses,
        totalSalaries,
        netIncome: totalIncome - totalExpenses - totalSalaries,
        totalFinancialOutflow: totalExpenses + totalSalaries,
        totalOutstanding,
      };
    });
  }
}

/** "YYYY-MM" → the UTC half-open range covering it, plus its parts. */
function parseMonth(month?: string) {
  if (!month) return null;
  const m = /^(\d{4})-(\d{2})$/.exec(month.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const monthNo = Number(m[2]);
  if (monthNo < 1 || monthNo > 12) return null;
  return {
    year,
    month: monthNo,
    start: new Date(Date.UTC(year, monthNo - 1, 1)),
    end: new Date(Date.UTC(year, monthNo, 1)),
  };
}
