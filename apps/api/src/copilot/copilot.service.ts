import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AiService } from "../ai/ai.service";
import { BalanceEngineService } from "../finance/balance-engine.service";

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
    /** Students billed this month, split by how much of their charge is settled. */
    studentsBilled: number;
    studentsPaidFull: number;
    studentsPartial: number;
    studentsUnpaid: number;
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
  /** Where each figure above actually came from, line by line. */
  breakdown: {
    salary: {
      staffCount: number;
      fullyPaid: number;
      due: number;
      paid: number;
      outstanding: number;
    };
    expenseByCategory: NamedTotal[];
    incomeByCategory: NamedTotal[];
    /** The last six months, so a figure can be read against its neighbours. */
    months: { month: string; expected: number; collected: number }[];
  };
}

export interface NamedTotal {
  name: string;
  amount: number;
  count: number;
}

interface NamedTotalRow {
  name: string;
  amount: number | bigint;
  count: number | bigint;
}

interface MonthRow {
  month: string;
  expected: number | bigint;
  collected: number | bigint;
}

/** Raw SQL hands back bigints for sums; the page wants plain numbers. */
const named = (r: NamedTotalRow): NamedTotal => ({
  name: r.name,
  amount: Number(r.amount),
  count: Number(r.count),
});

interface RankedStudent {
  studentId: string;
  code: string;
  name: string;
  className: string | null;
  value: number;
}

