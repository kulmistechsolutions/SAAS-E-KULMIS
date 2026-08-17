import { Injectable } from "@nestjs/common";
import { z } from "zod";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Generation history and reprints (PRD §24-27).
 *
 * A reprint is a NEW row that points back at the card it replaces — it never
 * edits the original and never touches the student record, so the permanent
 * Student ID printed on a replacement is the same one that was on the lost card.
 */

export const recordCardIssuesSchema = z.object({
  cardType: z.enum(["STUDENT_ID", "EXAM_CARD", "CLEARANCE_CARD", "CUSTOM_CARD"]),
  styleId: z.string().min(1).max(60),
  orientation: z.enum(["PORTRAIT", "LANDSCAPE"]),
  academicYear: z.string().max(40).optional(),
  isReprint: z.boolean().optional(),
  reprintOfId: z.string().max(40).optional(),
  reprintReason: z.string().max(200).optional(),
  students: z
    .array(
      z.object({
        studentId: z.string().min(1).max(40),
        studentCode: z.string().min(1).max(60),
        studentName: z.string().min(1).max(200),
        className: z.string().max(120).optional(),
        section: z.string().max(120).optional(),
      }),
    )
    .min(1)
    // A batch is one class or one school; the cap stops a malformed client
    // writing an unbounded number of rows in a single call.
    .max(5000),
});

export type RecordCardIssuesInput = z.infer<typeof recordCardIssuesSchema>;

export const clearanceQuerySchema = z.object({
  studentIds: z.array(z.string().min(1).max(40)).min(1).max(5000),
});

export interface CardIssueRow {
  id: string;
  studentId: string;
  studentCode: string;
  studentName: string;
  cardType: string;
  styleId: string;
  orientation: string;
  academicYear: string | null;
  className: string | null;
  section: string | null;
  batchId: string;
  status: string;
  isReprint: boolean;
  reprintReason: string | null;
  createdAt: string;
  /** How many times this student has been issued this card type in total. */
  issueCount?: number;
}

@Injectable()
export class CardIssuesService {
  constructor(private readonly prisma: PrismaService) {}

  async record(
    schoolId: string,
    userId: string | undefined,
    input: RecordCardIssuesInput,
  ): Promise<{ batchId: string; recorded: number }> {
    const batchId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date();
    const rows = input.students.map((s) => ({
      schoolId,
      studentId: s.studentId,
      studentCode: s.studentCode,
      studentName: s.studentName,
      cardType: input.cardType,
      styleId: input.styleId,
      orientation: input.orientation,
      academicYear: input.academicYear ?? null,
      className: s.className ?? null,
      section: s.section ?? null,
      batchId,
      status: "GENERATED",
      isReprint: input.isReprint ?? false,
      reprintOfId: input.reprintOfId ?? null,
      reprintReason: input.reprintReason ?? null,
      issuedByUserId: userId ?? null,
      updatedAt: now,
    }));

    await this.prisma.forTenant(schoolId, async (tx) => {
      // createMany in one statement: a class of 40 would otherwise be 40 round
      // trips to a remote database and can exceed the transaction timeout.
      await tx.cardIssue.createMany({ data: rows });
      if (input.isReprint && input.reprintOfId) {
        // Mark the card being replaced, so history shows which one is dead.
        await tx.cardIssue.updateMany({
          where: { id: input.reprintOfId },
          data: { status: "REPLACED", updatedAt: now },
        });
      }
    });

    return { batchId, recorded: rows.length };
  }

  /** Flag a whole batch as actually sent to a printer. */
  async markPrinted(schoolId: string, batchId: string): Promise<{ updated: number }> {
    const res = await this.prisma.forTenant(schoolId, (tx) =>
      tx.cardIssue.updateMany({
        where: { batchId, status: "GENERATED" },
        data: { status: "PRINTED", updatedAt: new Date() },
      }),
    );
    return { updated: res.count };
  }

