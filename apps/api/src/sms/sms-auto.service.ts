import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { SmsService } from "./sms.service";
import type { SmsCategory } from "@ekulmis/shared";
import { autoSmsBody, type AutoSmsEvent } from "./sms-auto.text";

/**
 * The messages a school never has to remember to send.
 *
 * Four moments a parent wants to hear about — a payment landed, a child was
 * registered, a child was marked absent, results were published — each behind
 * its own switch, all off until the school turns one on. An automatic message
 * spends credits without anyone pressing a button, so nobody is opted in.
 *
 * Nothing here may fail the thing that triggered it. A parent's phone being
 * wrong, or the gateway being down, must not undo a fee payment or refuse a
 * registration, so every send is caught and logged and the caller is told
 * nothing. That is also why each method takes ids and reads what it needs
 * itself: the call sites stay one line.
 */
@Injectable()
export class SmsAutoService {
  private readonly log = new Logger(SmsAutoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sms: SmsService,
  ) {}

  /** Fire-and-forget. Never throws, never blocks the caller. */
  private fire(
    schoolId: string,
    event: AutoSmsEvent,
    build: () => Promise<{
      body: string;
      recipients: {
        phone: string;
        name: string;
        type: "PARENT";
        refId: string;
      }[];
    } | null>,
  ): void {
    void (async () => {
      try {
        const school = await this.prisma.school.findUnique({
          where: { id: schoolId },
          select: {
            name: true,
            smsAutoFee: true,
            smsAutoRegistration: true,
            smsAutoAttendance: true,
            smsAutoResult: true,
          },
        });
        if (!school) return;
        const on = {
          FEE_PAID: school.smsAutoFee,
          REGISTERED: school.smsAutoRegistration,
          ABSENT: school.smsAutoAttendance,
          RESULT: school.smsAutoResult,
        }[event];
        if (!on) return;

        const payload = await build();
        if (!payload || payload.recipients.length === 0) return;

        await this.sms.sendDirect(schoolId, undefined, {
          category: CATEGORY[event],
          body: payload.body,
          recipients: payload.recipients,
        });
      } catch (e) {
        // Suspension, a spent balance, a limit reached, a dead gateway — all
        // ordinary states for an automatic message, and none of them is the
        // caller's problem.
        this.log.warn(
          `Automatic ${event} SMS not sent for school ${schoolId}: ${
            e instanceof Error ? e.message : String(e)
          }`,
        );
      }
    })();
  }

  /**
   * A fee payment was recorded. The parent hears what was taken and what is
   * left — the balance is read here rather than passed in, so the call site
   * stays one line and the figure is the one the ledger settled on.
   */
  feePaid(
    schoolId: string,
    input: { studentId: string; receiptNo: string; amount: number },
  ): void {
    this.fire(schoolId, "FEE_PAID", async () => {
      const who = await this.parentOf(schoolId, input.studentId);
      if (!who) return null;
      const school = await this.prisma.school.findUnique({
        where: { id: schoolId },
        select: { name: true, currency: true },
      });
      const owed = await this.prisma.forTenant(schoolId, (tx) =>
        tx.feeCharge.findMany({
          where: {
            studentId: input.studentId,
            status: { in: ["UNPAID", "PARTIAL"] },
          },
          select: { amount: true, paidAmount: true },
        }),
      );
      const outstanding = owed.reduce(
        (n, c) => n + (c.amount - c.paidAmount),
        0,
      );
      const cur = school?.currency === "USD" ? "$" : `${school?.currency ?? ""} `;
      return {
        body: autoSmsBody("FEE_PAID", {
          school: school?.name ?? "School",
          student: who.studentName,
          receiptNo: input.receiptNo,
          amount: `${cur}${input.amount}`,
          outstanding: `${cur}${outstanding}`,
        }),
        recipients: [who.recipient],
      };
    });
  }