@Injectable()
export class CopilotService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly balances: BalanceEngineService,
  ) {}

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

  /**
   * Answer in the language the user is reading the system in. A Somali school
   * asking in Somali and getting English back is a report nobody can hand to a
   * board, so the language travels with the request rather than being guessed.
   */
  private static languageRule(locale?: string): string {
    if (locale === "so") {
      return "Ku qor af-Soomaali oo kaliya. Isticmaal erayo fudud oo maamulka dugsigu fahmi karo.";
    }
    if (locale === "ar") {
      return "اكتب باللغة العربية فقط.";
    }
    return "Write in English.";
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

    // Fetched before the read below because the engine runs its own
    // transaction, and one school's money should be worked out once.
    const position = await this.balances.schoolPosition(schoolId);

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
          paidMonth,
          expenseAgg,
          salaryAgg,
          otherIncomeAgg,
          quizAgg,
          quizPass,
          salaryDue,
          salaryFullyPaid,
          expenseCats,
          incomeCats,
          monthRows,
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
          // Fee income for the month still comes from payments directly — the
          // finance block below is about money that arrived, not about what a
          // charge says. Everything else the engine has already answered.
          tx.payment.aggregate({
            where: { paidAt: { gte: r.start, lt: r.end } },
            _sum: { amount: true },
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
          tx.salary.aggregate({
            where: { year: r.year, month: r.month },
            _sum: { amount: true },
            _count: { _all: true },
          }),
          tx.salary.count({ where: { year: r.year, month: r.month, status: "PAID" } }),
          tx.$queryRaw<NamedTotalRow[]>`
            SELECT coalesce(c.name, 'Uncategorised') AS name,
                   sum(e.amount)::int AS amount, count(*)::int AS count
            FROM expenses e
            LEFT JOIN expense_categories c ON c.id = e."categoryId"
            WHERE e."spentAt" >= ${r.start} AND e."spentAt" < ${r.end}
            GROUP BY 1 ORDER BY 2 DESC`,
          tx.$queryRaw<NamedTotalRow[]>`
            SELECT coalesce(c.name, oi.title) AS name,
                   sum(oi.amount)::int AS amount, count(*)::int AS count
            FROM other_income oi
            LEFT JOIN income_categories c ON c.id = oi."categoryId"
            WHERE oi."receivedAt" >= ${r.start} AND oi."receivedAt" < ${r.end}
            GROUP BY 1 ORDER BY 2 DESC`,
          tx.$queryRaw<MonthRow[]>`
            WITH m AS (
              SELECT to_char(d, 'YYYY-MM') AS month,
                     d AS start, (d + interval '1 month') AS stop
              FROM generate_series(
                ${r.start}::timestamp - interval '5 months',
                ${r.start}::timestamp, interval '1 month') d
            )
            SELECT m.month,
              coalesce((SELECT sum(fc.amount)::int FROM fee_charges fc
                        WHERE fc.kind = 'MONTHLY'
                          AND fc.year = extract(year FROM m.start)::int
                          AND fc.month = extract(month FROM m.start)::int), 0) AS expected,
              coalesce((SELECT sum(p.amount)::int FROM payments p
                        WHERE p."paidAt" >= m.start AND p."paidAt" < m.stop), 0) AS collected
            FROM m ORDER BY m.month`,
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
          // The engine's figures, not a second reading of the same tables.
          // A briefing that quoted different money than the fee page would be
          // worse than none — it is the one screen people trust to summarise.
          fees: {
            expectedThisMonth: position.expectedThisMonth,
            collectedThisMonth: position.collectedThisMonth,
            collectedToday: position.collectedToday,
            outstanding: position.outstanding,
            collectionRate: position.collectionRate,
            studentsBilled:
              position.students.total - position.students.unbilled,
            studentsPaidFull: position.students.paid,
            studentsPartial: position.students.partial,
            studentsUnpaid: position.students.unpaid,
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
          breakdown: {
            salary: {
              staffCount: salaryDue._count._all,
              fullyPaid: salaryFullyPaid,
              due: salaryDue._sum.amount ?? 0,
              paid: salaries,
              outstanding: (salaryDue._sum.amount ?? 0) - salaries,
            },
            expenseByCategory: expenseCats.map(named),
            incomeByCategory: incomeCats.map(named),
            months: monthRows.map((m) => ({
              month: m.month,
              expected: Number(m.expected),
              collected: Number(m.collected),
            })),
          },
        };
      },
      { timeout: 60_000, maxWait: 30_000 },
    );
  }

  /**
   * The month's figures as a block of plain lines.
   *
   * Only aggregates: no student, parent or staff name ever goes to the model.
   * The narrative is written from counts and totals, and the page renders the
   * names beside it from our own data — so nobody's record leaves the system
   * to have a sentence written about it.
   */
  private factSheet(o: CopilotOverview): string {
    const money = (n: number) => `$${n.toLocaleString()}`;
    const pct = (n: number | null) => (n == null ? "not recorded" : `${n}%`);
    const b = o.breakdown;
    const L = [
      `Period: ${o.period.from} to ${o.period.to}` +
        (o.period.academicYear ? ` (academic year ${o.period.academicYear})` : ""),
      `Students enrolled: ${o.students.total} (${o.students.male} male, ${o.students.female} female); ${o.students.newThisMonth} registered this month`,
      `Teachers: ${o.staff.teachers}. Parents with accounts: ${o.staff.parents}. Classes: ${o.academics.classes}, sections: ${o.academics.sections}`,
      `Student attendance this month: ${pct(o.attendance.monthRate)}; previous month: ${pct(o.attendance.previousMonthRate)}`,
      `Today: ${o.attendance.todayPresent} present, ${o.attendance.todayAbsent} absent, ${o.attendance.todayLate} late`,
      `Teacher attendance this month: ${pct(o.teacherAttendance.rate)} (${o.teacherAttendance.present} present, ${o.teacherAttendance.absent} absent)`,
      `Fees billed this month: ${money(o.fees.expectedThisMonth)}; collected: ${money(o.fees.collectedThisMonth)} (${pct(o.fees.collectionRate)}); collected today: ${money(o.fees.collectedToday)}`,
      `Of ${o.fees.studentsBilled} students billed this month: ${o.fees.studentsPaidFull} paid in full, ` +
        `${o.fees.studentsPartial} paid part of what they owe, ${o.fees.studentsUnpaid} have paid nothing yet`,
      `Outstanding across all months: ${money(o.fees.outstanding)}`,
      `Income this month: fees ${money(o.finance.feeIncome)} + other ${money(o.finance.otherIncome)} = ${money(o.finance.totalIncome)}`,
      `Spending this month: salaries ${money(o.finance.salaries)} + expenses ${money(o.finance.expenses)}`,
      `Net income this month: ${money(o.finance.netIncome)}`,
      o.quiz.attempts > 0
        ? `Online quizzes graded: ${o.quiz.attempts}, average ${pct(o.quiz.averagePercent)}, passing ${pct(o.quiz.passRate)}`
        : "Online quizzes: none graded this school",
      `Payroll this month: ${b.salary.staffCount} staff on the payroll, ${b.salary.fullyPaid} paid in full; ` +
        `${money(b.salary.due)} due, ${money(b.salary.paid)} paid, ${money(b.salary.outstanding)} still owed to staff`,
      b.expenseByCategory.length
        ? "Expenses by category: " +
          b.expenseByCategory
            .map((c) => `${c.name} ${money(c.amount)} (${c.count} entries)`)
            .join("; ")
        : "Expenses by category: nothing recorded this month",
      b.incomeByCategory.length
        ? "Additional income by source: " +
          b.incomeByCategory
            .map((c) => `${c.name} ${money(c.amount)} (${c.count} entries)`)
            .join("; ")
        : "Additional income: nothing recorded this month",
      "Fee collection over the last six months (billed vs collected): " +
        b.months
          .map((m) => `${m.month} ${money(m.collected)} of ${money(m.expected)}`)
          .join("; "),
    ];
    return L.join("\n");
  }

  /**
   * A written summary of the month, and what it suggests management look at.
   *
   * `available: false` when AI is switched off — the figures above stand on
   * their own, and a page that needs the model to be useful would be a page
   * that breaks when the key expires.
   */
  async brief(schoolId: string, month?: string, locale?: string) {
    const overview = await this.overview(schoolId, month);
    const facts = this.factSheet(overview);
    const text = await this.ai.writeFrom(
      [
        "Write a full monthly report for this school's principal, in short labelled",
        "paragraphs: (1) money in - fees and each source of additional income,",
        "(2) money out - payroll and each expense category, naming the amounts,",
        "(3) fees expected against fees collected, and what is still outstanding,",
        "(4) students, attendance and results, (5) what management should do next.",
        "Give the actual amounts in every paragraph; do not summarise them away.",
        "Compare against earlier months only where an earlier figure is given.",
        CopilotService.languageRule(locale),
      ].join(" "),
      facts,
      { maxWords: 450 },
    );
    return {
      period: overview.period,
      available: text != null,
      summary: text,
      basedOn: facts,
    };
  }

  /** How many questions this school has left today. */
  async quota(schoolId: string, dailyLimit = 5) {
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    const used = await this.prisma.forTenant(schoolId, (tx) =>
      tx.copilotQuestion.count({ where: { createdAt: { gte: since } } }),
    );
    return { used, limit: dailyLimit, remaining: Math.max(0, dailyLimit - used) };
  }

  /** The questions this school has asked, most recent first. */
  history(schoolId: string, limit = 20) {
    return this.prisma.forTenant(schoolId, (tx) =>
      tx.copilotQuestion.findMany({
        orderBy: { createdAt: "desc" },
        take: Math.min(Math.max(limit, 1), 100),
        select: {
          id: true,
          question: true,
          answer: true,
          username: true,
          createdAt: true,
        },
      }),
    );
  }

  /**
   * Answer one question about the school, from the month's figures.
   *
   * The model is given the same fact sheet and nothing else, so an answer it
   * cannot support from those lines has to say so rather than be filled in.
   */
  async ask(
    schoolId: string,
    question: string,
    actor: { userId?: string; username?: string; locale?: string },
    dailyLimit = 5,
  ): Promise<
    | { ok: true; answer: string; remaining: number }
    | { ok: false; reason: "limit" | "unavailable"; remaining: number }
  > {
    const q = await this.quota(schoolId, dailyLimit);
    if (q.remaining <= 0) return { ok: false, reason: "limit", remaining: 0 };

    const overview = await this.overview(schoolId);
    const facts = this.factSheet(overview);
    const answer = await this.ai.writeFrom(
      `Answer this question from the school's own figures: "${question}"\n` +
        "Give the amounts and counts that support the answer. If the figures do " +
        "not contain the answer, say which record the school would need to have " +
        "entered. " +
        CopilotService.languageRule(actor.locale),
      facts,
      { maxWords: 250 },
    );
    if (!answer) return { ok: false, reason: "unavailable", remaining: q.remaining };

    await this.prisma.forTenant(schoolId, (tx) =>
      tx.copilotQuestion.create({
        data: {
          schoolId,
          userId: actor.userId ?? null,
          username: actor.username ?? null,
          question: question.slice(0, 500),
          answer,
          snapshot: { period: overview.period, facts },
        },
      }),
    );
    return { ok: true, answer, remaining: q.remaining - 1 };
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