  async list(
    schoolId: string,
    filters: { search?: string; cardType?: string; status?: string; limit?: number },
  ): Promise<CardIssueRow[]> {
    const take = Math.min(Math.max(filters.limit ?? 200, 1), 500);
    const q = filters.search?.trim();

    const rows = await this.prisma.forTenant(schoolId, (tx) =>
      tx.cardIssue.findMany({
        where: {
          ...(filters.cardType ? { cardType: filters.cardType } : {}),
          ...(filters.status ? { status: filters.status } : {}),
          ...(q
            ? {
                OR: [
                  { studentName: { contains: q, mode: "insensitive" as const } },
                  { studentCode: { contains: q, mode: "insensitive" as const } },
                ],
              }
            : {}),
        },
        orderBy: { createdAt: "desc" },
        take,
      }),
    );

    // Total issues per student+type, so the UI can show "reprinted 2 times"
    // without the caller running a query per row.
    const counts = await this.prisma.forTenant(schoolId, (tx) =>
      tx.cardIssue.groupBy({
        by: ["studentId", "cardType"],
        _count: { _all: true },
      }),
    );
    const countByKey = new Map(
      counts.map((c) => [`${c.studentId}|${c.cardType}`, c._count._all]),
    );

    return rows.map((r) => ({
      id: r.id,
      studentId: r.studentId,
      studentCode: r.studentCode,
      studentName: r.studentName,
      cardType: r.cardType,
      styleId: r.styleId,
      orientation: r.orientation,
      academicYear: r.academicYear,
      className: r.className,
      section: r.section,
      batchId: r.batchId,
      status: r.status,
      isReprint: r.isReprint,
      reprintReason: r.reprintReason,
      createdAt: r.createdAt.toISOString(),
      issueCount: countByKey.get(`${r.studentId}|${r.cardType}`) ?? 1,
    }));
  }

  /**
   * Real clearance status per student (PRD §23).
   *
   * A clearance card that says "Cleared" because someone picked it from a
   * dropdown is worth nothing — the status is computed from what the student
   * actually owes: unpaid fee charges and books still out on loan. Both are
   * fetched in one query each rather than per student, because a whole class
   * would otherwise be dozens of round trips to a remote database.
   */
  async clearance(
    schoolId: string,
    studentIds: string[],
  ): Promise<
    { studentId: string; feesOwed: number; booksOut: number; status: string; detail: string }[]
  > {
    if (studentIds.length === 0) return [];

    const [charges, loans] = await this.prisma.forTenant(schoolId, async (tx) => [
      await tx.feeCharge.findMany({
        where: { studentId: { in: studentIds }, status: { not: "PAID" } },
        select: { studentId: true, amount: true, paidAmount: true },
      }),
      await tx.bookLoan.findMany({
        where: { studentId: { in: studentIds }, returnedAt: null },
        select: { studentId: true },
      }),
    ]);

    const owed = new Map<string, number>();
    for (const c of charges) {
      // A charge can be part-paid, so the debt is the remainder, not the total.
      const rest = Math.max(0, c.amount - c.paidAmount);
      if (rest > 0) owed.set(c.studentId, (owed.get(c.studentId) ?? 0) + rest);
    }
    const books = new Map<string, number>();
    for (const l of loans) books.set(l.studentId, (books.get(l.studentId) ?? 0) + 1);

    return studentIds.map((studentId) => {
      const feesOwed = owed.get(studentId) ?? 0;
      const booksOut = books.get(studentId) ?? 0;
      const cleared = feesOwed === 0 && booksOut === 0;
      const parts: string[] = [];
      if (feesOwed > 0) parts.push(`Fees ${feesOwed}`);
      if (booksOut > 0) parts.push(`${booksOut} book${booksOut === 1 ? "" : "s"} out`);
      return {
        studentId,
        feesOwed,
        booksOut,
        status: cleared ? "Cleared" : "Pending",
        detail: cleared ? "No outstanding fees or library items" : parts.join(" · "),
      };
    });
  }

  /** Headline numbers for the ID reports (PRD §29). */
  async summary(schoolId: string): Promise<Record<string, number>> {
    const [byStatus, reprints, students] = await this.prisma.forTenant(
      schoolId,
      async (tx) => [
        await tx.cardIssue.groupBy({ by: ["status"], _count: { _all: true } }),
        await tx.cardIssue.count({ where: { isReprint: true } }),
        await tx.cardIssue.findMany({ distinct: ["studentId"], select: { studentId: true } }),
      ],
    );
    const out: Record<string, number> = {
      generated: 0,
      printed: 0,
      replaced: 0,
      reprints,
      studentsWithCards: students.length,
    };
    for (const g of byStatus) {
      const key = g.status.toLowerCase();
      if (key in out) out[key] = g._count._all;
    }
    out.total = byStatus.reduce((n, g) => n + g._count._all, 0);
    return out;
  }
}