  /** A student was registered. */
  registered(schoolId: string, studentId: string): void {
    this.fire(schoolId, "REGISTERED", async () => {
      const who = await this.parentOf(schoolId, studentId);
      if (!who) return null;
      const school = await this.schoolName(schoolId);
      return {
        body: autoSmsBody("REGISTERED", {
          school,
          student: who.studentName,
          code: who.studentCode,
        }),
        recipients: [who.recipient],
      };
    });
  }

  /** Students marked absent today. One message each, to their own parent. */
  absent(schoolId: string, studentIds: string[], date: string): void {
    if (studentIds.length === 0) return;
    this.fire(schoolId, "ABSENT", async () => {
      // One message per student: a parent with two absent children should hear
      // about both by name, not once with an ambiguous "your child".
      const school = await this.schoolName(schoolId);
      const rows = await Promise.all(
        studentIds.map((id) => this.parentOf(schoolId, id)),
      );
      const found = rows.filter((r): r is ParentOf => r !== null);
      if (found.length === 0) return null;
      // sendDirect takes one body for the batch, so absences go one at a time.
      for (const r of found.slice(1)) {
        await this.sms.sendDirect(schoolId, undefined, {
          category: CATEGORY.ABSENT,
          body: autoSmsBody("ABSENT", {
            school,
            student: r.studentName,
            date,
          }),
          recipients: [r.recipient],
        });
      }
      return {
        body: autoSmsBody("ABSENT", {
          school,
          student: found[0].studentName,
          date,
        }),
        recipients: [found[0].recipient],
      };
    });
  }

  /** Results were published for an exam group. */
  resultsPublished(
    schoolId: string,
    studentIds: string[],
    examName: string,
  ): void {
    if (studentIds.length === 0) return;
    this.fire(schoolId, "RESULT", async () => {
      const school = await this.schoolName(schoolId);
      const rows = await Promise.all(
        studentIds.map((id) => this.parentOf(schoolId, id)),
      );
      const found = rows.filter((r): r is ParentOf => r !== null);
      if (found.length === 0) return null;
      for (const r of found.slice(1)) {
        await this.sms.sendDirect(schoolId, undefined, {
          category: CATEGORY.RESULT,
          body: autoSmsBody("RESULT", {
            school,
            student: r.studentName,
            exam: examName,
          }),
          recipients: [r.recipient],
        });
      }
      return {
        body: autoSmsBody("RESULT", {
          school,
          student: found[0].studentName,
          exam: examName,
        }),
        recipients: [found[0].recipient],
      };
    });
  }

  private async schoolName(schoolId: string): Promise<string> {
    const s = await this.prisma.school.findUnique({
      where: { id: schoolId },
      select: { name: true },
    });
    return s?.name ?? "School";
  }

  /** The parent to text about a student, or null when there is nobody to text. */
  private async parentOf(
    schoolId: string,
    studentId: string,
  ): Promise<ParentOf | null> {
    const student = await this.prisma.forTenant(schoolId, (tx) =>
      tx.student.findFirst({
        where: { id: studentId },
        select: {
          fullName: true,
          code: true,
          parent: { select: { id: true, name: true, phone: true } },
        },
      }),
    );
    if (!student?.parent?.phone) return null;
    return {
      studentName: student.fullName,
      studentCode: student.code,
      recipient: {
        phone: student.parent.phone,
        name: student.parent.name,
        type: "PARENT",
        refId: student.parent.id,
      },
    };
  }
}

interface ParentOf {
  studentName: string;
  studentCode: string;
  recipient: { phone: string; name: string; type: "PARENT"; refId: string };
}

/**
 * The SMS category each event is filed under, so History and Reports group
 * automatic messages with the hand-sent ones about the same thing.
 */
const CATEGORY = {
  FEE_PAID: "PAYMENT_CONFIRMATION",
  REGISTERED: "REGISTRATION",
  ABSENT: "ATTENDANCE",
  RESULT: "EXAM_RESULT",
} as const satisfies Record<AutoSmsEvent, SmsCategory>;
