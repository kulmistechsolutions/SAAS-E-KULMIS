import { Injectable } from "@nestjs/common";
import { formatMoney } from "@ekulmis/shared";
import { PrismaService } from "../prisma/prisma.service";
import { BalanceEngineService } from "../finance/balance-engine.service";
import { parseDateFrom, parseDateTo } from "../common/date-range.util";

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly balanceEngine: BalanceEngineService,
  ) {}

  async build(
    schoolId: string,
    slug: string,
    filters: FeeReportFilters,
  ): Promise<ReportData> {
    const school = await this.prisma.school.findFirst({
      where: { id: schoolId },
      select: { currency: true },
    });
    const money = (n: number) => formatMoney(n, school?.currency);
    switch (slug) {
      case "monthly-collections":
      case "daily-collections":
      case "by-class":
      case "by-section":
        return this.collections(schoolId, slug, filters, money);
      case "outstanding":
      case "partial":
      case "advance":
      case "academic-year-summary":
        return this.balances(schoolId, slug, filters, money);
      case "discounts":
      case "waivers":
        return this.adjustmentsReport(schoolId, slug, filters, money);
      case "payment-methods":
        return this.paymentMethods(schoolId, filters, money);
      case "reconciliation":
        return this.reconciliation(schoolId, money);
      default:
        return this.balances(schoolId, "outstanding", filters, money);
    }
  }

  /** Students who owe money, have paid partly, or are paid ahead. */
  private async balances(
    schoolId: string,
    slug: string,
    filters: FeeReportFilters,
    money: (n: number) => string,
  ): Promise<ReportData> {
    // The engine's positions, not a third reading of the same tables. Summing
    // every charge as "due" counted months that have not arrived and charges
    // the school had withdrawn, and summing every payment against that total
    // ignored which charge each one settled — so the Outstanding report and
    // the dashboard quoted different debts for the same school.
    const positions = await this.balanceEngine.allPositions(schoolId);
    const search = filters.search?.trim().toLowerCase();
    const rows = positions
      .filter((p) => {
        if (filters.className && p.className !== filters.className) return false;
        if (filters.section && (p.section ?? "") !== filters.section) return false;
        if (
          search &&
          !p.fullName.toLowerCase().includes(search) &&
          !p.code.toLowerCase().includes(search)
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => a.code.localeCompare(b.code))
      .map((p) => ({
        student: {
          id: p.studentId,
          code: p.code,
          fullName: p.fullName,
          class: p.className ? { name: p.className } : null,
          section: p.section ? { name: p.section } : null,
        },
        due: p.expected,
        got: p.paid,
        // Negative means paid ahead — which is what the advance report looks
        // for, and the engine tracks separately rather than as a debt.
        balance: p.advance > 0 && p.outstanding === 0 ? -p.advance : p.outstanding,
      }));

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
    money: (n: number) => string,
  ): Promise<ReportData> {
    const payments = await this.prisma.forTenant(schoolId, (tx) =>
      tx.payment.findMany({
        where: {
          ...(filters.dateFrom || filters.dateTo
            ? {
                paidAt: {
                  ...(filters.dateFrom ? { gte: parseDateFrom(filters.dateFrom) } : {}),
                  ...(filters.dateTo ? { lte: parseDateTo(filters.dateTo) } : {}),
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

  /**
   * Who was charged less than the fee said, and why.
   *
   * A discount that leaves no report is a discount nobody can audit: it looks
   * identical to a fee typed in wrong, which is exactly the ambiguity that
   * made one school's seven students unreadable.
   */
  private async adjustmentsReport(
    schoolId: string,
    slug: string,
    filters: FeeReportFilters,
    money: (n: number) => string,
  ): Promise<ReportData> {
    const rows = await this.prisma.forTenant(schoolId, (tx) =>
      tx.feeAdjustment.findMany({
        where: {
          ...(slug === "waivers" ? { type: "WAIVER" } : { type: { in: ["DISCOUNT", "ADJUSTMENT"] } }),
          ...(filters.className || filters.section || filters.search
            ? {
                student: {
                  ...(filters.className ? { class: { name: filters.className } } : {}),
                  ...(filters.section ? { section: { name: filters.section } } : {}),
                  ...(filters.search
                    ? {
                        OR: [
                          { fullName: { contains: filters.search, mode: "insensitive" as const } },
                          { code: { contains: filters.search, mode: "insensitive" as const } },
                        ],
                      }
                    : {}),
                },
              }
            : {}),
        },
        orderBy: { createdAt: "desc" },
        include: {
          student: {
            select: { code: true, fullName: true, class: { select: { name: true } } },
          },
          feeCharge: { select: { year: true, month: true, kind: true, label: true } },
        },
      }),
    );

    const total = rows.reduce((n, r) => n + r.amount, 0);
    return {
      columns: [
        { key: "code", label: "Student ID" },
        { key: "name", label: "Name" },
        { key: "className", label: "Class" },
        { key: "period", label: "Applied to" },
        { key: "type", label: "Type" },
        { key: "original", label: "Was", align: "right" },
        { key: "amount", label: "Taken off", align: "right" },
        { key: "now", label: "Now", align: "right" },
        { key: "reason", label: "Reason" },
        { key: "by", label: "By" },
        { key: "date", label: "Date" },
      ],
      rows: rows.map((r) => ({
        code: r.student.code,
        name: r.student.fullName,
        className: r.student.class?.name ?? "",
        period:
          r.feeCharge.kind === "MONTHLY" || !r.feeCharge.label
            ? `${r.feeCharge.year}-${String(r.feeCharge.month).padStart(2, "0")}`
            : r.feeCharge.label,
        type: r.type,
        original: money(r.originalAmount),
        amount: money(r.amount),
        now: money(r.originalAmount - r.amount),
        reason: r.reason,
        by: r.createdByUsername ?? "",
        date: r.createdAt.toISOString().slice(0, 10),
      })),
      summary: [
        { label: slug === "waivers" ? "Waivers" : "Discounts", value: String(rows.length) },
        { label: "Total given up", value: money(total) },
      ],
    };
  }

  /** What money arrived through which channel — cash, EVC, bank and the rest. */
  private async paymentMethods(
    schoolId: string,
    filters: FeeReportFilters,
    money: (n: number) => string,
  ): Promise<ReportData> {
    const from = filters.dateFrom ? new Date(filters.dateFrom) : undefined;
    const to = filters.dateTo ? new Date(filters.dateTo) : undefined;
    if (to) to.setUTCHours(23, 59, 59, 999);

    const rows = await this.prisma.forTenant(schoolId, (tx) =>
      tx.payment.groupBy({
        by: ["method"],
        where: {
          status: "ACTIVE",
          ...(from || to ? { paidAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
        },
        _sum: { amount: true },
        _count: { _all: true },
      }),
    );

    const total = rows.reduce((n, r) => n + Number(r._sum.amount ?? 0), 0);
    return {
      columns: [
        { key: "method", label: "Method" },
        { key: "count", label: "Payments", align: "right" },
        { key: "amount", label: "Collected", align: "right" },
        { key: "share", label: "Share", align: "right" },
      ],
      rows: rows
        .map((r) => ({
          method: r.method || "Unrecorded",
          count: String(r._count._all),
          amount: money(Number(r._sum.amount ?? 0)),
          share: total > 0
            ? `${Math.round((Number(r._sum.amount ?? 0) / total) * 1000) / 10}%`
            : "—",
          _sort: Number(r._sum.amount ?? 0),
        }))
        .sort((a, b) => b._sort - a._sort)
        .map(({ _sort, ...rest }) => rest),
      summary: [
        { label: "Methods used", value: String(rows.length) },
        { label: "Collected", value: money(total) },
      ],
    };
  }

  /**
   * The school's money in one place: billed, collected, owed, paid ahead.
   *
   * All four from the engine, so they add up against each other. Management
   * asking "why does the bank hold less than the reports say" needs the parts
   * to be the same arithmetic, not four screens each doing their own.
   */
  private async reconciliation(
    schoolId: string,
    money: (n: number) => string,
  ): Promise<ReportData> {
    const pos = await this.balanceEngine.schoolPosition(schoolId);
    const rows = [
      { item: "Expected — due to date", amount: money(pos.expected), note: "Every period up to and including the month being collected" },
      { item: "Collected — against what is due", amount: money(pos.collected), note: "Payments matched to due charges" },
      { item: "Outstanding", amount: money(pos.outstanding), note: "Due, unsettled" },
      { item: "Paid ahead", amount: money(pos.advance), note: "Received for months not yet due — not income for this month" },
      { item: "Credit", amount: money(pos.credit), note: "Paid beyond what a charge asked, usually after a fee was lowered" },
      { item: "Collected this month", amount: money(pos.collectedThisMonth), note: "Every payment banked in the live month, due or ahead" },
      { item: "Expected this month", amount: money(pos.expectedThisMonth), note: "The live month's own billing, arrears excluded" },
    ];
    return {
      columns: [
        { key: "item", label: "Item" },
        { key: "amount", label: "Amount", align: "right" },
        { key: "note", label: "What it means" },
      ],
      rows,
      summary: [
        { label: "Live month", value: pos.liveMonth.monthKey },
        { label: "Students", value: String(pos.students.total) },
        { label: "Collection rate", value: pos.collectionRate != null ? `${pos.collectionRate}%` : "—" },
      ],
    };
  }
}
