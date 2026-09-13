import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export interface SchoolPeriod {
  /** "YYYY-MM" of the school's earliest real record, or null when it has none. */
  firstMonth: string | null;
  /** "YYYY-MM" of the current month — nothing later than today exists. */
  lastMonth: string;
  /** "YYYY-MM-DD" of the earliest record, for day-level filters. */
  firstDate: string | null;
  lastDate: string;
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * The months a school has actually been running.
 *
 * Report filters were an open month box, so a school that opened in August
 * could be asked for a January statement and would get one: a document on
 * school letterhead, stamped, asserting a month the school did not exist for,
 * with a column of zeroes under it. A zero that means "nothing happened" and a
 * zero that means "we were not open" are not the same fact, and a printed
 * report cannot tell you which it is.
 *
 * So the window comes from the school's own records — the earliest of the
 * things it can only have done while open — and the filters cannot be moved
 * outside it. Nothing is hidden by this: the school's whole history is inside
 * the window by construction.
 */
@Injectable()
export class SchoolPeriodService {
  constructor(private readonly prisma: PrismaService) {}

  async get(schoolId: string): Promise<SchoolPeriod> {
    const today = new Date();

    const earliest = await this.prisma.forTenant(schoolId, async (tx) => {
      const [payment, expense, attendance, student, salary] = await Promise.all([
        tx.payment.findFirst({ orderBy: { paidAt: "asc" }, select: { paidAt: true } }),
        tx.expense.findFirst({ orderBy: { spentAt: "asc" }, select: { spentAt: true } }),
        tx.studentAttendance.findFirst({
          orderBy: { date: "asc" },
          select: { date: true },
        }),
        tx.student.findFirst({
          orderBy: { createdAt: "asc" },
          select: { createdAt: true },
        }),
        // Payroll is stored as year/month rather than a date, so it is read
        // separately and turned into the first of its month.
        tx.salary.findFirst({
          orderBy: [{ year: "asc" }, { month: "asc" }],
          select: { year: true, month: true },
        }),
      ]);

      const dates: Date[] = [];
      if (payment) dates.push(payment.paidAt);
      if (expense) dates.push(expense.spentAt);
      if (attendance) dates.push(attendance.date);
      if (student) dates.push(student.createdAt);
      if (salary) dates.push(new Date(Date.UTC(salary.year, salary.month - 1, 1)));

      return dates.length
        ? dates.reduce((min, d) => (d < min ? d : min))
        : null;
    });

    // A school with no records at all still opened on the day it was created,
    // which is the earliest month anything could be reported for.
    const school = await this.prisma.school.findFirst({
      where: { id: schoolId },
      select: { createdAt: true },
    });

    const first =
      earliest && school
        ? earliest < school.createdAt
          ? earliest
          : school.createdAt
        : (earliest ?? school?.createdAt ?? null);

    return {
      firstMonth: first ? iso(first).slice(0, 7) : null,
      lastMonth: iso(today).slice(0, 7),
      firstDate: first ? iso(first) : null,
      lastDate: iso(today),
    };
  }
}
