import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { SmsService } from "./sms.service";
import { ExaminationsService } from "../examinations/examinations.service";
import { estimateSmsCredits, normalizeSomaliPhone } from "./hormuud.client";
import { renderSmsTemplate } from "./sms-template.util";
import {
  buildResultVars,
  positions,
  type StudentResult,
  type SubjectLineOptions,
} from "./exam-result-vars";

export interface ExamResultSmsOptions {
  examId: string;
  sectionId?: string | null;
  /** Empty means every student on the sheet. */
  studentIds?: string[];
  templateId?: string;
  /** Used when no template is named — the composer's own text. */
  body?: string;
  subjects?: string[];
  separator?: string;
  joiner?: string;
}

/** Why one student is not going to be texted, in words a school can act on. */
export type SkipReason =
  | "NO_MARKS"
  | "NO_PHONE"
  | "ALREADY_SENT";

export interface PreparedResultSms {
  studentId: string;
  studentName: string;
  studentCode: string;
  parentName: string;
  phone: string;
  body: string;
  characters: number;
  segments: number;
  position: number | null;
  average: number;
  passed: boolean;
  skip: SkipReason | null;
  /** When it was sent before, so the school can look at what went out. */
  previouslySentAt: string | null;
}

/**
 * Exam results, to the parent, by SMS.
 *
 * Deliberately not a second system. The marks, the totals, the grade ladder
 * and the pass mark all come from the same result sheet a school prints, so a
 * parent cannot be told one thing and the office shown another. What is added
 * here is the part nothing else needed: where the child placed, which parent
 * to text, and what it costs before anyone presses send.
 *
 * Nothing is sent for an exam that has not been published. A result still
 * being marked is not a result, and a message to four hundred parents cannot
 * be taken back.
 */
