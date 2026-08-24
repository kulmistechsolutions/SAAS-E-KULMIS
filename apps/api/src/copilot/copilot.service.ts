import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

/**
 * School Copilot — the reading half.
 *
 * Everything here is a SELECT. It writes nothing, changes nothing, and adds no
 * table of its own: a school's numbers are already in the system, scattered
 * across the modules that produced them, and the work is putting them in one
 * place so somebody can see the school at a glance.
 *
 * Runs through `forTenant`, so a school sees its own data and the database
 * enforces that rather than this code being trusted to remember.
 *
 * Aggregation happens in SQL. Reading rows and counting them in JS is what
 * times out against the pooler once a school has a few hundred students.
 */

export interface CopilotOverview {
  period: { month: string; from: string; to: string; academicYear: string | null };
  students: { total: number; male: number; female: number; newThisMonth: number };
  staff: { teachers: number; parents: number };
  academics: { classes: number; sections: number; exams: number };
  attendance: {
    todayPresent: number;
    todayAbsent: number;
    todayLate: number;
    monthRate: number | null;
    previousMonthRate: number | null;
  };
  teacherAttendance: { present: number; absent: number; rate: number | null };
  fees: {
    expectedThisMonth: number;
    collectedThisMonth: number;
    collectedToday: number;
    outstanding: number;
    collectionRate: number | null;
  };
  finance: {
    feeIncome: number;
    otherIncome: number;
    totalIncome: number;
    salaries: number;
    expenses: number;
    netIncome: number;
  };
  quiz: { attempts: number; averagePercent: number | null; passRate: number | null };
}

interface RankedStudent {
  studentId: string;
  code: string;
  name: string;
  className: string | null;
  value: number;
}

@Injectable()
export class CopilotService {
  constructor(private readonly prisma: PrismaService) {}

  /** `YYYY-MM` → the half-open range covering it. */
  private monthRange(month: string) {
    const [y, m] = month.split("-").map(Number) as [number, number];
    return {
      year: y,
      month: m,
      start: new Date(Date.UTC(y, m - 1, 1)),
      end: new Date(Date.UTC(y, m, 1)),
      prevStart: new Date(Date.UTC(y, m - 2, 1)),
      prevEnd: new Date(Date.UTC(y, m - 1, 1)),
    };
  }

  private static thisMonth(): string {
    const d = new Date();
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  }

  private rate(part: number, whole: number): number | null {
    if (whole <= 0) return null;
    return Math.round((part / whole) * 1000) / 10;
  }

