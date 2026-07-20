import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { ReportData } from "./fee-reports.service";

export interface ExpenseReportFilters {
  dateFrom?: string;
  dateTo?: string;
  month?: string;
  category?: string;
}

const money = (n: number) => `$${n.toFixed(2)}`;

/**
 * Expense reports, computed from the database rather than the browser's
 * expenses store (which only held whichever period the expenses page had
 * loaded).
 */
@Injectable()
export class ExpenseReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async build(
    schoolId: string,
    slug: string,
    filters: ExpenseReportFilters,
  ): Promise<ReportData> {
    if (slug === "categories") return this.byCategory(schoolId, filters);
    return this.list(schoolId, filters);
  }

  private dateRange(filters: ExpenseReportFilters): Prisma.ExpenseWhereInput {
    if (filters.month) {
      const m = /^(\d{4})-(\d{2})$/.exec(filters.month);
      if (m) {
        const year = Number(m[1]);
        const month = Number(m[2]);
        return {
          spentAt: {
            gte: new Date(Date.UTC(year, month - 1, 1)),
            lt: new Date(Date.UTC(month === 12 ? year + 1 : year, month % 12, 1)),
          },
        };
      }
    }
    if (filters.dateFrom || filters.dateTo) {
      return {
        spentAt: {
          ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
          ...(filters.dateTo ? { lte: new Date(`${filters.dateTo}T23:59:59`) } : {}),
        },
      };
    }
    return {};
  }

  private async list(
    schoolId: string,
    filters: ExpenseReportFilters,
  ): Promise<ReportData> {
    const expenses = await this.prisma.forTenant(schoolId, (tx) =>
      tx.expense.findMany({
        where: {
          ...this.dateRange(filters),
          ...(filters.category ? { category: { name: filters.category } } : {}),
        },
        orderBy: { spentAt: "desc" },
        select: {
          title: true,
          amount: true,
          method: true,
          spentAt: true,
          category: { select: { name: true } },
        },
      }),
    );

    return {
      columns: [
        { key: "title", label: "Expense" },
        { key: "category", label: "Category" },
        { key: "amount", label: "Amount", align: "right" },
        { key: "method", label: "Method" },
        { key: "date", label: "Date" },
      ],
      rows: expenses.map((e) => ({
        title: e.title,
        category: e.category?.name ?? "Uncategorised",
        amount: money(e.amount),
        method: e.method ?? "",
        date: e.spentAt.toISOString().slice(0, 10),
      })),
      summary: [
        { label: "Records", value: String(expenses.length) },
        { label: "Total", value: money(expenses.reduce((s, e) => s + e.amount, 0)) },
      ],
    };
  }

  private async byCategory(
    schoolId: string,
    filters: ExpenseReportFilters,
  ): Promise<ReportData> {
    const expenses = await this.prisma.forTenant(schoolId, (tx) =>
      tx.expense.findMany({
        where: this.dateRange(filters),
        select: { amount: true, category: { select: { name: true } } },
      }),
    );
    const groups = new Map<string, { count: number; total: number }>();
    for (const e of expenses) {
      const key = e.category?.name ?? "Uncategorised";
      const g = groups.get(key) ?? { count: 0, total: 0 };
      g.count += 1;
      g.total += e.amount;
      groups.set(key, g);
    }
    return {
      columns: [
        { key: "category", label: "Category" },
        { key: "count", label: "Expenses", align: "right" },
        { key: "total", label: "Total", align: "right" },
      ],
      rows: [...groups.entries()]
        .sort((a, b) => b[1].total - a[1].total)
        .map(([category, g]) => ({
          category,
          count: g.count,
          total: money(g.total),
        })),
      summary: [
        { label: "Categories", value: String(groups.size) },
        { label: "Total", value: money(expenses.reduce((s, e) => s + e.amount, 0)) },
      ],
    };
  }
}
