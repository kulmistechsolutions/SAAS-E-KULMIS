import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

interface MonthBucket {
  label: string;
  year: number;
  month: number;
}

function lastSixMonths(): MonthBucket[] {
  const now = new Date();
  const names = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const out: MonthBucket[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    out.push({
      label: names[d.getUTCMonth()]!,
      year: d.getUTCFullYear(),
      month: d.getUTCMonth() + 1,
    });
  }
  return out;
}

function sum<T>(rows: T[], pick: (r: T) => number): number {
  return rows.reduce((s, r) => s + pick(r), 0);
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async admin(schoolId: string) {
    const now = new Date();
    const y = now.getUTCFullYear();
    const mo = now.getUTCMonth();
    const startOfToday = new Date(Date.UTC(y, mo, now.getUTCDate()));
    const startOfMonth = new Date(Date.UTC(y, mo, 1));
    const sixMonthsAgo = new Date(Date.UTC(y, mo - 5, 1));
    const buckets = lastSixMonths();

    return this.prisma.forTenant(schoolId, async (tx) => {
      const [
        studentsByStatus,
        newStudents,
        teachersActiveByShift,
        teachersTotal,
        parentsTotal,
        classesTotal,
        sectionsTotal,
        subjectsTotal,
        attToday,
        teacherAttToday,
        outstandingCharges,
        collectedToday,
        collectedThisMonth,
        incomeAgg,
        expenseAgg,
        salaryAgg,
        partialCount,
        advanceCount,
        activeYear,
        recentPayments,
        recentAudit,
        studentsForGrowth,
        paymentsForChart,
        expensesForChart,
      ] = await Promise.all([
        tx.student.groupBy({ by: ["status"], _count: { _all: true } }),
        tx.student.count({ where: { registrationDate: { gte: startOfMonth } } }),
        tx.teacher.groupBy({
          by: ["shift"],
          where: { status: "ACTIVE" },
          _count: { _all: true },
        }),
        tx.teacher.count(),
        tx.parent.count(),
        tx.class.count(),
        tx.section.count(),
        tx.subject.count(),
        tx.studentAttendance.groupBy({
          by: ["status"],
          where: { date: startOfToday },
          _count: { _all: true },
        }),
        tx.teacherAttendance.groupBy({
          by: ["status"],
          where: { date: startOfToday },
          _count: { _all: true },
        }),
        tx.feeCharge.findMany({
          where: { status: { not: "PAID" } },
          select: { amount: true, paidAmount: true, year: true, month: true },
        }),
        tx.payment.aggregate({
          _sum: { amount: true },
          where: { paidAt: { gte: startOfToday } },
        }),
        tx.payment.aggregate({
          _sum: { amount: true },
          where: { paidAt: { gte: startOfMonth } },
        }),
        tx.payment.aggregate({ _sum: { amount: true } }),
        tx.expense.aggregate({ _sum: { amount: true } }),
        tx.salary.aggregate({
          _sum: { amount: true },
          where: { status: "PAID" },
        }),
        tx.feeCharge.count({ where: { status: "PARTIAL" } }),
        tx.payment.count({ where: { type: "ADVANCE" } }),
        tx.academicYear.findFirst({ where: { isActive: true } }),
        tx.payment.findMany({
          orderBy: { paidAt: "desc" },
          take: 8,
          include: {
            student: {
              select: {
                code: true,
                fullName: true,
                class: { select: { name: true } },
              },
            },
          },
        }),
        tx.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
        tx.student.findMany({
          where: { registrationDate: { gte: sixMonthsAgo } },
          select: { registrationDate: true },
        }),
        tx.payment.findMany({
          where: { paidAt: { gte: sixMonthsAgo } },
          select: { paidAt: true, amount: true },
        }),
        tx.expense.findMany({
          where: { spentAt: { gte: sixMonthsAgo } },
          select: { spentAt: true, amount: true },
        }),
      ]);

      const byStatus = (
        rows: { status: string; _count: { _all: number } }[],
        s: string,
      ) => rows.find((r) => r.status === s)?._count._all ?? 0;

      const totalOutstanding = sum(
        outstandingCharges,
        (c) => c.amount - c.paidAmount,
      );
      const outstandingThisMonth = sum(
        outstandingCharges.filter((c) => c.year === y && c.month === mo + 1),
        (c) => c.amount - c.paidAmount,
      );

      const totalIncome = incomeAgg._sum.amount ?? 0;
      const totalExpenses = expenseAgg._sum.amount ?? 0;
      const totalSalaries = salaryAgg._sum.amount ?? 0;

      const present = byStatus(attToday, "PRESENT");
      const absent = byStatus(attToday, "ABSENT");
      const late = byStatus(attToday, "LATE");
      const attTotal = present + absent + late + byStatus(attToday, "EXCUSED");

      // ── Charts (6-month buckets) ──
      const monthKey = (d: Date) =>
        `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}`;
      const bucketKey = (b: MonthBucket) => `${b.year}-${b.month}`;

      const studentGrowth = buckets.map((b) => ({
        label: b.label,
        value: studentsForGrowth.filter(
          (s) => monthKey(new Date(s.registrationDate)) === bucketKey(b),
        ).length,
      }));
      const feeCollection = buckets.map((b) => ({
        label: b.label,
        value: sum(
          paymentsForChart.filter(
            (p) => monthKey(new Date(p.paidAt)) === bucketKey(b),
          ),
          (p) => p.amount,
        ),
      }));
      const incomeVsExpense = buckets.map((b) => ({
        label: b.label,
        income: sum(
          paymentsForChart.filter(
            (p) => monthKey(new Date(p.paidAt)) === bucketKey(b),
          ),
          (p) => p.amount,
        ),
        expense: sum(
          expensesForChart.filter(
            (e) => monthKey(new Date(e.spentAt)) === bucketKey(b),
          ),
          (e) => e.amount,
        ),
      }));

      return {
        students: {
          total: sum(studentsByStatus, (r) => r._count._all),
          active: byStatus(studentsByStatus, "ACTIVE"),
          inactive: byStatus(studentsByStatus, "INACTIVE"),
          graduated: byStatus(studentsByStatus, "GRADUATED"),
          newThisMonth: newStudents,
        },
        teachers: {
          total: teachersTotal,
          morning: teachersActiveByShift.find((s) => s.shift === "MORNING")
            ?._count._all ?? 0,
          afternoon: teachersActiveByShift.find((s) => s.shift === "AFTERNOON")
            ?._count._all ?? 0,
        },
        parents: { total: parentsTotal },
        academics: {
          classes: classesTotal,
          sections: sectionsTotal,
          subjects: subjectsTotal,
        },
        attendanceToday: {
          present,
          absent,
          late,
          total: attTotal,
          percentage: attTotal
            ? Math.round(((present + late) / attTotal) * 100)
            : 0,
        },
        teacherAttendanceToday: {
          present: byStatus(teacherAttToday, "PRESENT"),
          absent: byStatus(teacherAttToday, "ABSENT"),
        },
        fees: {
          totalOutstanding,
          outstandingThisMonth,
          collectedToday: collectedToday._sum.amount ?? 0,
          collectedThisMonth: collectedThisMonth._sum.amount ?? 0,
          partialPayments: partialCount,
          advancePayments: advanceCount,
        },
        finance: {
          totalIncome,
          totalExpenses,
          totalSalaries,
          netIncome: totalIncome - totalExpenses - totalSalaries,
        },
        activeAcademicYear: activeYear?.name ?? null,
        charts: { studentGrowth, feeCollection, incomeVsExpense },
        recentPayments: recentPayments.map((p) => ({
          id: p.id,
          receiptNumber: p.receiptNumber,
          student: p.student.fullName,
          studentCode: p.student.code,
          className: p.student.class?.name ?? null,
          amount: p.amount,
          type: p.type,
          paidAt: p.paidAt,
        })),
        recentActivities: recentAudit.map((a) => ({
          id: a.id,
          module: a.module,
          action: a.action,
          username: a.username,
          createdAt: a.createdAt,
        })),
      };
    });
  }
}