  async overview(schoolId: string, month?: string): Promise<CopilotOverview> {
    const key = month && /^\d{4}-\d{2}$/.test(month) ? month : CopilotService.thisMonth();
    const r = this.monthRange(key);
    const startOfToday = new Date();
    startOfToday.setUTCHours(0, 0, 0, 0);

    return this.prisma.forTenant(
      schoolId,
      async (tx) => {
        const activeYear = await tx.academicYear.findFirst({
          where: { isActive: true },
          select: { id: true, name: true },
        });
        // Only students sitting in the current year count as the school's roll.
        const inYear = activeYear
          ? { class: { academicYearId: activeYear.id } }
          : {};

        const [
          byGender,
          newThisMonth,
          teachers,
          parents,
          classes,
          sections,
          exams,
          attToday,
          attMonth,
          attPrev,
          teacherAttMonth,
          chargesMonth,
          paidMonth,
          paidToday,
          outstandingAgg,
          expenseAgg,
          salaryAgg,
          otherIncomeAgg,
          quizAgg,
          quizPass,
        ] = await Promise.all([
          tx.student.groupBy({
            by: ["gender"],
            where: { status: "ACTIVE", ...inYear },
            _count: { _all: true },
          }),
          tx.student.count({
            where: { status: "ACTIVE", ...inYear, registrationDate: { gte: r.start, lt: r.end } },
          }),
          tx.teacher.count({ where: { status: "ACTIVE" } }),
          tx.parent.count({ where: { status: "ACTIVE" } }),
          activeYear
            ? tx.class.count({ where: { academicYearId: activeYear.id } })
            : tx.class.count(),
          tx.section.count(),
          tx.exam.count(),
          tx.studentAttendance.groupBy({
            by: ["status"],
            where: { date: startOfToday },
            _count: { _all: true },
          }),
          tx.studentAttendance.groupBy({
            by: ["status"],
            where: { date: { gte: r.start, lt: r.end } },
            _count: { _all: true },
          }),
          tx.studentAttendance.groupBy({
            by: ["status"],
            where: { date: { gte: r.prevStart, lt: r.prevEnd } },
            _count: { _all: true },
          }),
          tx.teacherAttendance.groupBy({
            by: ["status"],
            where: { date: { gte: r.start, lt: r.end } },
            _count: { _all: true },
          }),
          tx.feeCharge.aggregate({
            where: { year: r.year, month: r.month, kind: "MONTHLY" },
            _sum: { amount: true },
          }),
          tx.payment.aggregate({
            where: { paidAt: { gte: r.start, lt: r.end } },
            _sum: { amount: true },
          }),
          tx.payment.aggregate({
            where: { paidAt: { gte: startOfToday } },
            _sum: { amount: true },
          }),
          tx.feeCharge.aggregate({
            where: { status: { not: "PAID" } },
            _sum: { amount: true, paidAmount: true },
          }),
          tx.expense.aggregate({
            where: { spentAt: { gte: r.start, lt: r.end } },
            _sum: { amount: true },
          }),
          tx.salary.aggregate({
            where: { year: r.year, month: r.month },
            _sum: { amountPaid: true },
          }),
          tx.otherIncome.aggregate({
            where: { receivedAt: { gte: r.start, lt: r.end } },
            _sum: { amount: true },
          }),
          tx.quizAttempt.aggregate({
            where: { status: "GRADED" },
            _count: { _all: true },
            _avg: { percentage: true },
          }),
          tx.quizAttempt.count({ where: { status: "GRADED", result: "PASS" } }),
        ]);

        const g = (v: string) =>
          byGender.find((x) => x.gender === v)?._count._all ?? 0;
        const att = (
          rows: { status: string; _count: { _all: number } }[],
          s: string,
        ) => rows.find((x) => x.status === s)?._count._all ?? 0;
        const attendanceRate = (
          rows: { status: string; _count: { _all: number } }[],
        ) => {
          const present = att(rows, "PRESENT") + att(rows, "LATE");
          const total = present + att(rows, "ABSENT") + att(rows, "EXCUSED");
          return this.rate(present, total);
        };

        const feeIncome = paidMonth._sum.amount ?? 0;
        const otherIncome = otherIncomeAgg._sum.amount ?? 0;
        const salaries = salaryAgg._sum.amountPaid ?? 0;
        const expenses = expenseAgg._sum.amount ?? 0;
        const expected = chargesMonth._sum.amount ?? 0;
        const tPresent = att(teacherAttMonth, "PRESENT") + att(teacherAttMonth, "LATE");
        const tAbsent = att(teacherAttMonth, "ABSENT");

        return {
          period: {
            month: key,
            from: r.start.toISOString().slice(0, 10),
            to: new Date(r.end.getTime() - 1).toISOString().slice(0, 10),
            academicYear: activeYear?.name ?? null,
          },
          students: {
            total: byGender.reduce((s, x) => s + x._count._all, 0),
            male: g("MALE"),
            female: g("FEMALE"),
            newThisMonth,
          },
          staff: { teachers, parents },
          academics: { classes, sections, exams },
          attendance: {
            todayPresent: att(attToday, "PRESENT"),
            todayAbsent: att(attToday, "ABSENT"),
            todayLate: att(attToday, "LATE"),
            monthRate: attendanceRate(attMonth),
            previousMonthRate: attendanceRate(attPrev),
          },
          teacherAttendance: {
            present: tPresent,
            absent: tAbsent,
            rate: this.rate(tPresent, tPresent + tAbsent),
          },
          fees: {
            expectedThisMonth: expected,
            collectedThisMonth: feeIncome,
            collectedToday: paidToday._sum.amount ?? 0,
            outstanding:
              (outstandingAgg._sum.amount ?? 0) - (outstandingAgg._sum.paidAmount ?? 0),
            collectionRate: this.rate(feeIncome, expected),
          },
          finance: {
            feeIncome,
            otherIncome,
            totalIncome: feeIncome + otherIncome,
            salaries,
            expenses,
            netIncome: feeIncome + otherIncome - salaries - expenses,
          },
          quiz: {
            attempts: quizAgg._count._all,
            averagePercent:
              quizAgg._avg.percentage != null
                ? Math.round(quizAgg._avg.percentage * 10) / 10
                : null,
            passRate: this.rate(quizPass, quizAgg._count._all),
          },
        };
      },
      { timeout: 60_000, maxWait: 30_000 },
    );
  }

