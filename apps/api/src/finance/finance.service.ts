import { roundMoney } from "@ekulmis/shared";
import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

export interface FinanceTrendMonth {
  month: string;
  feeIncome: number;
  otherIncome: number;
  expenses: number;
  salaries: number;
  debtRepaid: number;
}

export interface FinanceTrend {
  months: FinanceTrendMonth[];
  /** Money in that is not a student fee, by its category, per month. */
  otherIncomeByCategory: { month: string; category: string; amount: number }[];
  /** Spending by category, per month. */
  expensesByCategory: { month: string; category: string; amount: number }[];
}

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

      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);

      const [
        payAgg,
        todayAgg,
        expAgg,
        salAgg,
        otherAgg,
        outstandingCharges,
        debtAgg,
      ] = await Promise.all([
        // Reversals are stored as a second, negative Payment row, so summing
        // every row already nets a reversed collection back out.
        tx.payment.aggregate({ _sum: { amount: true }, where: { paidAt } }),
        // Today's collection, summed here rather than in the browser: the fee
        // page had been adding up whatever payments it had cached, which is
        // the newest page of them, so a school past that page under-reported
        // what it had taken in.
        tx.payment.aggregate({
          _sum: { amount: true },
          where: { paidAt: { gte: startOfToday } },
        }),
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
        // What the school paid back on its own borrowing. Money out, so it
        // belongs beside expenses and salaries — the principal it borrowed is
        // not income and never appears above.
        tx.schoolDebtRepayment.aggregate({
          _sum: { amount: true },
          where: period ? { paidAt: { gte: period.start, lt: period.end } } : {},
        }),
      ]);

      const feeIncome = payAgg._sum.amount ?? 0;
      const otherIncome = otherAgg._sum.amount ?? 0;
      const totalIncome = feeIncome + otherIncome;
      // Decimal: the expense column carries cents.
      const totalExpenses = Number(expAgg._sum.amount ?? 0);
      const totalSalaries = salAgg._sum.amountPaid ?? 0;
      const debtRepaid = debtAgg._sum.amount ?? 0;
      const totalOutstanding = outstandingCharges.reduce(
        (sum, c) => roundMoney(sum + (c.amount - c.paidAmount)),
        0,
      );

      return {
        month: month ?? null,
        totalIncome,
        feeIncome,
        feeCollectedToday: todayAgg._sum.amount ?? 0,
        otherIncome,
        totalExpenses,
        totalSalaries,
        debtRepaid,
        netIncome: totalIncome - totalExpenses - totalSalaries - debtRepaid,
        totalFinancialOutflow: totalExpenses + totalSalaries + debtRepaid,
        totalOutstanding,
      };
    });
  }
  /**
   * Month by month, the last `months` calendar months up to this one: what
   * came in (fees, other income), what went out (expenses, salaries, debt
   * repaid), and the category split of other income and expenses.
   *
   * One query per source, grouped in SQL, so the Financial Reports overview
   * draws a year's chart from five round-trips instead of a request per
   * month. Salaries count by the payroll month they belong to, the same rule
   * the dashboard and the statements use.
   */
  trend(schoolId: string, months = 24): Promise<FinanceTrend> {
    const n = Math.min(60, Math.max(1, Math.floor(months)));
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (n - 1), 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    const keys: string[] = [];
    for (let k = 0; k < n; k++) {
      const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + k, 1));
      keys.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
    }
    const startKey = start.getUTCFullYear() * 100 + start.getUTCMonth() + 1;
    const endKey = now.getUTCFullYear() * 100 + now.getUTCMonth() + 1;
    type Row = { month: string; amount: number };
    type CatRow = { month: string; category: string; amount: number };
    const num = (v: unknown) => Number(v ?? 0);

    return this.prisma.forTenant(schoolId, async (tx) => {
      const [fees, other, exp, sal, debt, otherCat, expCat] = await Promise.all([
        tx.$queryRaw<Row[]>(Prisma.sql`
          SELECT to_char("paidAt", 'YYYY-MM') AS month, sum(amount)::float AS amount
          FROM payments WHERE "paidAt" >= ${start} AND "paidAt" < ${end}
          GROUP BY 1`),
        tx.$queryRaw<Row[]>(Prisma.sql`
          SELECT to_char("receivedAt", 'YYYY-MM') AS month, sum(amount)::float AS amount
          FROM other_income WHERE "receivedAt" >= ${start} AND "receivedAt" < ${end}
          GROUP BY 1`),
        tx.$queryRaw<Row[]>(Prisma.sql`
          SELECT to_char("spentAt", 'YYYY-MM') AS month, sum(amount)::float AS amount
          FROM expenses WHERE "spentAt" >= ${start} AND "spentAt" < ${end}
          GROUP BY 1`),
        tx.$queryRaw<Row[]>(Prisma.sql`
          SELECT year || '-' || lpad(month::text, 2, '0') AS month, sum("amountPaid")::float AS amount
          FROM salaries WHERE (year * 100 + month) BETWEEN ${startKey} AND ${endKey}
          GROUP BY 1`),
        tx.$queryRaw<Row[]>(Prisma.sql`
          SELECT to_char("paidAt", 'YYYY-MM') AS month, sum(amount)::float AS amount
          FROM school_debt_repayments WHERE "paidAt" >= ${start} AND "paidAt" < ${end}
          GROUP BY 1`),
        tx.$queryRaw<CatRow[]>(Prisma.sql`
          SELECT to_char(o."receivedAt", 'YYYY-MM') AS month,
                 coalesce(c.name, 'Uncategorised') AS category, sum(o.amount)::float AS amount
          FROM other_income o LEFT JOIN income_categories c ON c.id = o."categoryId"
          WHERE o."receivedAt" >= ${start} AND o."receivedAt" < ${end}
          GROUP BY 1, 2`),
        tx.$queryRaw<CatRow[]>(Prisma.sql`
          SELECT to_char(e."spentAt", 'YYYY-MM') AS month,
                 coalesce(c.name, 'Uncategorised') AS category, sum(e.amount)::float AS amount
          FROM expenses e LEFT JOIN expense_categories c ON c.id = e."categoryId"
          WHERE e."spentAt" >= ${start} AND e."spentAt" < ${end}
          GROUP BY 1, 2`),
      ]);
      const by = (rows: Row[]) => new Map(rows.map((r) => [r.month, num(r.amount)]));
      const f = by(fees), o = by(other), e = by(exp), s = by(sal), d = by(debt);
      return {
        months: keys.map((m) => ({
          month: m,
          feeIncome: roundMoney(f.get(m) ?? 0),
          otherIncome: roundMoney(o.get(m) ?? 0),
          expenses: roundMoney(e.get(m) ?? 0),
          salaries: roundMoney(s.get(m) ?? 0),
          debtRepaid: roundMoney(d.get(m) ?? 0),
        })),
        otherIncomeByCategory: otherCat.map((r) => ({ month: r.month, category: r.category, amount: roundMoney(num(r.amount)) })),
        expensesByCategory: expCat.map((r) => ({ month: r.month, category: r.category, amount: roundMoney(num(r.amount)) })),
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
