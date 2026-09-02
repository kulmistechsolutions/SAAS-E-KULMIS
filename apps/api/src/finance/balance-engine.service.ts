import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { currentCalendarMonth } from "./fee-billing.util";

/**
 * The one place money is worked out.
 *
 * Before this, nine API services and a 1,100-line browser store each read
 * fee_charges and payments and reached their own conclusion. They disagreed
 * constantly, and every disagreement looked like a separate bug: a dashboard
 * card reading $0 next to another reading $6,780; a student's profile showing
 * a debt the collection page had already settled; a fee raised in one screen
 * that the month being collected never heard about. Fixing them one at a time
 * fixed the symptom and left the cause.
 *
 * Everything that needs a number now asks here. The rules live in exactly one
 * file, so "what does this school actually expect to collect" has one answer
 * rather than one per screen.
 *
 * Definitions this engine holds, and nobody else decides:
 *
 *  - **Live month.** The month a school is actually collecting, which is not
 *    the calendar's. Schools set the next month up around the 25th, so for
 *    most of any month the live one is the month just gone. Reading the
 *    calendar instead is what left new students unbilled and fee changes
 *    unapplied.
 *  - **Due.** A charge for the live month or earlier. Anything later is money
 *    the family may pay ahead but does not yet owe.
 *  - **Expected.** The sum of what is due. Never students × default fee: they
 *    have different fees, start dates, waivers and agreements.
 *  - **Outstanding.** Due minus paid, floored at zero.
 *  - **Advance.** Paid against periods not yet due.
 *  - **Credit.** Paid beyond what a charge asks — which happens when a fee is
 *    lowered after payment. It is never silently discarded.
 */

export type ChargeKind = "MONTHLY" | "EXTRA" | "REGISTRATION";

/** One billed thing, and where it stands. */
export interface ChargeLine {
  id: string;
  kind: ChargeKind;
  /** Ready to show: a month name, or the charge's own label. */
  label: string;
  year: number;
  month: number;
  monthKey: string;
  expected: number;
  paid: number;
  outstanding: number;
  credit: number;
  /** Whether this period has arrived. Future periods are not owed yet. */
  due: boolean;
  status: "UNPAID" | "PARTIAL" | "PAID" | "INACTIVE" | "ADVANCE" | "FREE";
}

/** Everything true about one student's fees, in one shape. */
export interface StudentPosition {
  studentId: string;
  code: string;
  fullName: string;
  className: string | null;
  section: string | null;
  monthlyFee: number;
  free: boolean;
  /** Due, and unsettled. */
  outstanding: number;
  /** Due, in total. */
  expected: number;
  /** Collected against due periods. */
  paid: number;
  /** Collected against periods not yet due. */
  advance: number;
  /** Collected beyond what was asked. */
  credit: number;
  lines: ChargeLine[];
  /** What the collection screens key their state off. */
  state: "FREE" | "PAID" | "PARTIAL" | "UNPAID" | "ADVANCE" | "UNBILLED";
}

export interface SchoolPosition {
  /** The month the school is collecting, and where that came from. */
  liveMonth: { year: number; month: number; monthKey: string; fromSetup: boolean };
  expected: number;
  collected: number;
  outstanding: number;
  advance: number;
  credit: number;
  collectedThisMonth: number;
  collectedToday: number;
  collectionRate: number | null;
  students: {
    total: number;
    paid: number;
    partial: number;
    unpaid: number;
    free: number;
    advance: number;
    unbilled: number;
  };
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const monthKeyOf = (y: number, m: number) =>
  `${y}-${String(m).padStart(2, "0")}`;

const monthLabelOf = (y: number, m: number) =>
  `${MONTH_NAMES[m - 1] ?? m} ${y}`;

interface ChargeRow {
  id: string;
  kind: string;
  label: string | null;
  year: number;
  month: number;
  amount: number;
  paidAmount: number;
  status: string;
}

@Injectable()
export class BalanceEngineService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The month this school is collecting.
   *
   * Its own latest set-up month, bounded to the calendar month or the one
   * before it. A setup older than that means the school has stopped running
   * them, and billing into a month that ended before a student arrived would
   * invent a debt; a setup further ahead is next month, prepared early.
   */
  async liveMonth(
    schoolId: string,
  ): Promise<{ year: number; month: number; monthKey: string; fromSetup: boolean }> {
    const cal = currentCalendarMonth();
    const prevM = cal.month === 1 ? 12 : cal.month - 1;
    const prevY = cal.month === 1 ? cal.year - 1 : cal.year;

    const setup = await this.prisma.forTenant(schoolId, (tx) =>
      tx.monthlyFeeActivation.findFirst({
        where: {
          OR: [
            { year: cal.year, month: cal.month },
            { year: prevY, month: prevM },
          ],
        },
        orderBy: [{ year: "desc" }, { month: "desc" }],
        select: { year: true, month: true },
      }),
    );

    const y = setup?.year ?? cal.year;
    const m = setup?.month ?? cal.month;
    return { year: y, month: m, monthKey: monthKeyOf(y, m), fromSetup: !!setup };
  }

