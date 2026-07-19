import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export interface ReportColumn {
  key: string;
  label: string;
  align?: "right";
  mono?: boolean;
}

export interface ReportData {
  columns: ReportColumn[];
  rows: Record<string, string | number>[];
  summary: { label: string; value: string }[];
}

export interface FeeReportFilters {
  academicYearId?: string;
  className?: string;
  section?: string;
  month?: string;
  dateFrom?: string;
  dateTo?: string;
  paymentStatus?: string;
  search?: string;
}

const money = (n: number) => `$${n.toFixed(2)}`;

/**
 * Fee reports, computed from the database.
 *
 * These used to be built in the browser from whatever the fee pages happened to
 * have loaded into their client store, which meant opening a report directly
 * showed an empty or half-complete list — the report was only ever as good as
 * the page you had visited first. Reading straight from the database is the
 * point of this service: a report is now a question asked of the school's real
 * data, not of one browser tab's memory.
 */
@Injectable()
export class FeeReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async build(
    schoolId: string,
    slug: string,
    filters: FeeReportFilters,
  ): Promise<ReportData> {
    switch (slug) {
      case "monthly-collections":
      case "daily-collections":
      case "by-class":
      case "by-section":
        return this.collections(schoolId, slug, filters);
      case "outstanding":
      case "partial":
      case "advance":
      case "academic-year-summary":
        return this.balances(schoolId, slug, filters);
      default:
        return this.balances(schoolId, "outstanding", filters);
    }
  }

  /** Students who owe money, have paid partly, or are paid ahead. */
  private async balances(
    schoolId: string,
    slug: string,
    filters: FeeReportFilters,
  ): Promise<ReportData> {
    const rows = await this.prisma.forTenant(schoolId, async (tx) => {
      const students = await tx.student.findMany({
        where: {
          status: "ACTIVE",
          ...(filters.className ? { class: { name: filters.className } } : {}),
          ...(filters.section ? { section: { name: filters.section } } : {}),
          ...(filters.search
            ? {
                OR: [
                  { fullName: { contains: filters.search, mode: "insensitive" } },
                  { code: { contains: filters.search, mode: "insensitive" } },
                ],
              }
            : {}),
        },
        orderBy: [{ code: "asc" }],
        select: {
          id: true,
          code: true,
          fullName: true,
          class: { select: { name: true } },
          section: { select: { name: true } },
        },
      });
      if (students.length === 0) return [];

      const ids = students.map((s) => s.id);
      // Two grouped queries rather than a per-student loop: a whole school is
      // thousands of students, and this database sits behind a slow pooler.
      const [charged, paid] = await Promise.all([
        tx.feeCharge.groupBy({
          by: ["studentId"],
          where: { studentId: { in: ids } },
          _sum: { amount: true },
        }),
        tx.payment.groupBy({
          by: ["studentId"],
          where: { studentId: { in: ids } },
          _sum: { amount: true },
        }),
      ]);
      const chargedBy = new Map(
        charged.map((c) => [c.studentId, Number(c._sum.amount ?? 0)]),
      );
      const paidBy = new Map(paid.map((p) => [p.studentId, Number(p._sum.amount ?? 0)]));

      return students.map((s) => {
        const due = chargedBy.get(s.id) ?? 0;
        const got = paidBy.get(s.id) ?? 0;
        return {
          student: s,
          due,
          got,
          balance: due - got,
        };
      });
    });

    // "Partial" means some money has arrived but not all of it; "advance" means
    // more has arrived than has been billed. Both are states a school chases,
    // so they are worth separating rather than lumping into one balance list.
    const filtered = rows.filter((r) => {
      if (slug === "outstanding") return r.balance > 0;
      if (slug === "partial") return r.got > 0 && r.balance > 0;
      if (slug === "advance") return r.balance < 0;
      return true;
    });

    return {
      columns: [
        { key: "code", label: "Student ID", mono: true },
        { key: "name", label: "Student" },
        { key: "className", label: "Class" },
        { key: "section", label: "Section" },
        { key: "charged", label: "Charged", align: "right" },
        { key: "paid", label: "Paid", align: "right" },
        { key: "balance", label: "Balance", align: "right" },
      ],
      rows: filtered.map((r) => ({
        code: r.student.code,
        name: r.student.fullName,
        className: r.student.class?.name ?? "",
        section: r.student.section?.name ?? "",
        charged: money(r.due),
        paid: money(r.got),
        balance: money(r.balance),
      })),
      summary: [
        { label: "Students", value: String(filtered.length) },
        {
          label: "Charged",
          value: money(filtered.reduce((s, r) => s + r.due, 0)),
        },
        { label: "Paid", value: money(filtered.reduce((s, r) => s + r.got, 0)) },
        {
          label: slug === "advance" ? "In advance" : "Outstanding",
          value: money(
            Math.abs(filtered.reduce((s, r) => s + r.balance, 0)),
          ),
        },
      ],
    };
  }

  /** Money actually collected, listed or grouped. */
  private async collections(
    schoolId: string,
    slug: string,
    filters: FeeReportFilters,
  ): Promise<ReportData> {
    const payments = await this.prisma.forTenant(schoolId, (tx) =>
      tx.payment.findMany({
        where: {
          ...(filters.dateFrom || filters.dateTo
            ? {
                paidAt: {
                  ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
                  ...(filters.dateTo ? { lte: new Date(`${filters.dateTo}T23:59:59`) } : {}),
                },
              }
            : {}),
          ...(filters.className || filters.section
            ? {
                student: {
                  ...(filters.className ? { class: { name: filters.className } } : {}),
                  ...(filters.section ? { section: { name: filters.section } } : {}),
                },
              }
            : {}),
        },
        orderBy: { paidAt: "desc" },
        select: {
          receiptNumber: true,
          amount: true,
          type: true,
          paidAt: true,
          student: {
            select: {
              code: true,
              fullName: true,
              class: { select: { name: true } },
              section: { select: { name: true } },
            },
          },
        },
      }),
    );

    const total = payments.reduce((s, p) => s + Number(p.amount), 0);

    if (slug === "by-class" || slug === "by-section") {
      const groups = new Map<string, { count: number; total: number }>();
      for (const p of payments) {
        const key =
          slug === "by-class"
            ? (p.student.class?.name ?? "—")
            : `${p.student.class?.name ?? "—"} ${p.student.section?.name ?? ""}`.trim();
        const g = groups.get(key) ?? { count: 0, total: 0 };
        g.count += 1;
        g.total += Number(p.amount);
        groups.set(key, g);
      }
      return {
        columns: [
          { key: "group", label: slug === "by-class" ? "Class" : "Section" },
          { key: "count", label: "Payments", align: "right" },
          { key: "total", label: "Collected", align: "right" },
        ],
        rows: [...groups.entries()]
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([group, g]) => ({
            group,
            count: g.count,
            total: money(g.total),
          })),
        summary: [
          { label: "Groups", value: String(groups.size) },
          { label: "Payments", value: String(payments.length) },
          { label: "Collected", value: money(total) },
        ],
      };
    }

    return {
      columns: [
        { key: "receipt", label: "Receipt", mono: true },
        { key: "code", label: "Student ID", mono: true },
        { key: "name", label: "Student" },
        { key: "className", label: "Class" },
        { key: "amount", label: "Amount", align: "right" },
        { key: "type", label: "Type" },
        { key: "date", label: "Date" },
      ],
      rows: payments.map((p) => ({
        receipt: p.receiptNumber,
        code: p.student.code,
        name: p.student.fullName,
        className: p.student.class?.name ?? "",
        amount: money(Number(p.amount)),
        type: p.type,
        date: p.paidAt.toISOString().slice(0, 10),
      })),
      summary: [
        { label: "Payments", value: String(payments.length) },
        { label: "Collected", value: money(total) },
      ],
    };
  }
}