@Injectable()
export class ExamResultSmsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => SmsService))
    private readonly sms: SmsService,
    @Inject(forwardRef(() => ExaminationsService))
    private readonly exams: ExaminationsService,
  ) {}

  /**
   * Everything the send screen needs, without sending anything.
   *
   * Mandatory before a send: a school has to see the message its parents will
   * read, how many of them there are, who is being left out and why, and what
   * it will cost in credits. Every one of those is a question that can only be
   * answered by building the real messages, so they are built.
   */
  async preview(schoolId: string, opts: ExamResultSmsOptions) {
    const { exam, template, rows } = await this.prepare(schoolId, opts);

    const sending = rows.filter((r) => r.skip === null);
    const credits = sending.reduce((n, r) => n + r.segments, 0);
    const balance = await this.sms.creditBalance(schoolId).catch(() => 0);

    return {
      exam,
      templateName: template.name,
      body: template.body,
      rows,
      summary: {
        onSheet: rows.length,
        recipients: sending.length,
        messages: sending.length,
        credits,
        balance,
        shortfall: Math.max(0, credits - balance),
        noPhone: rows.filter((r) => r.skip === "NO_PHONE").length,
        noMarks: rows.filter((r) => r.skip === "NO_MARKS").length,
        alreadySent: rows.filter((r) => r.skip === "ALREADY_SENT").length,
        // The longest message decides whether a school is buying one segment
        // a parent or two, so it is the one worth showing.
        maxCharacters: sending.reduce((n, r) => Math.max(n, r.characters), 0),
        maxSegments: sending.reduce((n, r) => Math.max(n, r.segments), 0),
      },
    };
  }

  /**
   * Send them.
   *
   * `resend` is the school overriding the duplicate guard for students it has
   * already texted — asked for explicitly, per student, never as a side effect
   * of pressing send twice.
   */
  async send(
    schoolId: string,
    userId: string | undefined,
    opts: ExamResultSmsOptions & { resend?: boolean },
  ) {
    const { template, rows } = await this.prepare(schoolId, opts);

    const sending = rows.filter(
      (r) => r.skip === null || (opts.resend && r.skip === "ALREADY_SENT"),
    );
    if (sending.length === 0) {
      throw new BadRequestException(
        "Nobody to send to. Every student on this sheet is either unmarked, has no parent phone number, or has already been sent this result.",
      );
    }

    return this.sms.sendDirect(schoolId, userId, {
      category: "EXAM_RESULT",
      // So a second send can tell this exam's messages from any other.
      providerRefId: opts.examId,
      // Already rendered per student: the body carries no placeholders left to
      // fill, so the dispatcher's own substitution is a no-op over it.
      body: template.body,
      recipients: sending.map((r) => ({
        phone: r.phone,
        name: r.parentName,
        type: "PARENT" as const,
        refId: r.studentId,
        variables: r.variables,
      })),
    } as never);
  }

  /** The shared work behind preview and send, so the two cannot disagree. */
  private async prepare(schoolId: string, opts: ExamResultSmsOptions) {
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
      select: { name: true, phone: true, address: true },
    });

    const examRow = await this.prisma.forTenant(schoolId, (tx) =>
      tx.exam.findFirst({
        where: { id: opts.examId },
        select: {
          id: true,
          name: true,
          term: true,
          status: true,
          classId: true,
          sectionId: true,
          class: { select: { name: true } },
          academicYear: { select: { name: true } },
        },
      }),
    );
    if (!examRow) throw new NotFoundException("Exam not found.");

    // The gate the whole feature rests on. Marks still being entered are not a
    // result, and there is no unsending an SMS.
    if (examRow.status !== "PUBLISHED") {
      throw new BadRequestException(
        `Result not published — SMS cannot be sent. "${examRow.name}" is ${examRow.status.toLowerCase()}. Publish it first in Examinations → Results.`,
      );
    }

    const template = await this.resolveTemplate(schoolId, opts);

    const matrix = await this.exams.classResultsMatrix(schoolId, {
      classId: examRow.classId,
      examId: examRow.id,
      sectionId: opts.sectionId ?? examRow.sectionId ?? undefined,
    });

    const codes = await this.subjectCodes(
      schoolId,
      matrix.subjects.map((s) => s.subjectId),
    );

    // Placed over the whole sheet, not over the selection: a school texting
    // four parents is still telling them where their child came in the class.
    const rank = positions(
      matrix.rows.map((r) => ({
        studentId: r.studentId,
        totalObtained: r.totalObtained,
        marked: r.missingSubjects.length < matrix.subjects.length,
      })),
    );

    const wanted =
      opts.studentIds && opts.studentIds.length > 0
        ? new Set(opts.studentIds)
        : null;
    const chosen = matrix.rows.filter(
      (r) => !wanted || wanted.has(r.studentId),
    );

    const parents = await this.parentsOf(
      schoolId,
      chosen.map((r) => r.studentId),
    );
    const alreadySent = await this.alreadySent(
      schoolId,
      examRow.id,
      chosen.map((r) => r.studentId),
    );

    const lineOpts: SubjectLineOptions = {
      only: opts.subjects,
      separator: opts.separator,
      joiner: opts.joiner,
    };

    const rows = chosen.map((r) => {
      const placed = rank.get(r.studentId);
      const parent = parents.get(r.studentId);
      const marked = r.missingSubjects.length < matrix.subjects.length;

      const result: StudentResult = {
        studentId: r.studentId,
        studentName: r.studentName,
        studentCode: r.studentCode,
        className: matrix.exam.className,
        sectionName: matrix.exam.sectionName,
        subjects: matrix.subjects.map((s) => ({
          code: codes.get(s.subjectId) ?? s.name,
          name: s.name,
          mark: r.subjectMarks[s.subjectId] ?? null,
        })),
        totalObtained: r.totalObtained,
        totalMax: r.totalMax,
        average: r.average,
        grade: r.grade,
        passed: r.passed,
      };

      const variables = buildResultVars(
        result,
        {
          examName: examRow.name,
          term: examRow.term,
          academicYear: examRow.academicYear.name,
          schoolName: school?.name ?? "",
          schoolPhone: school?.phone ?? "",
          schoolAddress: school?.address ?? "",
          parentName: parent?.name ?? "",
          parentPhone: parent?.phone ?? "",
          position: placed?.position ?? 0,
          positionOf: placed?.outOf ?? 0,
          sectionPosition: null,
          sectionPositionOf: null,
          passLabel: "PASS",
          failLabel: "FAIL",
        },
        lineOpts,
      );

      const body = renderSmsTemplate(template.body, variables);
      const sentBefore = alreadySent.get(r.studentId) ?? null;

      const skip: SkipReason | null = !marked
        ? "NO_MARKS"
        : !parent?.phone
          ? "NO_PHONE"
          : sentBefore
            ? "ALREADY_SENT"
            : null;

      return {
        studentId: r.studentId,
        studentName: r.studentName,
        studentCode: r.studentCode,
        parentName: parent?.name ?? "",
        phone: parent?.phone ?? "",
        body,
        characters: body.length,
        segments: estimateSmsCredits(body),
        position: placed?.position ?? null,
        average: r.average,
        passed: r.passed,
        skip,
        previouslySentAt: sentBefore,
        variables,
      };
    });

    return {
      exam: {
        id: examRow.id,
        name: examRow.name,
        term: examRow.term,
        className: examRow.class.name,
        sectionName: matrix.exam.sectionName,
        academicYear: examRow.academicYear.name,
        status: examRow.status,
      },
      template,
      rows,
    };
  }

  /** The template a school named, or the one it uses for exam results. */
  private async resolveTemplate(schoolId: string, opts: ExamResultSmsOptions) {
    if (opts.body?.trim()) {
      return { id: null, name: "Custom", body: opts.body };
    }
    const tpl = await this.prisma.forTenant(schoolId, (tx) =>
      opts.templateId
        ? tx.smsTemplate.findFirst({
            where: { id: opts.templateId, isActive: true },
          })
        : tx.smsTemplate.findFirst({
            where: { category: "EXAM_RESULT", isActive: true },
            orderBy: { createdAt: "asc" },
          }),
    );
    if (!tpl) {
      throw new BadRequestException(
        "No exam-result SMS template. Create one in SMS → Templates, or write the message here.",
      );
    }
    return { id: tpl.id, name: tpl.name, body: tpl.body };
  }

  private async subjectCodes(schoolId: string, ids: string[]) {
    if (ids.length === 0) return new Map<string, string>();
    const rows = await this.prisma.forTenant(schoolId, (tx) =>
      tx.subject.findMany({
        where: { id: { in: ids } },
        select: { id: true, code: true },
      }),
    );
    return new Map(
      rows
        .filter((r) => r.code?.trim())
        .map((r) => [r.id, r.code!.trim()] as const),
    );
  }

  /**
   * The number to text about each student.
   *
   * The parent's own phone first, then the alternate they gave. A student with
   * neither is reported rather than skipped quietly — "no valid parent phone"
   * is something a school can fix, and a silent omission is not.
   */
  private async parentsOf(schoolId: string, studentIds: string[]) {
    if (studentIds.length === 0) {
      return new Map<string, { name: string; phone: string }>();
    }
    const rows = await this.prisma.forTenant(schoolId, (tx) =>
      tx.student.findMany({
        where: { id: { in: studentIds } },
        select: {
          id: true,
          parent: { select: { name: true, phone: true, altPhone: true } },
        },
      }),
    );
    const out = new Map<string, { name: string; phone: string }>();
    for (const r of rows) {
      const phone = r.parent?.phone?.trim() || r.parent?.altPhone?.trim() || "";
      out.set(r.id, { name: r.parent?.name ?? "", phone });
    }
    return out;
  }

  /**
   * Who has had this exam's result already.
   *
   * Matched on the student rather than the message body, because the body is
   * the school's to edit between sends and a reworded template is still the
   * same result going out twice. An exam sent, reworded and sent again is how
   * a parent gets two different-looking messages about one set of marks.
   */
  private async alreadySent(
    schoolId: string,
    examId: string,
    studentIds: string[],
  ) {
    if (studentIds.length === 0) return new Map<string, string>();
    const rows = await this.prisma.forTenant(schoolId, (tx) =>
      tx.smsMessage.findMany({
        where: {
          category: "EXAM_RESULT",
          recipientRefId: { in: studentIds },
          status: { not: "FAILED" },
          providerRefId: examId,
        },
        select: { recipientRefId: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      }),
    );
    const out = new Map<string, string>();
    for (const r of rows) {
      if (r.recipientRefId && !out.has(r.recipientRefId)) {
        out.set(r.recipientRefId, r.createdAt.toISOString());
      }
    }
    return out;
  }
}

export { normalizeSomaliPhone };
