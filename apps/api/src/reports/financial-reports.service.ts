import { Injectable } from "@nestjs/common";
import { formatMoney } from "@ekulmis/shared";
import { PrismaService } from "../prisma/prisma.service";
import type { ReportData } from "./fee-reports.service";

export interface FinancialReportFilters {
  month?: string;
}

function monthRange(value?: string): { gte: Date; lt: Date } | null {
  const m = value ? /^(\d{4})-(\d{2})$/.exec(value) : null;
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  return {
    gte: new Date(Date.UTC(year, month - 1, 1)),
    lt: new Date(Date.UTC(month === 12 ? year + 1 : year, month % 12, 1)),
  };
}

/**
 * Financial reports: fee income against expenses and salaries, computed from
 * the database. Reuses the same three tables the fee/salary/expense reports
 * already read, just totalled together rather than listed row by row.
 */
@Injectable()
export class FinancialReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async build(
    schoolId: string,
    slug: string,
    filters: FinancialReportFilters,
  ): Promise<ReportData> {
    const range = monthRange(filters.month);
    const school = await this.prisma.school.findFirst({
      where: { id: schoolId },
      select: { currency: true },
    });
    const money = (n: number) => formatMoney(n, school?.currency);

    const { fees, otherIncome, expenses, salaries, debtRepaid } =
      await this.prisma.forTenant(schoolId, async (tx) => {
        const [paySum, otherSum, expSum, salSum, debtSum] = await Promise.all([
          tx.payment.aggregate({
            where: range ? { paidAt: range } : {},
            _sum: { amount: true },
          }),
          // Donations, rent, canteen — income that never passes through fee
          // collection. Leaving it out made this report disagree with the
          // finance page about what the school actually took in.
          tx.otherIncome.aggregate({
            where: range ? { receivedAt: range } : {},
            _sum: { amount: true },
          }),
          tx.expense.aggregate({
            where: range ? { spentAt: range } : {},
            _sum: { amount: true },
          }),
          tx.salary.aggregate({
            where: range
              ? { year: Number(filters.month!.slice(0, 4)), month: Number(filters.month!.slice(5, 7)) }
              : {},
            // What left the school is `amountPaid` on every row; summing
            // `amount` counted payroll that has not been paid yet as spent.
            _sum: { amountPaid: true },
          }),
          // Loan repayments leave the school the same way an expense does.
          // The money borrowed is not income, so only what goes back out
          // reaches this report.
          tx.schoolDebtRepayment.aggregate({
            where: range ? { paidAt: range } : {},
            _sum: { amount: true },
          }),
        ]);
        return {
          fees: paySum._sum.amount ?? 0,
          otherIncome: otherSum._sum.amount ?? 0,
          expenses: expSum._sum.amount ?? 0,
          salaries: salSum._sum.amountPaid ?? 0,
          debtRepaid: debtSum._sum.amount ?? 0,
        };
      });

    const income = fees + otherIncome;
    const net = income - expenses - salaries - debtRepaid;
    // Only worth its own line when there is something on it.
    const incomeLines = [
      { line: "Fee Collections", amount: money(fees) },
      ...(otherIncome > 0
        ? [{ line: "Additional Income", amount: money(otherIncome) }]
        : []),
    ];

    if (slug === "income") {
      return {
        columns: [{ key: "line", label: "Line" }, { key: "amount", label: "Amount", align: "right" }],
        rows: incomeLines,
        summary: [{ label: "Income", value: money(income) }],
      };
    }
    if (slug === "expenses") {
      return {
        columns: [{ key: "line", label: "Line" }, { key: "amount", label: "Amount", align: "right" }],
        rows: [{ line: "Expenses", amount: money(expenses) }],
        summary: [{ label: "Expenses", value: money(expenses) }],
      };
    }
    if (slug === "salary") {
      return {
        columns: [{ key: "line", label: "Line" }, { key: "amount", label: "Amount", align: "right" }],
        rows: [{ line: "Salaries", amount: money(salaries) }],
        summary: [{ label: "Salaries", value: money(salaries) }],
      };
    }
    if (slug === "net-income") {
      return {
        columns: [{ key: "line", label: "Line" }, { key: "amount", label: "Amount", align: "right" }],
        rows: [
          ...incomeLines,
          { line: "Total Income", amount: money(income) },
          { line: "Expenses", amount: money(-expenses) },
          { line: "Salaries", amount: money(-salaries) },
          ...(debtRepaid > 0
            ? [{ line: "Debt Repayments", amount: money(-debtRepaid) }]
            : []),
          { line: "Net Income", amount: money(net) },
        ],
        summary: [{ label: "Net Income", value: money(net) }],
      };
    }

    // "monthly-statement" — the full statement.
    return {
      columns: [{ key: "line", label: "Line" }, { key: "amount", label: "Amount", align: "right" }],
      rows: [
        ...incomeLines,
        { line: "Expenses", amount: money(-expenses) },
        { line: "Salaries", amount: money(-salaries) },
        { line: "Net Income", amount: money(net) },
      ],
      summary: [
        { label: "Income", value: money(income) },
        { label: "Outflow", value: money(expenses + salaries) },
        { label: "Net Income", value: money(net) },
      ],
    };
  }
}
