import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { ReportData } from "./fee-reports.service";

export interface SalaryReportFilters {
  month?: string;
  shift?: string;
  status?: string;
}

const money = (n: number) => `$${n.toFixed(2)}`;

/** "2026-07" → { year: 2026, month: 7 }. */
function parseMonth(value?: string): { year: number; month: number } | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})$/.exec(value);
  if (!m) return null;
  return { year: Number(m[1]), month: Number(m[2]) };
}

/**
 * Salary reports, computed from the database rather than the browser's salary
 * store (which only ever held whichever month the salary page had loaded).
 */
@Injectable()
export class SalaryReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async build(
    schoolId: string,
    slug: string,
    filters: SalaryReportFilters,
  ): Promise<ReportData> {
    switch (slug) {
      case "outstanding":
        return this.list(schoolId, { ...filters, status: "PENDING" });
      case "monthly":
      case "annual":
      case "teacher":
      default:
        return this.list(schoolId, filters);
    }
  }

  private async list(
    schoolId: string,
    filters: SalaryReportFilters,
  ): Promise<ReportData> {
    const period = parseMonth(filters.month);
    const where: Prisma.SalaryWhereInput = {
      ...(period ? { year: period.year, month: period.month } : {}),
      ...(filters.status
        ? { status: filters.status as Prisma.SalaryWhereInput["status"] }
        : {}),
    };

    const salaries = await this.prisma.forTenant(schoolId, (tx) =>
      tx.salary.findMany({
        where,
        orderBy: [{ year: "desc" }, { month: "desc" }, { employeeName: "asc" }],
        select: {
          employeeName: true,
          position: true,
          amount: true,
          year: true,
          month: true,
          status: true,
          paidAt: true,
        },
      }),
    );

    return {
      columns: [
        { key: "name", label: "Employee" },
        { key: "position", label: "Position" },
        { key: "period", label: "Period" },
        { key: "amount", label: "Amount", align: "right" },
        { key: "status", label: "Status" },
        { key: "paidAt", label: "Paid" },
      ],
      rows: salaries.map((s) => ({
        name: s.employeeName,
        position: s.position ?? "",
        period: `${s.year}-${String(s.month).padStart(2, "0")}`,
        amount: money(s.amount),
        status: s.status,
        paidAt: s.paidAt ? s.paidAt.toISOString().slice(0, 10) : "—",
      })),
      summary: [
        { label: "Records", value: String(salaries.length) },
        { label: "Total", value: money(salaries.reduce((sum, s) => sum + s.amount, 0)) },
        {
          label: "Paid",
          value: money(
            salaries.filter((s) => s.status === "PAID").reduce((sum, s) => sum + s.amount, 0),
          ),
        },
      ],
    };
  }
}