  /** Turn a school's raw charge rows into lines, with the rules applied once. */
  private toLines(rows: ChargeRow[], liveYm: number, free: boolean): ChargeLine[] {
    return rows.map((c) => {
      const ym = c.year * 100 + c.month;
      const due = ym <= liveYm;
      const inactive = c.status === "INACTIVE";
      const expected = inactive ? 0 : c.amount;
      const paid = c.paidAmount;
      const outstanding = inactive ? 0 : Math.max(0, expected - paid);
      const credit = Math.max(0, paid - expected);

      let status: ChargeLine["status"];
      if (inactive) status = "INACTIVE";
      else if (free && expected === 0) status = "FREE";
      else if (paid >= expected && expected > 0 && !due) status = "ADVANCE";
      else if (paid >= expected) status = "PAID";
      else if (paid > 0) status = "PARTIAL";
      else status = "UNPAID";

      return {
        id: c.id,
        kind: (c.kind as ChargeKind) ?? "MONTHLY",
        label:
          c.kind === "MONTHLY" || !c.label
            ? monthLabelOf(c.year, c.month)
            : c.label,
        year: c.year,
        month: c.month,
        monthKey: monthKeyOf(c.year, c.month),
        expected,
        paid,
        outstanding,
        credit,
        due,
        status,
      };
    });
  }

  /** Roll a student's lines into the totals every screen asks for. */
  private summarise(
    lines: ChargeLine[],
    free: boolean,
  ): Pick<
    StudentPosition,
    "expected" | "paid" | "outstanding" | "advance" | "credit" | "state"
  > {
    let expected = 0;
    let paid = 0;
    let outstanding = 0;
    let advance = 0;
    let credit = 0;
    let anyDue = false;

    for (const l of lines) {
      if (l.status === "INACTIVE") continue;
      credit += l.credit;
      if (l.due) {
        anyDue = true;
        expected += l.expected;
        paid += Math.min(l.paid, l.expected);
        outstanding += l.outstanding;
      } else {
        advance += l.paid;
      }
    }

    let state: StudentPosition["state"];
    if (free) state = "FREE";
    else if (!anyDue) state = advance > 0 ? "ADVANCE" : "UNBILLED";
    else if (outstanding === 0) state = advance > 0 ? "ADVANCE" : "PAID";
    else if (paid > 0) state = "PARTIAL";
    else state = "UNPAID";

    return { expected, paid, outstanding, advance, credit, state };
  }

  /** One student's complete financial position. */
  async studentPosition(
    schoolId: string,
    studentId: string,
  ): Promise<StudentPosition | null> {
    const live = await this.liveMonth(schoolId);
    const liveYm = live.year * 100 + live.month;

    return this.prisma.forTenant(schoolId, async (tx) => {
      const student = await tx.student.findFirst({
        where: { id: studentId },
        select: {
          id: true,
          code: true,
          fullName: true,
          monthlyFee: true,
          feeWaived: true,
          class: { select: { name: true } },
          section: { select: { name: true } },
        },
      });
      if (!student) return null;

      const rows = await tx.feeCharge.findMany({
        where: { studentId },
        orderBy: [{ year: "asc" }, { month: "asc" }, { kind: "asc" }],
        select: {
          id: true,
          kind: true,
          label: true,
          year: true,
          month: true,
          amount: true,
          paidAmount: true,
          status: true,
        },
      });

      const free = student.feeWaived || student.monthlyFee === 0;
      const lines = this.toLines(rows, liveYm, free);
      return {
        studentId: student.id,
        code: student.code,
        fullName: student.fullName,
        className: student.class?.name ?? null,
        section: student.section?.name ?? null,
        monthlyFee: student.monthlyFee,
        free,
        lines,
        ...this.summarise(lines, free),
      };
    });
  }