  /**
   * Who is doing well and who needs attention, by exam average.
   *
   * A student with one mark in one subject is not "top of the school", so a
   * ranking needs a floor — anyone below it is reported as unranked rather
   * than quietly mixed in with students who sat everything.
   */
  async students(
    schoolId: string,
    opts: { limit?: number; minMarks?: number } = {},
  ) {
    const limit = Math.min(Math.max(opts.limit ?? 10, 1), 50);
    const minMarks = opts.minMarks ?? 3;

    return this.prisma.forTenant(schoolId, async (tx) => {
      const grouped = await tx.examMark.groupBy({
        by: ["studentId"],
        where: { marks: { not: null } },
        _avg: { marks: true },
        _count: { _all: true },
      });

      const eligible = grouped.filter((g) => g._count._all >= minMarks);
      const rank = (dir: 1 | -1) =>
        [...eligible]
          .sort((a, b) => dir * ((b._avg.marks ?? 0) - (a._avg.marks ?? 0)))
          .slice(0, limit);

      const top = rank(1);
      const bottom = rank(-1);
      const ids = [...new Set([...top, ...bottom].map((r) => r.studentId))];
      const rows = ids.length
        ? await tx.student.findMany({
            where: { id: { in: ids }, status: "ACTIVE" },
            select: {
              id: true,
              code: true,
              fullName: true,
              class: { select: { name: true } },
            },
          })
        : [];
      const byId = new Map(rows.map((s) => [s.id, s]));
      const shape = (g: (typeof eligible)[number]): RankedStudent | null => {
        const s = byId.get(g.studentId);
        if (!s) return null;
        return {
          studentId: s.id,
          code: s.code,
          name: s.fullName,
          className: s.class?.name ?? null,
          value: Math.round((g._avg.marks ?? 0) * 10) / 10,
        };
      };

      return {
        rankedOn: `average of ${minMarks}+ recorded exam marks`,
        studentsRanked: eligible.length,
        studentsUnranked: grouped.length - eligible.length,
        top: top.map(shape).filter((x): x is RankedStudent => !!x),
        needsAttention: bottom.map(shape).filter((x): x is RankedStudent => !!x),
      };
    });
  }

  /** Students the school would want to chase, and why — one query each. */
  async risks(schoolId: string, month?: string) {
    const key = month && /^\d{4}-\d{2}$/.test(month) ? month : CopilotService.thisMonth();
    const r = this.monthRange(key);

    return this.prisma.forTenant(schoolId, async (tx) => {
      const [attendance, owing] = await Promise.all([
        // Attendance below 75% over the month, worst first.
        tx.$queryRaw<
          { code: string; name: string; className: string | null; present: bigint; total: bigint }[]
        >`
          SELECT st.code, st."fullName" AS name, c.name AS "className",
                 count(*) FILTER (WHERE sa.status IN ('PRESENT','LATE')) AS present,
                 count(*) AS total
          FROM student_attendance sa
          JOIN students st ON st.id = sa."studentId"
          LEFT JOIN classes c ON c.id = st."classId"
          WHERE sa.date >= ${r.start} AND sa.date < ${r.end} AND st.status = 'ACTIVE'
          GROUP BY st.code, st."fullName", c.name
          HAVING count(*) >= 5
             AND count(*) FILTER (WHERE sa.status IN ('PRESENT','LATE'))::numeric
                 / count(*) < 0.75
          ORDER BY 4::numeric / 5 ASC
          LIMIT 25`,
        tx.$queryRaw<
          { code: string; name: string; className: string | null; owed: number }[]
        >`
          SELECT st.code, st."fullName" AS name, c.name AS "className",
                 sum(fc.amount - fc."paidAmount")::int AS owed
          FROM fee_charges fc
          JOIN students st ON st.id = fc."studentId"
          LEFT JOIN classes c ON c.id = st."classId"
          WHERE fc.status <> 'PAID' AND st.status = 'ACTIVE'
          GROUP BY st.code, st."fullName", c.name
          HAVING sum(fc.amount - fc."paidAmount") > 0
          ORDER BY 4 DESC
          LIMIT 25`,
      ]);

      return {
        period: key,
        lowAttendance: attendance.map((a) => ({
          code: a.code,
          name: a.name,
          className: a.className,
          rate: this.rate(Number(a.present), Number(a.total)),
          daysRecorded: Number(a.total),
        })),
        owing: owing.map((o) => ({ ...o, owed: Number(o.owed) })),
      };
    });
  }
}
