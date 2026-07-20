import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { ReportData } from "./fee-reports.service";

export interface FinancialReportFilters {
  month?: string;
}

const money = (n: number) => `$${n.toFixed(2)}`;

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

    const { income, expenses, salaries } = await this.prisma.forTenant(
      schoolId,
      async (tx) => {
        const [paySum, expSum, salSum] = await Promise.all([
          tx.payment.aggregate({
            where: range ? { paidAt: range } : {},
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
            _sum: { amount: true },
          }),
        ]);
        return {
          income: paySum._sum.amount ?? 0,
          expenses: expSum._sum.amount ?? 0,
          salaries: salSum._sum.amount ?? 0,
        };
      },
    );

    const net = income - expenses - salaries;

    if (slug === "income") {
      return {
        columns: [{ key: "line", label: "Line" }, { key: "amount", label: "Amount", align: "right" }],
        rows: [{ line: "Fee Collections", amount: money(income) }],
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
          { line: "Income", amount: money(income) },
          { line: "Expenses", amount: money(-expenses) },
          { line: "Salaries", amount: money(-salaries) },
          { line: "Net Income", amount: money(net) },
        ],
        summary: [{ label: "Net Income", value: money(net) }],
      };
    }

    // "monthly-statement" — the full statement.
    return {
      columns: [{ key: "line", label: "Line" }, { key: "amount", label: "Amount", align: "right" }],
      rows: [
        { line: "Fee Collections", amount: money(income) },
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
