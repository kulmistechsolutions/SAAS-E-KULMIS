import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { TeachersService } from "../teachers/teachers.service";
import { BalanceEngineService } from "../finance/balance-engine.service";

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly teachers: TeachersService,
    private readonly balances: BalanceEngineService,
  ) {}

  /** Teacher-scoped dashboard: only assigned classes/sections/subjects. */
  async teacher(schoolId: string, userId: string) {
    const teacher = await this.teachers.findByUserId(schoolId, userId);
    const assignments = teacher.assignments;
    const classIds = [...new Set(assignments.map((a) => a.classId))];
    const subjectIds = [...new Set(assignments.map((a) => a.subjectId))];

    const now = new Date();
    const startOfToday = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );

    return this.prisma.forTenant(schoolId, async (tx) => {
      const students =
        classIds.length === 0
          ? []
          : await tx.student.findMany({
              where: { status: "ACTIVE", classId: { in: classIds } },
              select: { id: true, classId: true, sectionId: true },
            });

      const myStudents = students.filter((s) =>
        assignments.some(
          (a) =>
            a.classId === s.classId &&
            (a.sectionId === null || a.sectionId === s.sectionId),
        ),
      );
      const studentIds = myStudents.map((s) => s.id);

      const [
        attToday,
        upcomingExams,
        activeExamsCount,
        pendingSubs,
        quizByStatus,
        activeQuizzesList,
        announcements,
        notifications,
        school,
      ] = await Promise.all([
          studentIds.length
            ? tx.studentAttendance.groupBy({
                by: ["status"],
                where: {
                  date: startOfToday,
                  studentId: { in: studentIds },
                },
                _count: { _all: true },
              })
            : Promise.resolve([] as { status: string; _count: { _all: number } }[]),
          classIds.length
            ? tx.exam.findMany({
                where: {
                  classId: { in: classIds },
                  status: { in: ["DRAFT", "OPEN", "LOCKED"] },
                  endDate: { gte: startOfToday },
                },
                orderBy: { startDate: "asc" },
                take: 8,
                include: {
                  class: { select: { name: true } },
                  section: { select: { name: true } },
                  subjects: {
                    include: { subject: { select: { id: true, name: true } } },
                  },
                },
              })
            : Promise.resolve([]),
          classIds.length
            ? tx.exam.count({
                where: {
                  classId: { in: classIds },
                  status: { in: ["OPEN", "DRAFT"] },
                },
              })
            : Promise.resolve(0),
          tx.examSubject.count({
            where: {
              teacherId: teacher.id,
              submissionStatus: "PENDING",
              exam: { status: { in: ["OPEN", "DRAFT", "LOCKED"] } },
            },
          }),
          tx.quiz.groupBy({
            by: ["status"],
            where: { teacherId: teacher.id },
            _count: { _all: true },
          }),
          tx.quiz.findMany({
            where: {
              teacherId: teacher.id,
              status: { in: ["DRAFT", "PUBLISHED"] },
            },
            orderBy: { createdAt: "desc" },
            take: 6,
            include: {
              class: { select: { name: true } },
              section: { select: { name: true } },
            },
          }),
          tx.announcement.findMany({
            orderBy: { publishedAt: "desc" },
            take: 5,
            select: {
              id: true,
              title: true,
              body: true,
              audience: true,
              publishedAt: true,
            },
          }),
          tx.notification.findMany({
            where: {
              OR: [{ userId }, { userId: null, parentId: null }],
            },
            orderBy: { createdAt: "desc" },
            take: 8,
            select: {
              id: true,
              title: true,
              body: true,
              type: true,
              readAt: true,
              createdAt: true,
            },
          }),
          tx.school.findUnique({
            where: { id: schoolId },
            select: { name: true, logoKey: true },
          }),
        ]);

      const byStatus = (rows: { status: string; _count: { _all: number } }[], s: string) =>
        rows.find((r) => r.status === s)?._count._all ?? 0;

      const present = byStatus(attToday, "PRESENT");
      const absent = byStatus(attToday, "ABSENT");
      const late = byStatus(attToday, "LATE");
      const excused = byStatus(attToday, "EXCUSED");
      const attTotal = present + absent + late + excused;

      // Only exams that touch at least one assigned subject/section
      const scopedExams = upcomingExams.filter((exam) =>
        assignments.some(
          (a) =>
            a.classId === exam.classId &&
            (a.sectionId === null ||
              exam.sectionId === null ||
              a.sectionId === exam.sectionId) &&
            exam.subjects.some((es) => es.subject.id === a.subjectId),
        ),
      );

      const uniqueClasses = new Set(assignments.map((a) => a.classId)).size;
      const uniqueSections = new Set(
        assignments.map((a) => a.sectionId ?? `all:${a.classId}`),
      ).size;
      const uniqueSubjects = new Set(assignments.map((a) => a.subjectId)).size;

      const quizCount = (status: string) =>
        quizByStatus.find((r) => r.status === status)?._count._all ?? 0;
      const activeQuizzes =
        quizCount("DRAFT") + quizCount("PUBLISHED");
      const completedQuizzes = quizCount("CLOSED") + quizCount("ARCHIVED");

      // Active exams that intersect this teacher's subjects
      const scopedActiveExamIds = new Set(
        scopedExams
          .filter((e) => e.status === "OPEN" || e.status === "DRAFT")
          .map((e) => e.id),
      );

      return {
        today: startOfToday.toISOString().slice(0, 10),
        school: {
          name: school?.name ?? "School",
          logoKey: school?.logoKey ?? null,
        },
        teacher: {
          id: teacher.id,
          code: teacher.code,
          fullName: teacher.fullName,
          shifts: teacher.shifts,
          phone: teacher.phone,
          email: teacher.email,
          gender: teacher.gender,
          status: teacher.status,
        },
        stats: {
          students: myStudents.length,
          classes: uniqueClasses,
          sections: uniqueSections,
          subjects: uniqueSubjects,
          assignments: assignments.length,
          activeExams: scopedActiveExamIds.size || activeExamsCount,
          pendingSubmissions: pendingSubs,
          activeQuizzes,
          completedQuizzes,
          quizzes: activeQuizzes + completedQuizzes,
        },
        attendanceToday: {
          present,
          absent,
          late,
          excused,
          total: attTotal,
          percentage: attTotal
            ? Math.round(((present + late) / attTotal) * 100)
            : 0,
        },
        upcomingExams: scopedExams.map((e) => ({
          id: e.id,
          name: e.name,
          className: e.class.name,
          section: e.section?.name ?? null,
          startDate: e.startDate,
          endDate: e.endDate,
          status: e.status,
          subjects: e.subjects
            .filter((s) => subjectIds.includes(s.subject.id))
            .map((s) => s.subject.name),
        })),
        activeQuizzes: activeQuizzesList.map((q) => ({
          id: q.id,
          title: q.title,
          code: q.code,
          status: q.status,
          className: q.class.name,
          section: q.section?.name ?? null,
        })),
        schedule: assignments.map((a) => ({
          id: a.id,
          academicYear: a.academicYear.name,
          className: a.class.name,
          classId: a.classId,
          section: a.section?.name ?? null,
          sectionId: a.sectionId,
          subject: a.subject.name,
          subjectId: a.subjectId,
        })),
        announcements,
        notifications,
      };
    }, { timeout: 120_000, maxWait: 45_000 });
  }

  async admin(schoolId: string) {
    // The school's money, worked out once by the engine rather than a second
    // time here. Fetched outside the transaction below because it runs its own.
    const position = await this.balances.schoolPosition(schoolId);
    const now = new Date();
    const y = now.getUTCFullYear();
    const mo = now.getUTCMonth();
    const startOfToday = new Date(Date.UTC(y, mo, now.getUTCDate()));
    const startOfMonth = new Date(Date.UTC(y, mo, 1));
    const sixMonthsAgo = new Date(Date.UTC(y, mo - 5, 1));
    const buckets = lastSixMonths();

    // Heavy aggregation over a remote pooler — allow up to 60s.
    return this.prisma.forTenant(
      schoolId,
      async (tx) => {
      // Run in small waves — the pooler has a low connection limit; flooding it
      // with 20+ parallel queries causes pool timeouts and 500 errors.
      const [studentsByStatus, newStudents, teachersActive, teachersTotal, parentsTotal] =
        await Promise.all([
          tx.student.groupBy({ by: ["status"], _count: { _all: true } }),
          tx.student.count({ where: { registrationDate: { gte: startOfMonth } } }),
          tx.teacher.count({ where: { status: "ACTIVE" } }),
          tx.teacher.count(),
          tx.parent.count(),
        ]);

      const [classesTotal, sectionsTotal, subjectsTotal, attToday, teacherAttToday] =
        await Promise.all([
          tx.class.count({ where: { academicYear: { isActive: true } } }),
          tx.section.count({
            where: { class: { academicYear: { isActive: true } } },
          }),
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
        ]);

      // The six fee queries that used to live here are gone: the engine has
      // already answered all of them, and asking again from a second place is
      // exactly how this page and Fee Management came to disagree.
      const [
        incomeAgg,
        otherIncomeAgg,
        expenseAgg,
        salaryAgg,
        debtRepaidAgg,
        activeYear,
        recentPayments,
      ] = await Promise.all([
        tx.payment.aggregate({ _sum: { amount: true } }),
        // Donations, rent, canteen and the like. Fees alone are not the
        // school's income, and a Net Income that ignored the rest disagreed
        // with the finance page — see FinanceService.dashboard.
        tx.otherIncome.aggregate({ _sum: { amount: true } }),
        tx.expense.aggregate({ _sum: { amount: true } }),
        // See FinanceService.dashboard: outflow is `amountPaid` on every row,
        // not `amount` on fully-paid ones, or partials vanish from Net Income.
        tx.salary.aggregate({ _sum: { amountPaid: true } }),
        // Repaying a loan is money leaving the school, so it belongs in Net
        // Income beside expenses and salaries. The principal is deliberately
        // absent from income: borrowing does not make a school richer.
        tx.schoolDebtRepayment.aggregate({ _sum: { amount: true } }),
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
      ]);

      const [
        recentAudit,
        upcomingExams,
        studentsForGrowth,
        paymentsForChart,
        expensesForChart,
        otherIncomeForChart,
      ] =
        await Promise.all([
          tx.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
          tx.exam.findMany({
            where: { startDate: { gte: new Date() }, status: { not: "DRAFT" } },
            orderBy: { startDate: "asc" },
            take: 4,
            select: {
              id: true,
              name: true,
              startDate: true,
              class: { select: { name: true } },
              section: { select: { name: true } },
            },
          }),
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
          tx.otherIncome.findMany({
            where: { receivedAt: { gte: sixMonthsAgo } },
            select: { receivedAt: true, amount: true },
          }),
        ]);

      const byStatus = (
        rows: { status: string; _count: { _all: number } }[],
        s: string,
      ) => rows.find((r) => r.status === s)?._count._all ?? 0;

      const feeIncome = incomeAgg._sum.amount ?? 0;
      const otherIncome = otherIncomeAgg._sum.amount ?? 0;
      const totalIncome = feeIncome + otherIncome;
      const totalExpenses = expenseAgg._sum.amount ?? 0;
      const totalSalaries = salaryAgg._sum.amountPaid ?? 0;
      const debtRepaid = debtRepaidAgg._sum.amount ?? 0;

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
        income:
          sum(
            paymentsForChart.filter(
              (p) => monthKey(new Date(p.paidAt)) === bucketKey(b),
            ),
            (p) => p.amount,
          ) +
          sum(
            otherIncomeForChart.filter(
              (o) => monthKey(new Date(o.receivedAt)) === bucketKey(b),
            ),
            (o) => o.amount,
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
          active: teachersActive,
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
        // Straight from the engine, so this page and Fee Management cannot
        // report different debts for the same school on the same morning.
        fees: {
          totalOutstanding: position.outstanding,
          outstandingThisMonth: position.outstandingThisMonth,
          collectedToday: position.collectedToday,
          collectedThisMonth: position.collectedThisMonth,
          partialPayments: position.students.partial,
          advancePayments: position.students.advance,
          freeStudents: position.students.free,
        },
        finance: {
          totalIncome,
          feeIncome,
          otherIncome,
          totalExpenses,
          totalSalaries,
          debtRepaid,
          netIncome: totalIncome - totalExpenses - totalSalaries - debtRepaid,
        },
        activeAcademicYear: activeYear?.name ?? null,
        charts: { studentGrowth, feeCollection, incomeVsExpense },
        recentPayments: recentPayments.map((p) => ({
          id: p.id,
          receiptNumber: p.receiptNumber,
          student: p.student?.fullName ?? "Unknown",
          studentCode: p.student?.code ?? "—",
          className: p.student?.class?.name ?? null,
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
        upcomingExams: upcomingExams.map((e) => ({
          id: e.id,
          title: e.name,
          date: e.startDate,
          className: e.class.name,
          section: e.section?.name ?? null,
        })),
      };
      },
      { timeout: 120_000, maxWait: 45_000 },
    );
  }
}