  /**
   * Every active student's position, in one pass.
   *
   * Two queries for the whole school rather than one per student — the
   * per-student loop is what times out once a school passes a few hundred.
   */
  async allPositions(schoolId: string): Promise<StudentPosition[]> {
    const live = await this.liveMonth(schoolId);
    const liveYm = live.year * 100 + live.month;

    return this.prisma.forTenant(
      schoolId,
      async (tx) => {
        const activeYear = await tx.academicYear.findFirst({
          where: { isActive: true },
          select: { id: true },
        });
        const students = await tx.student.findMany({
          where: {
            status: "ACTIVE",
            ...(activeYear ? { class: { academicYearId: activeYear.id } } : {}),
          },
          select: {
            id: true,
            code: true,
            fullName: true,
            monthlyFee: true,
            feeWaived: true,
            class: { select: { name: true } },
            section: { select: { name: true } },
          },
          orderBy: { fullName: "asc" },
        });
        if (students.length === 0) return [];

        const rows = await tx.feeCharge.findMany({
          where: { studentId: { in: students.map((s) => s.id) } },
          orderBy: [{ year: "asc" }, { month: "asc" }, { kind: "asc" }],
          select: {
            id: true,
            studentId: true,
            kind: true,
            label: true,
            year: true,
            month: true,
            amount: true,
            paidAmount: true,
            status: true,
          },
        });

        const byStudent = new Map<string, ChargeRow[]>();
        for (const r of rows) {
          const list = byStudent.get(r.studentId);
          if (list) list.push(r);
          else byStudent.set(r.studentId, [r]);
        }

        return students.map((s) => {
          const free = s.feeWaived || s.monthlyFee === 0;
          const lines = this.toLines(byStudent.get(s.id) ?? [], liveYm, free);
          return {
            studentId: s.id,
            code: s.code,
            fullName: s.fullName,
            className: s.class?.name ?? null,
            section: s.section?.name ?? null,
            monthlyFee: s.monthlyFee,
            free,
            lines,
            ...this.summarise(lines, free),
          };
        });
      },
      { timeout: 60_000, maxWait: 30_000 },
    );
  }

  /**
   * The school's position — the numbers behind every fee dashboard card.
   *
   * Collected figures come from the payments table directly, because a
   * payment is money that arrived whether or not it could be matched to a
   * charge; the rest is derived from the same student positions the
   * individual screens read, so a card and the row under it cannot disagree.
   */
  async schoolPosition(schoolId: string): Promise<SchoolPosition> {
    const live = await this.liveMonth(schoolId);
    const monthStart = new Date(Date.UTC(live.year, live.month - 1, 1));
    const monthEnd = new Date(Date.UTC(live.year, live.month, 1));
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    const [positions, monthAgg, todayAgg] = await Promise.all([
      this.allPositions(schoolId),
      this.prisma.forTenant(schoolId, (tx) =>
        tx.payment.aggregate({
          _sum: { amount: true },
          where: { paidAt: { gte: monthStart, lt: monthEnd } },
        }),
      ),
      this.prisma.forTenant(schoolId, (tx) =>
        tx.payment.aggregate({
          _sum: { amount: true },
          where: { paidAt: { gte: todayStart } },
        }),
      ),
    ]);

    const totals = positions.reduce(
      (acc, p) => {
        acc.expected += p.expected;
        acc.collected += p.paid;
        acc.outstanding += p.outstanding;
        acc.advance += p.advance;
        acc.credit += p.credit;
        acc.students[
          p.state === "FREE"
            ? "free"
            : p.state === "PAID"
              ? "paid"
              : p.state === "PARTIAL"
                ? "partial"
                : p.state === "ADVANCE"
                  ? "advance"
                  : p.state === "UNBILLED"
                    ? "unbilled"
                    : "unpaid"
        ] += 1;
        return acc;
      },
      {
        expected: 0,
        collected: 0,
        outstanding: 0,
        advance: 0,
        credit: 0,
        students: {
          total: positions.length,
          paid: 0,
          partial: 0,
          unpaid: 0,
          free: 0,
          advance: 0,
          unbilled: 0,
        },
      },
    );

    return {
      liveMonth: live,
      expected: totals.expected,
      collected: totals.collected,
      outstanding: totals.outstanding,
      advance: totals.advance,
      credit: totals.credit,
      collectedThisMonth: monthAgg._sum.amount ?? 0,
      collectedToday: todayAgg._sum.amount ?? 0,
      collectionRate:
        totals.expected > 0
          ? Math.round((totals.collected / totals.expected) * 1000) / 10
          : null,
      students: totals.students,
    };
  }
}
