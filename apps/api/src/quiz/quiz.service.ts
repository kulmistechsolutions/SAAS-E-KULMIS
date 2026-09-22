import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import type {
  ClearQuizAnswersInput,
  CreateQuizInput,
  GradeQuizAnswerInput,
  QuizLinkOpenedInput,
  SaveQuizAnswersInput,
  StartQuizAttemptInput,
  SubmitQuizAttemptInput,
  UpdateQuizBuilderInput,
  VerifyQuizAccessInput,
  DirectionSetting,
} from "@ekulmis/shared";
import {
  cleanTfAccepted,
  gradeTrueFalse,
  hasFormatting,
  quizDirectionSetting,
  resolveDirection,
  sanitizeRichText,
  tfLabels,
  type PracticeQuizSubmitInput,
  type TfAccepted,
  type UserRole,
} from "@ekulmis/shared";
import { AuditService } from "../audit/audit.service";
import { Prisma } from "@prisma/client";
import {
  diffQuestions,
  needsReplacement,
  nextVersion,
  summarise,
  type QuizEditMode,
  onPaper,
} from "./quiz-version";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { studentInClassWhere } from "../students/student-class.util";
import { TeachersService } from "../teachers/teachers.service";
import { AiService } from "../ai/ai.service";
import { SubscriptionsService } from "../subscriptions/subscriptions.service";
import { StorageService } from "../storage/storage.service";
import { NotificationsService } from "../notifications/notifications.service";

function padQuizSeq(n: number): string {
  return String(n).padStart(6, "0");
}

function shuffleArray<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

/**
 * The formatted options, put back in step with the order being served.
 *
 * The choices are shuffled per student, so the formatting has to travel with
 * the option it belongs to rather than with its position — otherwise the
 * highlight lands on a different answer for every student who sits the paper.
 */
function optionHtmlFor(
  q: { options: unknown; optionsHtml: unknown },
  served: string[],
): string[] | undefined {
  const html = Array.isArray(q.optionsHtml) ? (q.optionsHtml as string[]) : null;
  if (!html) return undefined;
  const original = Array.isArray(q.options) ? (q.options as string[]) : [];
  return served.map((opt) => {
    const at = original.indexOf(opt);
    return at >= 0 ? (html[at] ?? "") : "";
  });
}

/**
 * The right answer, as a person reads it on a result sheet.
 *
 * True / False is stored as the canonical TRUE or FALSE; the sheet says it in
 * the paper's own language, the same words the student saw on the buttons.
 */
function correctDisplayFor(
  q: {
    questionType: string;
    correctAnswer: string;
    pairs: unknown;
    blanks: unknown;
    question: string;
    direction: string | null;
  },
  quiz: { language: string | null; direction: string | null },
): string {
  if (q.questionType === "MATCH" && Array.isArray(q.pairs)) {
    return (q.pairs as { left: string; right: string }[])
      .map((p) => `${p.left} → ${p.right}`)
      .join("; ");
  }
  if (q.questionType === "FILL_BLANK" && Array.isArray(q.blanks)) {
    return (q.blanks as string[]).join(", ");
  }
  if (q.questionType === "TRUE_FALSE" || q.questionType === "TRUE_FALSE_WRITTEN") {
    const v = q.correctAnswer === "FALSE" ? "FALSE" : "TRUE";
    return tfLabelsFor(q, quiz)[v];
  }
  return q.correctAnswer;
}

/** The True / False words for this question's language and direction. */
function tfLabelsFor(
  q: { question: string; direction: string | null },
  quiz: { language: string | null; direction: string | null },
) {
  const setting = quizDirectionSetting(
    quiz.language,
    (q.direction ?? quiz.direction) as DirectionSetting,
  );
  return tfLabels(quiz.language, resolveDirection(setting, q.question));
}

function letterGrade(pct: number): string {
  if (pct >= 90) return "A";
  if (pct >= 80) return "B";
  if (pct >= 70) return "C";
  if (pct >= 60) return "D";
  return "F";
}

const DEFAULT_EXAM_RULES = [
  "Keep your Student ID and password confidential.",
  "Do not leave the exam window during the quiz.",
  "Do not use unauthorized materials or assistance.",
  "Submit before the timer expires — unanswered questions score zero.",
  "Academic honesty rules apply to all online assessments.",
].join("\n");

@Injectable()
export class QuizService {
  private readonly bucket: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly teachers: TeachersService,
    private readonly ai: AiService,
    private readonly subscriptions: SubscriptionsService,
    private readonly storage: StorageService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
    config: ConfigService,
  ) {
    this.bucket = config.get<string>("MINIO_BUCKET") ?? "ekulmis";
  }

  async list(
    schoolId: string,
    filters?: { academicYearId?: string; classId?: string; teacherId?: string },
  ) {
    return this.prisma.forTenant(schoolId, (tx) =>
      tx.quiz.findMany({
        where: {
          ...(filters?.academicYearId ? { academicYearId: filters.academicYearId } : {}),
          ...(filters?.classId ? { classId: filters.classId } : {}),
          ...(filters?.teacherId ? { teacherId: filters.teacherId } : {}),
        },
        orderBy: { createdAt: "desc" },
        include: {
          class: { select: { name: true } },
          section: { select: { name: true } },
          subject: { select: { name: true } },
          teacher: { select: { fullName: true } },
          _count: { select: { questions: true, attempts: true } },
        },
      }),
    );
  }

  async monitoring(schoolId: string) {
    const quizzes = await this.list(schoolId);
    const attemptStats = await this.prisma.forTenant(schoolId, (tx) =>
      tx.quizAttempt.groupBy({
        by: ["quizId"],
        where: { status: { in: ["GRADED", "PENDING_REVIEW", "SUBMITTED"] } },
        _count: { _all: true },
        _avg: { percentage: true },
      }),
    );
    const statMap = new Map(
      attemptStats.map((s) => [
        s.quizId,
        { attempts: s._count._all, avg: s._avg.percentage ?? 0 },
      ]),
    );

    const byStatus = {
      draft: quizzes.filter((q) => q.status === "DRAFT").length,
      published: quizzes.filter((q) => q.status === "PUBLISHED").length,
      closed: quizzes.filter((q) => q.status === "CLOSED").length,
      archived: quizzes.filter((q) => q.status === "ARCHIVED").length,
    };

    return {
      summary: {
        totalQuizzes: quizzes.length,
        ...byStatus,
        totalAttempts: attemptStats.reduce((n, s) => n + s._count._all, 0),
      },
      quizzes: quizzes.map((q) => ({
        id: q.id,
        title: q.title,
        code: q.code,
        status: q.status,
        teacherName: q.teacher.fullName,
        className: q.class.name,
        section: q.section?.name ?? null,
        subject: q.subject?.name ?? null,
        attemptCount: statMap.get(q.id)?.attempts ?? q._count.attempts,
        averageScore: Math.round((statMap.get(q.id)?.avg ?? 0) * 10) / 10,
        startAt: q.startAt,
        endAt: q.endAt,
      })),
    };
  }

  async dashboard(
    schoolId: string,
    opts?: { teacherId?: string },
  ) {
    const quizzes = await this.list(schoolId, { teacherId: opts?.teacherId });
    const quizIds = quizzes.map((q) => q.id);
    const attempts = quizIds.length
      ? await this.prisma.forTenant(schoolId, (tx) =>
          tx.quizAttempt.findMany({
            where: { quizId: { in: quizIds } },
            select: { quizId: true, percentage: true, status: true },
          }),
        )
      : [];

    const pendingReviews = await this.prisma.forTenant(schoolId, (tx) =>
      tx.quizAttempt.count({
        where: {
          status: "PENDING_REVIEW",
          ...(opts?.teacherId ? { quiz: { teacherId: opts.teacherId } } : {}),
        },
      }),
    );

    const scored = attempts.filter((a) => a.percentage != null);
    const averageScore = scored.length
      ? Math.round(
          (scored.reduce((s, a) => s + (a.percentage ?? 0), 0) / scored.length) *
            10,
        ) / 10
      : 0;

    return {
      totalQuizzes: quizzes.length,
      activeQuizzes: quizzes.filter((q) => q.status === "PUBLISHED").length,
      draftQuizzes: quizzes.filter((q) => q.status === "DRAFT").length,
      completedQuizzes: quizzes.filter(
        (q) => q.status === "CLOSED" || q.status === "ARCHIVED",
      ).length,
      totalAttempts: attempts.length,
      averageScore,
      pendingReviews,
    };
  }

  private async nextQuizCode(
    schoolId: string,
    tx: {
      counter: {
        upsert: (args: {
          where: { schoolId_name: { schoolId: string; name: string } };
          create: { schoolId: string; name: string; value: number };
          update: { value: { increment: number } };
        }) => Promise<{ value: number }>;
      };
    },
  ) {
    const year = new Date().getFullYear();
    const seq = await tx.counter.upsert({
      where: { schoolId_name: { schoolId, name: "quiz" } },
      create: { schoolId, name: "quiz", value: 1 },
      update: { value: { increment: 1 } },
    });
    return `QZ-${year}-${padQuizSeq(seq.value)}`;
  }

  /**
   * A school's Online Quiz Settings — the starting point for every new quiz
   * it creates. All default permissively, so a school that has never opened
   * that page keeps exactly the behaviour it has today.
   */
  async quizDefaults(schoolId: string): Promise<{
    maxAttempts: number;
    autoSubmit: boolean;
    autoSave: boolean;
    showResultsImmediately: boolean;
    questionRandomization: boolean;
  }> {
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
      select: { quizSettings: true },
    });
    const s = school?.quizSettings as Record<string, unknown> | null;
    return {
      maxAttempts: (s?.maxAttempts as number) ?? 1,
      autoSubmit: (s?.autoSubmit as boolean) ?? true,
      autoSave: (s?.autoSave as boolean) ?? true,
      showResultsImmediately: (s?.showResultsImmediately as boolean) ?? true,
      questionRandomization: (s?.questionRandomization as boolean) ?? false,
    };
  }

  async create(
    schoolId: string,
    dto: CreateQuizInput,
    opts?: { userId?: string; role?: string },
  ) {
    const cls = await this.prisma.forTenant(schoolId, (tx) =>
      tx.class.findFirst({
        where: { id: dto.classId },
        select: { hasSections: true },
      }),
    );
    if (!cls) throw new NotFoundException("Class not found");
    if (cls.hasSections && !dto.sectionId) {
      throw new BadRequestException(
        "Section is required — students from different sections must not be mixed",
      );
    }

    let teacherId = dto.teacherId;
    if (opts?.role === "TEACHER" && opts.userId) {
      teacherId = await this.teachers.assertOwnsAssignment(schoolId, opts.userId, {
        classId: dto.classId,
        sectionId: dto.sectionId,
        subjectId: dto.subjectId ?? undefined,
        academicYearId: dto.academicYearId,
      });
    }

    const defaults = await this.quizDefaults(schoolId);
    return this.prisma.forTenant(schoolId, async (tx) => {
      const code = await this.nextQuizCode(schoolId, tx);
      return tx.quiz.create({
        data: {
          schoolId,
          academicYearId: dto.academicYearId,
          classId: dto.classId,
          sectionId: dto.sectionId ?? null,
          subjectId: dto.subjectId ?? null,
          teacherId,
          title: dto.title,
          code,
          description: dto.description ?? null,
          timeLimitMin: dto.timeLimitMin ?? null,
          maxAttempts: dto.maxAttempts ?? defaults.maxAttempts,
          passingMarks: dto.passingMarks ?? null,
          startAt: dto.startAt ? new Date(dto.startAt) : null,
          endAt: dto.endAt ? new Date(dto.endAt) : null,
          shuffleQuestions:
            dto.shuffleQuestions ?? defaults.questionRandomization,
          shuffleAnswers: dto.shuffleAnswers,
          showResultsImmediately:
            dto.showResultsImmediately ?? defaults.showResultsImmediately,
          allowReviewAnswers: dto.allowReviewAnswers,
          allowPdfDownload: dto.allowPdfDownload,
          instructions: dto.instructions ?? null,
          examinationRules: dto.examinationRules ?? null,
          preventMinimize: dto.preventMinimize,
          disableCopyPaste: dto.disableCopyPaste,
          resetOnMinimize: dto.resetOnMinimize,
          questions: {
            create: dto.questions.map((q, i) => ({
              schoolId,
              question: q.question,
              questionType: q.questionType,
              options: q.options,
              correctAnswer: q.correctAnswer ?? "",
              gradingMode: q.gradingMode,
              pairs: q.questionType === "MATCH" ? q.pairs : undefined,
              blanks:
                q.questionType === "FILL_BLANK"
                  ? q.blanks.length
                    ? q.blanks
                    : [q.correctAnswer]
                  : undefined,
              marks: q.marks,
              // Legacy free-text types always need a human. DIRECT is graded
              // automatically — by exact match, or by AI when the teacher picks
              // AI_CONCEPT and a platform OpenAI key is configured. MCQ/MATCH/
              // FILL are always exact.
              requiresManualGrade:
                q.questionType === "ESSAY" || q.questionType === "SHORT_ANSWER",
              orderIndex: i,
            })),
          },
        },
        include: { questions: true, subject: { select: { name: true } } },
      });
    });
  }

  /** Edit a DRAFT quiz's settings and/or replace its whole question set. */
  /**
   * Write a quiz's questions without destroying what students have answered.
   *
   * The old save deleted every row and recreated it. That is fine on a draft
   * and ruinous on a published paper: answers reference question ids, so an
   * attempt survived with its score while the sheet behind it pointed at
   * nothing. The teacher saw the quiz they meant; the student saw marks
   * against questions that could not be shown.
   *
   * So identity is preserved. A question arriving with an id it already has is
   * updated in place. One with no id is new. One that has disappeared from the
   * paper is deleted only if nobody has answered it; otherwise it is retired —
   * off the paper, still on the record, so every sheet ever submitted resolves.
   */
  private async saveQuestions(
    tx: Prisma.TransactionClient,
    schoolId: string,
    quizId: string,
    incoming: NonNullable<UpdateQuizBuilderInput["questions"]>,
    mode: QuizEditMode = "CORRECTION",
  ) {
    const existing = await tx.quizQuestion.findMany({
      where: { quizId, retiredAt: null },
      orderBy: { orderIndex: "asc" },
    });
    const known = new Set(existing.map((q) => q.id));

    // What actually moved, so the change can be written down and so a new
    // version knows which questions it has to replace rather than edit.
    const diffs = diffQuestions(
      existing.map((q) => ({
        id: q.id,
        question: q.question,
        questionType: q.questionType,
        options: Array.isArray(q.options) ? (q.options as string[]) : [],
        correctAnswer: q.correctAnswer,
        marks: q.marks,
        pairs: (q.pairs as { left: string; right: string }[] | null) ?? [],
        blanks: (q.blanks as string[] | null) ?? [],
      })),
      incoming.map((q) => ({
        id: (q as { id?: string }).id,
        question: q.question,
        questionType: q.questionType,
        options: q.options,
        correctAnswer: q.correctAnswer,
        marks: q.marks,
        pairs: q.pairs,
        blanks: q.blanks,
      })),
    );
    const replace = new Set(
      diffs.filter((d) => mode === "NEW_VERSION" && needsReplacement(d)).map((d) => d.id),
    );

    const body = (q: (typeof incoming)[number], i: number) => {
      // Sanitised here, not in the browser. A question written at one school
      // is rendered in the browsers of students at every other school that
      // sits it, so what a request happens to contain decides nothing.
      const html = sanitizeRichText(q.questionHtml);
      const optionHtml = (q.optionsHtml ?? []).map((o) => sanitizeRichText(o));
      return {
      question: q.question,
      // Null when the teacher formatted nothing: the plain text is then the
      // whole truth, which is what every question in the system is today.
      questionHtml: hasFormatting(html) ? html : null,
      // DbNull, not undefined: on an update undefined means "leave it", and a
      // teacher who removed the formatting from every option would find it
      // still there after saving.
      optionsHtml: optionHtml.some((o) => hasFormatting(o)) ? optionHtml : Prisma.DbNull,
      // Only a written True / False question has words to accept; on anything
      // else a leftover list from a changed question type would be noise.
      acceptedAnswers:
        q.questionType === "TRUE_FALSE_WRITTEN"
          ? ((cleanTfAccepted(q.acceptedAnswers ?? null) ?? Prisma.DbNull) as
              | Prisma.InputJsonValue
              | typeof Prisma.DbNull)
          : Prisma.DbNull,
      questionType: q.questionType,
      options: q.options,
      correctAnswer: q.correctAnswer ?? "",
      gradingMode: q.gradingMode,
      pairs: q.questionType === "MATCH" ? q.pairs : undefined,
      blanks:
        q.questionType === "FILL_BLANK"
          ? q.blanks.length
            ? q.blanks
            : [q.correctAnswer]
          : undefined,
      marks: q.marks,
      requiresManualGrade:
        q.questionType === "ESSAY" || q.questionType === "SHORT_ANSWER",
      orderIndex: i,
      // Null follows the quiz, which is what almost every question wants.
      direction: q.direction ?? null,
      contentFont: q.contentFont ?? null,
      // Back on the paper if it had previously been taken off.
      retiredAt: null,
      };
    };

    const kept = new Set<string>();
    for (const [i, q] of incoming.entries()) {
      const id = (q as { id?: string }).id;

      // A new version replaces a question whose substance moved rather than
      // editing it: the old one is retired, a fresh row takes its place. Every
      // answer already given stays attached to the question it was given for,
      // which is the whole reason a school chooses this over a correction.
      if (id && known.has(id) && replace.has(id)) {
        await tx.quizQuestion.update({
          where: { id },
          data: { retiredAt: new Date() },
        });
        await tx.quizQuestion.create({
          data: { schoolId, quizId, ...body(q, i) },
        });
        kept.add(id);
        continue;
      }

      if (id && known.has(id)) {
        kept.add(id);
        await tx.quizQuestion.update({ where: { id }, data: body(q, i) });
      } else {
        await tx.quizQuestion.create({
          data: { schoolId, quizId, ...body(q, i) },
        });
      }
    }

    const dropped = existing.filter((q) => !kept.has(q.id)).map((q) => q.id);
    if (dropped.length === 0) return;

    const answered = await tx.quizAnswer.findMany({
      where: { questionId: { in: dropped } },
      select: { questionId: true },
      distinct: ["questionId"],
    });
    const answeredIds = new Set(answered.map((a) => a.questionId));

    // Nobody sat it: a draft being tidied should not leave ghosts behind.
    const removable = dropped.filter((id) => !answeredIds.has(id));
    if (removable.length > 0) {
      await tx.quizQuestion.deleteMany({ where: { id: { in: removable } } });
    }

    // Somebody did: off the paper, kept on the record.
    if (answeredIds.size > 0) {
      await tx.quizQuestion.updateMany({
        where: { id: { in: [...answeredIds] } },
        data: { retiredAt: new Date() },
      });
    }

    return diffs;
  }

  async updateBuilder(
    schoolId: string,
    quizId: string,
    dto: UpdateQuizBuilderInput,
    opts?: { userId?: string; role?: string; username?: string },
  ) {
    if (opts?.role === "TEACHER" && opts.userId) {
      await this.assertOwnsQuiz(schoolId, opts.userId, quizId);
    }
    return this.prisma.forTenant(schoolId, async (tx) => {
      const quiz = await tx.quiz.findFirst({
        where: { id: quizId },
        select: {
          id: true,
          status: true,
          version: true,
          passingMarks: true,
          _count: { select: { attempts: true } },
        },
      });
      if (!quiz) throw new NotFoundException("Quiz not found");
      if (quiz.status === "ARCHIVED") {
        throw new BadRequestException("Archived quizzes cannot be edited");
      }

      // A published quiz stayed frozen, which sounds safe until the thing that
      // needs fixing is the quiz itself — a pass mark set too high, a wrong
      // correct answer, a typo. Schools have to be able to fix their own paper,
      // so everything here is editable at any point.
      //
      // It used to cost them the answer sheets. Saving deleted every question
      // and recreated it with a new id, and answers are stored against question
      // ids with no foreign key to stop it, so an attempt kept its score while
      // its sheet pointed at questions that no longer existed. Ninety-four
      // answers across eleven attempts at four schools were already in that
      // state before this was found.
      //
      // Questions now keep their identity across a save: matched by id and
      // updated in place, created when new, and retired rather than deleted
      // once they have been answered. See saveQuestions below.

      const set = <K extends keyof UpdateQuizBuilderInput>(k: K) =>
        dto[k] !== undefined ? { [k]: dto[k] } : {};

      await tx.quiz.update({
        where: { id: quizId },
        data: {
          ...set("title"),
          ...set("description"),
          ...set("instructions"),
          ...set("timeLimitMin"),
          ...set("passingMarks"),
          ...set("maxAttempts"),
          ...set("shuffleQuestions"),
          ...set("shuffleAnswers"),
          ...set("showResultsImmediately"),
          ...set("allowReviewAnswers"),
          ...set("allowPdfDownload"),
          ...set("examinationRules"),
          ...set("preventMinimize"),
          ...set("disableCopyPaste"),
          ...set("resetOnMinimize"),
          ...set("language"),
          ...set("direction"),
          ...set("contentFont"),
          // Sanitised on the way in, never on the way out: what a request
          // happens to contain decides nothing about what is stored.
          ...(dto.instructionsHtml !== undefined
            ? {
                instructionsHtml: (() => {
                  const html = sanitizeRichText(dto.instructionsHtml);
                  return hasFormatting(html) ? html : null;
                })(),
              }
            : {}),
        },
      });

      if (dto.questions) {
        const mode: QuizEditMode = dto.editMode ?? "CORRECTION";
        const published = quiz.status !== "DRAFT";
        const diffs = (await this.saveQuestions(
          tx,
          schoolId,
          quizId,
          dto.questions,
          mode,
        )) ?? [];

        const changed = diffs.some((d) => d.kind !== "UNCHANGED");
        if (published && changed) {
          const version = nextVersion(quiz.version, mode, { published: true });
          await tx.quiz.update({
            where: { id: quizId },
            data: { version },
          });
          await tx.quizVersionChange.create({
            data: {
              schoolId,
              quizId,
              version,
              action: mode,
              summary: summarise(diffs),
              reason: dto.editReason ?? null,
              details: diffs.filter(
                (d) => d.kind !== "UNCHANGED",
              ) as unknown as Prisma.InputJsonValue,
              changedByUserId: opts?.userId ?? null,
              changedByName: opts?.username ?? null,
            },
          });
        }
      }

      // Pass/fail is stored on the attempt, decided by the pass mark as it
      // stood when the student submitted. Change the mark and those verdicts
      // are stale — at HUDEYFA every one of fifteen students read FAIL,
      // including 4 out of 5, against a mark the quiz could never reach. So a
      // new mark is applied to what has already been sat, not only to what
      // comes next.
      const passingChanged =
        dto.passingMarks !== undefined && dto.passingMarks !== quiz.passingMarks;
      if (passingChanged && quiz._count.attempts > 0) {
        const totalMarks = await tx.quizQuestion
          .aggregate({ where: { quizId }, _sum: { marks: true } })
          .then((r) => r._sum.marks ?? 0);
        const passing = dto.passingMarks ?? Math.ceil(totalMarks * 0.5);

        const settled = await tx.quizAttempt.findMany({
          where: { quizId, status: "GRADED" },
          select: { id: true, score: true },
        });
        for (const a of settled) {
          await tx.quizAttempt.update({
            where: { id: a.id },
            data: { result: (a.score ?? 0) >= passing ? "PASS" : "FAIL" },
          });
        }
      }

      return tx.quiz.findFirst({
        where: { id: quizId },
        include: { questions: { orderBy: { orderIndex: "asc" } } },
      });
    });
  }

  async assertOwnsQuiz(schoolId: string, userId: string, quizId: string) {
    const teacher = await this.teachers.findByUserId(schoolId, userId);
    const quiz = await this.prisma.forTenant(schoolId, (tx) =>
      tx.quiz.findFirst({ where: { id: quizId }, select: { teacherId: true } }),
    );
    if (!quiz) throw new NotFoundException("Quiz not found");
    if (quiz.teacherId !== teacher.id) {
      throw new ForbiddenException("You can only manage your own quizzes");
    }
    return teacher.id;
  }

  async resolveTeacherId(schoolId: string, userId: string) {
    const teacher = await this.teachers.findByUserId(schoolId, userId);
    return teacher.id;
  }

  private assertQuizWindow(quiz: {
    status: string;
    startAt: Date | null;
    endAt: Date | null;
  }) {
    if (quiz.status !== "PUBLISHED") {
      throw new BadRequestException("Quiz is not published");
    }
    const now = new Date();
    if (quiz.startAt && now < quiz.startAt) {
      throw new BadRequestException("Quiz has not started yet");
    }
    if (quiz.endAt && now > quiz.endAt) {
      throw new BadRequestException("Quiz window has ended");
    }
  }

  private assertStudentEligible(
    student: {
      status: string;
      classId: string;
      sectionId: string | null;
      extraClasses?: { classId: string; sectionId: string | null }[];
    },
    quiz: {
      classId: string;
      sectionId: string | null;
      class?: { name: string } | null;
      section?: { name: string } | null;
    },
  ) {
    if (student.status !== "ACTIVE") {
      throw new ForbiddenException(
        "This student account is not active. Ask the school office to check it.",
      );
    }
    // A quiz belongs to one class, and most of a school is not in it — at
    // HUDEYFA, 75 of 98 students. "Not in the assigned class" left them with
    // no idea what had gone wrong, so name the class it is actually for.
    const target = [quiz.class?.name, quiz.section?.name]
      .filter(Boolean)
      .join(" — ");
    const forWhom = target ? ` This quiz is for ${target}.` : "";

    const seats = [
      { classId: student.classId, sectionId: student.sectionId },
      ...(student.extraClasses ?? []),
    ].filter((s) => s.classId === quiz.classId);
    if (seats.length === 0) {
      throw new ForbiddenException(
        `You are not in the class this quiz was set for.${forWhom} Check the link with your teacher.`,
      );
    }
    if (quiz.sectionId && !seats.some((s) => s.sectionId === quiz.sectionId)) {
      throw new ForbiddenException(
        `You are in the right class but a different section.${forWhom} Check with your teacher.`,
      );
    }
  }

  /**
   * Resolve the school name/logo for the public quiz pages. `logoKey` is
   * always included alongside `logoUrl` so the frontend can fall back to the
   * public byte-proxy endpoint when the storage backend can't produce a
   * direct URL (local filesystem — see settings/school-logo.util.ts and
   * resolveLogoUrl on the web side).
   */
  private async schoolBranding(schoolId: string) {
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
      select: { name: true, logoKey: true, resultFooter: true },
    });
    let logoUrl: string | null = null;
    if (school?.logoKey) {
      try {
        logoUrl = await this.storage.getSignedUrl(
          this.bucket,
          school.logoKey,
          3600,
        );
      } catch {
        logoUrl = null;
      }
    }
    return {
      schoolName: school?.name ?? "School",
      logoUrl,
      logoKey: school?.logoKey ?? null,
      resultFooter: school?.resultFooter ?? null,
    };
  }

  private async recordActivity(
    tx: {
      quizActivityEvent: {
        create: (args: {
          data: {
            schoolId: string;
            quizId: string;
            studentId: string;
            event: string;
            meta?: object;
          };
        }) => Promise<unknown>;
      };
    },
    data: {
      schoolId: string;
      quizId: string;
      studentId: string;
      event: string;
      meta?: object;
    },
  ) {
    await tx.quizActivityEvent.create({ data });
  }

  /** Public landing metadata (no student auth). */
  async getLanding(schoolId: string, code: string) {
    const schoolQuizDefaults = await this.quizDefaults(schoolId);
    const branding = await this.schoolBranding(schoolId);
    return this.prisma.forTenant(schoolId, async (tx) => {
      const quiz = await tx.quiz.findFirst({
        where: { code, status: "PUBLISHED" },
        include: {
          class: { select: { name: true } },
          section: { select: { name: true } },
          subject: { select: { name: true } },
          teacher: { select: { fullName: true } },
          academicYear: { select: { name: true } },
          questions: { where: { retiredAt: null }, select: { marks: true } },
        },
      });
      if (!quiz) throw new NotFoundException("Quiz not found");
      this.assertQuizWindow(quiz);
      const totalMarks = quiz.questions.reduce((s, q) => s + q.marks, 0);
      return {
        ...branding,
        quiz: {
          id: quiz.id,
          title: quiz.title,
          code: quiz.code,
          subject: quiz.subject?.name ?? null,
          teacherName: quiz.teacher.fullName,
          className: quiz.class.name,
          section: quiz.section?.name ?? null,
          academicYear: quiz.academicYear.name,
          totalQuestions: quiz.questions.length,
          totalMarks,
          passingMarks: quiz.passingMarks ?? Math.ceil(totalMarks * 0.5),
          durationMin: quiz.timeLimitMin,
          instructions: quiz.instructions,
          examinationRules: quiz.examinationRules || DEFAULT_EXAM_RULES,
          instructionsHtml: quiz.instructionsHtml,
          description: quiz.description,
          showResultsImmediately: quiz.showResultsImmediately,
          allowReviewAnswers: quiz.allowReviewAnswers,
          allowPdfDownload: quiz.allowPdfDownload,
          // School-wide, not per quiz: how the paper behaves while it is
          // being sat (save as you go, hand in when time runs out).
          autoSubmit: schoolQuizDefaults.autoSubmit,
          autoSave: schoolQuizDefaults.autoSave,
        },
      };
    });
  }

  async recordLinkOpened(schoolId: string, dto: QuizLinkOpenedInput) {
    return this.prisma.forTenant(schoolId, async (tx) => {
      const quiz = await tx.quiz.findFirst({
        where: { code: dto.quizCode, status: "PUBLISHED" },
        select: { id: true, classId: true, sectionId: true, status: true, startAt: true, endAt: true },
      });
      if (!quiz) throw new NotFoundException("Quiz not found");
      this.assertQuizWindow(quiz);
      const student = await tx.student.findFirst({
        where: { code: dto.studentCode.trim() },
        select: { id: true, status: true, classId: true, sectionId: true, extraClasses: { select: { classId: true, sectionId: true } } },
      });
      if (!student) throw new UnauthorizedException("Invalid student ID");
      this.assertStudentEligible(student, quiz);
      const existing = await tx.quizActivityEvent.findFirst({
        where: {
          quizId: quiz.id,
          studentId: student.id,
          event: "LINK_OPENED",
        },
      });
      if (!existing) {
        await this.recordActivity(tx, {
          schoolId,
          quizId: quiz.id,
          studentId: student.id,
          event: "LINK_OPENED",
        });
      }
      return { ok: true };
    });
  }

  async verifyAccess(schoolId: string, dto: VerifyQuizAccessInput) {
    const schoolQuizDefaults = await this.quizDefaults(schoolId);
    const branding = await this.schoolBranding(schoolId);
    return this.prisma.forTenant(schoolId, async (tx) => {
      const quiz = await tx.quiz.findFirst({
        where: { code: dto.quizCode },
        include: {
          class: { select: { name: true } },
          section: { select: { name: true } },
          subject: { select: { name: true } },
          teacher: { select: { fullName: true } },
          academicYear: { select: { name: true } },
          questions: { where: { retiredAt: null }, select: { marks: true } },
        },
      });
      if (!quiz) throw new NotFoundException("Quiz not found");
      this.assertQuizWindow(quiz);

      const student = await tx.student.findFirst({
        where: { code: dto.studentCode.trim() },
        select: {
          id: true,
          code: true,
          fullName: true,
          status: true,
          classId: true,
          sectionId: true,
          photoKey: true,
          extraClasses: { select: { classId: true, sectionId: true } },
        },
      });
      if (!student) throw new UnauthorizedException("Invalid Student ID");
      this.assertStudentEligible(student, quiz);

      const prior = await tx.quizAttempt.count({
        where: {
          quizId: quiz.id,
          studentId: student.id,
          status: { in: ["SUBMITTED", "GRADED", "PENDING_REVIEW"] },
        },
      });
      if (prior >= quiz.maxAttempts) {
        throw new BadRequestException("Maximum attempts reached");
      }

      const inProgress = await tx.quizAttempt.findFirst({
        where: {
          quizId: quiz.id,
          studentId: student.id,
          status: "IN_PROGRESS",
        },
        orderBy: { startedAt: "desc" },
      });

      await this.recordActivity(tx, {
        schoolId,
        quizId: quiz.id,
        studentId: student.id,
        event: "LOGGED_IN",
      });

      const totalMarks = quiz.questions.reduce((s, q) => s + q.marks, 0);
      let photoUrl: string | null = null;
      if (student.photoKey) {
        try {
          photoUrl = await this.storage.getSignedUrl(
            this.bucket,
            student.photoKey,
            3600,
          );
        } catch {
          photoUrl = null;
        }
      }

      return {
        ...branding,
        studentId: student.id,
        studentCode: student.code,
        studentName: student.fullName,
        studentPhotoUrl: photoUrl,
        remainingAttempts: quiz.maxAttempts - prior,
        resumeAttemptId: inProgress?.id ?? null,
        quiz: {
          id: quiz.id,
          title: quiz.title,
          code: quiz.code,
          className: quiz.class.name,
          section: quiz.section?.name ?? null,
          subject: quiz.subject?.name ?? null,
          teacherName: quiz.teacher.fullName,
          academicYear: quiz.academicYear.name,
          description: quiz.description,
          instructions: quiz.instructions,
          examinationRules: quiz.examinationRules || DEFAULT_EXAM_RULES,
          instructionsHtml: quiz.instructionsHtml,
          timeLimitMin: quiz.timeLimitMin,
          maxAttempts: quiz.maxAttempts,
          totalQuestions: quiz.questions.length,
          totalMarks,
          passingMarks: quiz.passingMarks ?? Math.ceil(totalMarks * 0.5),
          showResultsImmediately: quiz.showResultsImmediately,
          allowReviewAnswers: quiz.allowReviewAnswers,
          allowPdfDownload: quiz.allowPdfDownload,
        },
      };
    });
  }

  /**
   * The paper, as this student should see it.
   *
   * `studentId` is what makes a mid-attempt student safe. A teacher who
   * publishes a new version while somebody is halfway through must not change
   * the questions under them: the student answered three of them already, and
   * swapping question 5 mid-sitting is how an answer ends up against a
   * question that was never asked.
   *
   * So a student with an attempt in progress is served the paper as it stood
   * when they started — questions that existed then, minus any retired before
   * then. Everyone else gets the current one.
   */
  /**
   * What has changed on this quiz, newest first.
   *
   * A published quiz is an academic record: once a student has sat it, any
   * change is an event somebody may have to account for later — a mark
   * queried, a result disputed — and "the teacher edited it at some point" is
   * not an answer.
   */
  async versionHistory(schoolId: string, quizId: string) {
    return this.prisma.forTenant(schoolId, async (tx) => {
      const quiz = await tx.quiz.findFirst({
        where: { id: quizId },
        select: { id: true, title: true, version: true, status: true },
      });
      if (!quiz) throw new NotFoundException("Quiz not found");

      const changes = await tx.quizVersionChange.findMany({
        where: { quizId },
        orderBy: { createdAt: "desc" },
      });

      // How many people sat each version, so a school reading this knows what
      // a change actually touched.
      const attempts = await tx.quizAttempt.groupBy({
        by: ["quizVersion"],
        where: { quizId },
        _count: { _all: true },
      });

      return {
        quiz,
        changes,
        attemptsByVersion: attempts.map((a) => ({
          version: a.quizVersion ?? "(before versions)",
          attempts: a._count._all,
        })),
      };
    });
  }

  async getByCode(schoolId: string, code: string, studentId?: string) {
    const schoolQuizDefaults = await this.quizDefaults(schoolId);
    return this.prisma.forTenant(schoolId, async (tx) => {
      const inProgress = studentId
        ? await tx.quizAttempt.findFirst({
            where: { studentId, status: "IN_PROGRESS", quiz: { code } },
            orderBy: { startedAt: "desc" },
            select: { startedAt: true },
          })
        : null;

      // As it stood then, or as it stands now.
      const asOf = inProgress?.startedAt;
      const paper = asOf
        ? {
            createdAt: { lte: asOf },
            OR: [{ retiredAt: null }, { retiredAt: { gt: asOf } }],
          }
        : { retiredAt: null };

      const quiz = await tx.quiz.findFirst({
        where: { code, status: "PUBLISHED" },
        include: {
          questions: {
            where: paper,
            orderBy: { orderIndex: "asc" },
          },
          class: { select: { name: true } },
          section: { select: { name: true } },
          subject: { select: { name: true } },
          teacher: { select: { fullName: true } },
        },
      });
      if (!quiz) throw new NotFoundException("Quiz not found");
      this.assertQuizWindow(quiz);

      let questions = quiz.questions;
      if (quiz.shuffleQuestions) {
        questions = shuffleArray(questions);
      }

      return {
        id: quiz.id,
        title: quiz.title,
        code: quiz.code,
        description: quiz.description,
        instructions: quiz.instructions,
        timeLimitMin: quiz.timeLimitMin,
        showResultsImmediately: quiz.showResultsImmediately,
        allowReviewAnswers: quiz.allowReviewAnswers,
        allowPdfDownload: quiz.allowPdfDownload,
        autoSubmit: schoolQuizDefaults.autoSubmit,
        autoSave: schoolQuizDefaults.autoSave,
        preventMinimize: quiz.preventMinimize,
        disableCopyPaste: quiz.disableCopyPaste,
        resetOnMinimize: quiz.resetOnMinimize,
        className: quiz.class.name,
        section: quiz.section?.name ?? null,
        subject: quiz.subject?.name ?? null,
        teacherName: quiz.teacher?.fullName ?? null,
        instructionsHtml: quiz.instructionsHtml,
        language: quiz.language,
        direction: quizDirectionSetting(
          quiz.language,
          quiz.direction as DirectionSetting,
        ),
        contentFont: quiz.contentFont,
        questions: this.servePaper(quiz, questions),
      };
    });
  }

  /**
   * The questions as a student is served them: shuffled if the quiz says so,
   * with everything needed to answer and nothing that gives the answer away.
   *
   * One function for the student's paper and the teacher's practice run, so
   * that what a teacher tests is what a student gets. Two copies would drift,
   * and the first difference would be a question that worked in practice and
   * broke in the exam.
   */
  private servePaper(
    quiz: { shuffleAnswers: boolean },
    questions: {
      id: string;
      question: string;
      questionType: string;
      options: unknown;
      optionsHtml: unknown;
      marks: number;
      pairs: unknown;
      blanks: unknown;
      direction: string | null;
      contentFont: string | null;
      questionHtml: string | null;
    }[],
  ) {
    return questions.map((q) => {
          const original = Array.isArray(q.options) ? (q.options as string[]) : [];
          let options = original;
          if (quiz.shuffleAnswers && options.length > 1) {
            options = shuffleArray(options);
          }
          // MATCH: expose the left prompts (in order) and a shuffled pool of the
          // right choices — never the correct pairing itself.
          const pairs = Array.isArray(q.pairs)
            ? (q.pairs as { left: string; right: string }[])
            : [];
          const matchLeft = pairs.map((p) => p.left);
          const matchChoices = shuffleArray(pairs.map((p) => p.right));
          // FILL_BLANK: tell the client how many blanks to render, not the answers.
          const blanks = Array.isArray(q.blanks) ? (q.blanks as string[]) : [];
          return {
            id: q.id,
            question: q.question,
            questionType: q.questionType,
            options,
            marks: q.marks,
            matchLeft: q.questionType === "MATCH" ? matchLeft : undefined,
            matchChoices: q.questionType === "MATCH" ? matchChoices : undefined,
            blankCount:
              q.questionType === "FILL_BLANK"
                ? Math.max(1, blanks.length)
                : undefined,
            direction: q.direction,
            contentFont: q.contentFont,
            questionHtml: q.questionHtml,
            // Index-aligned with the options as they were shuffled, or the
            // formatting would land on the wrong choice.
            optionsHtml: optionHtmlFor(q, options),
          };
    });
  }

  async publish(schoolId: string, quizId: string) {
    const published = await this.prisma.forTenant(schoolId, async (tx) => {
      const quiz = await tx.quiz.findFirst({
        where: { id: quizId },
        include: {
          _count: { select: { questions: true } },
          class: { select: { hasSections: true } },
          questions: { where: { retiredAt: null }, select: { marks: true } },
        },
      });
      if (!quiz) throw new NotFoundException("Quiz not found");
      if (quiz.class.hasSections && !quiz.sectionId) {
        throw new BadRequestException("Quiz must target a specific section before publishing");
      }
      if (quiz._count.questions < 1) {
        throw new BadRequestException("Add at least one question before publishing");
      }

      // A pass mark above what the questions are worth cannot be reached, so
      // every student fails however well they do — and nothing says why. The
      // pass mark is set before the questions exist, which is exactly how it
      // ends up out of step with them, so publishing is where it gets checked.
      const totalMarks = quiz.questions.reduce((sum, q) => sum + q.marks, 0);
      if (quiz.passingMarks != null && quiz.passingMarks > totalMarks) {
        throw new BadRequestException(
          `The pass mark is ${quiz.passingMarks} but this quiz is only worth ${totalMarks}. ` +
            "Nobody could pass it. Lower the pass mark or add more questions.",
        );
      }
      return tx.quiz.update({
        where: { id: quizId },
        data: { status: "PUBLISHED", publishedAt: new Date() },
      });
    });

    await this.notifications.notifyEvent(schoolId, "quizPublished", {
      title: "Quiz published",
      body: `${published.title} is now open to students.`,
      type: "QUIZ_PUBLISHED",
    });
    return published;
  }

  async getById(schoolId: string, quizId: string) {
    return this.prisma.forTenant(schoolId, async (tx) => {
      const quiz = await tx.quiz.findFirst({
        where: { id: quizId },
        include: {
          questions: {
            where: { retiredAt: null },
            orderBy: { orderIndex: "asc" },
          },
          class: { select: { name: true } },
          section: { select: { name: true } },
          subject: { select: { name: true } },
          teacher: { select: { fullName: true } },
          _count: { select: { attempts: true } },
        },
      });
      if (!quiz) throw new NotFoundException("Quiz not found");
      return quiz;
    });
  }

  async close(schoolId: string, quizId: string) {
    return this.prisma.forTenant(schoolId, async (tx) => {
      const quiz = await tx.quiz.findFirst({ where: { id: quizId } });
      if (!quiz) throw new NotFoundException("Quiz not found");
      return tx.quiz.update({
        where: { id: quizId },
        data: { status: "CLOSED" },
      });
    });
  }

  async archive(schoolId: string, quizId: string) {
    return this.prisma.forTenant(schoolId, async (tx) => {
      const quiz = await tx.quiz.findFirst({ where: { id: quizId } });
      if (!quiz) throw new NotFoundException("Quiz not found");
      return tx.quiz.update({
        where: { id: quizId },
        data: { status: "ARCHIVED" },
      });
    });
  }

  listAttempts(schoolId: string, quizId: string) {
    return this.prisma.forTenant(schoolId, (tx) =>
      tx.quizAttempt.findMany({
        where: { quizId },
        orderBy: { submittedAt: "desc" },
        include: {
          student: {
            select: {
              code: true,
              fullName: true,
              class: { select: { name: true } },
              section: { select: { name: true } },
            },
          },
          answers: {
            include: {
              attempt: false,
            },
          },
        },
      }),
    );
  }

  async liveMonitoring(schoolId: string, quizId: string) {
    return this.prisma.forTenant(schoolId, async (tx) => {
      const quiz = await tx.quiz.findFirst({
        where: { id: quizId },
        include: {
          class: { select: { name: true } },
          section: { select: { name: true } },
        },
      });
      if (!quiz) throw new NotFoundException("Quiz not found");

      const students = await tx.student.findMany({
        where: {
          ...studentInClassWhere(
            quiz.classId,
            quiz.sectionId ?? undefined,
          ),
          status: "ACTIVE",
        },
        orderBy: { fullName: "asc" },
        select: {
          id: true,
          code: true,
          fullName: true,
          class: { select: { name: true } },
          section: { select: { name: true } },
        },
      });

      const attempts = await tx.quizAttempt.findMany({
        where: { quizId },
        orderBy: { startedAt: "desc" },
        select: {
          id: true,
          studentId: true,
          status: true,
          score: true,
          percentage: true,
          startedAt: true,
          submittedAt: true,
        },
      });
      const latestAttemptByStudent = new Map<string, (typeof attempts)[number]>();
      for (const a of attempts) {
        if (!latestAttemptByStudent.has(a.studentId)) {
          latestAttemptByStudent.set(a.studentId, a);
        }
      }

      const events = await tx.quizActivityEvent.findMany({
        where: { quizId },
        orderBy: { createdAt: "asc" },
        select: {
          studentId: true,
          event: true,
          createdAt: true,
        },
      });
      const eventsByStudent = new Map<string, typeof events>();
      for (const e of events) {
        const list = eventsByStudent.get(e.studentId) ?? [];
        list.push(e);
        eventsByStudent.set(e.studentId, list);
      }

      const now = Date.now();
      type LiveStatus =
        | "LINK_NOT_OPENED"
        | "LINK_OPENED"
        | "LOGGED_IN"
        | "TAKING_QUIZ"
        | "SUBMITTED"
        | "TIME_EXPIRED";

      const students_rows = students.map((s, idx) => {
        const attempt = latestAttemptByStudent.get(s.id) ?? null;
        const studentEvents = eventsByStudent.get(s.id) ?? [];
        const hasLink = studentEvents.some((e) => e.event === "LINK_OPENED");
        const hasLogin = studentEvents.some((e) => e.event === "LOGGED_IN");
        const loginAt =
          studentEvents.find((e) => e.event === "LOGGED_IN")?.createdAt ?? null;
        const linkAt =
          studentEvents.find((e) => e.event === "LINK_OPENED")?.createdAt ?? null;

        let status: LiveStatus = "LINK_NOT_OPENED";
        if (attempt?.status === "IN_PROGRESS") {
          const deadline = quiz.timeLimitMin
            ? attempt.startedAt.getTime() + quiz.timeLimitMin * 60_000
            : null;
          status = deadline && now > deadline ? "TIME_EXPIRED" : "TAKING_QUIZ";
        } else if (attempt) {
          status = "SUBMITTED";
        } else if (hasLogin) {
          status = "LOGGED_IN";
        } else if (hasLink) {
          status = "LINK_OPENED";
        }

        return {
          no: idx + 1,
          studentId: s.id,
          studentCode: s.code,
          studentName: s.fullName,
          className: s.class.name,
          section: s.section?.name ?? null,
          status,
          attemptId: attempt?.id ?? null,
          linkOpenedAt: linkAt,
          loginAt,
          startTime: attempt?.startedAt ?? null,
          finishTime: attempt?.submittedAt ?? null,
          score: attempt?.score ?? null,
          percentage: attempt?.percentage ?? null,
          timeline: studentEvents.map((e) => ({
            event: e.event,
            at: e.createdAt,
          })),
        };
      });

      const summary = {
        total: students_rows.length,
        linkNotOpened: students_rows.filter((r) => r.status === "LINK_NOT_OPENED")
          .length,
        linkOpened: students_rows.filter((r) =>
          ["LINK_OPENED", "LOGGED_IN", "TAKING_QUIZ", "SUBMITTED", "TIME_EXPIRED"].includes(
            r.status,
          ),
        ).length,
        loggedIn: students_rows.filter((r) =>
          ["LOGGED_IN", "TAKING_QUIZ", "SUBMITTED", "TIME_EXPIRED"].includes(r.status),
        ).length,
        inProgress: students_rows.filter((r) => r.status === "TAKING_QUIZ").length,
        completed: students_rows.filter((r) => r.status === "SUBMITTED").length,
        timeExpired: students_rows.filter((r) => r.status === "TIME_EXPIRED").length,
        notStarted: students_rows.filter((r) => r.status === "LINK_NOT_OPENED").length,
      };

      return {
        quiz: {
          id: quiz.id,
          title: quiz.title,
          code: quiz.code,
          status: quiz.status,
          timeLimitMin: quiz.timeLimitMin,
          className: quiz.class.name,
          section: quiz.section?.name ?? null,
        },
        summary,
        students: students_rows,
      };
    });
  }

  async startAttempt(schoolId: string, dto: StartQuizAttemptInput) {
    return this.prisma.forTenant(schoolId, async (tx) => {
      const quiz = await tx.quiz.findFirst({
        where: { code: dto.quizCode, status: "PUBLISHED" },
        include: {
          questions: { select: { id: true } },
          class: { select: { name: true } },
          section: { select: { name: true } },
        },
      });
      if (!quiz) throw new NotFoundException("Quiz not found");
      this.assertQuizWindow(quiz);

      const student = await tx.student.findFirst({
        where: { id: dto.studentId },
        select: { id: true, status: true, classId: true, sectionId: true, extraClasses: { select: { classId: true, sectionId: true } } },
      });
      if (!student) throw new NotFoundException("Student not found");
      this.assertStudentEligible(student, quiz);

      const priorDone = await tx.quizAttempt.count({
        where: {
          quizId: quiz.id,
          studentId: dto.studentId,
          status: { in: ["SUBMITTED", "GRADED", "PENDING_REVIEW"] },
        },
      });
      if (priorDone >= quiz.maxAttempts) {
        throw new BadRequestException("Maximum attempts reached");
      }

      const existing = await tx.quizAttempt.findFirst({
        where: {
          quizId: quiz.id,
          studentId: dto.studentId,
          status: "IN_PROGRESS",
        },
        include: { answers: true },
        orderBy: { startedAt: "desc" },
      });
      if (existing) {
        const elapsedMs = Date.now() - existing.startedAt.getTime();
        const limitMs = (quiz.timeLimitMin ?? 30) * 60_000;
        if (quiz.timeLimitMin && elapsedMs >= limitMs) {
          await tx.quizAttempt.update({
            where: { id: existing.id },
            data: { status: "SUBMITTED", submittedAt: new Date(), result: "FAIL" },
          });
          await this.recordActivity(tx, {
            schoolId,
            quizId: quiz.id,
            studentId: dto.studentId,
            event: "TIME_EXPIRED",
          });
          throw new BadRequestException("Time expired on previous attempt");
        }
        return {
          attemptId: existing.id,
          startedAt: existing.startedAt,
          secondsLeft: quiz.timeLimitMin
            ? Math.max(0, Math.floor((limitMs - elapsedMs) / 1000))
            : null,
          savedAnswers: existing.answers.map((a) => ({
            questionId: a.questionId,
            answer: a.answer ?? "",
            markedForReview: a.markedForReview,
          })),
        };
      }

      const attempt = await tx.quizAttempt.create({
        data: {
          schoolId,
          quizId: quiz.id,
          studentId: dto.studentId,
          status: "IN_PROGRESS",
          // The paper this student is sitting. Recorded now, so a change made
          // while they are halfway through is a change to a different version
          // and not to theirs.
          quizVersion: quiz.version,
        },
      });
      await this.recordActivity(tx, {
        schoolId,
        quizId: quiz.id,
        studentId: dto.studentId,
        event: "QUIZ_STARTED",
      });

      return {
        attemptId: attempt.id,
        startedAt: attempt.startedAt,
        secondsLeft: quiz.timeLimitMin ? quiz.timeLimitMin * 60 : null,
        savedAnswers: [] as {
          questionId: string;
          answer: string;
          markedForReview: boolean;
        }[],
      };
    });
  }

  async saveAnswers(schoolId: string, dto: SaveQuizAnswersInput) {
    return this.prisma.forTenant(schoolId, async (tx) => {
      const attempt = await tx.quizAttempt.findFirst({
        where: { id: dto.attemptId, studentId: dto.studentId },
        include: { quiz: { select: { id: true, status: true, startAt: true, endAt: true } } },
      });
      if (!attempt) throw new NotFoundException("Attempt not found");
      if (attempt.status !== "IN_PROGRESS") {
        throw new BadRequestException("Attempt is no longer in progress");
      }
      this.assertQuizWindow(attempt.quiz);

      for (const ans of dto.answers) {
        await tx.quizAnswer.upsert({
          where: {
            schoolId_attemptId_questionId: {
              schoolId,
              attemptId: attempt.id,
              questionId: ans.questionId,
            },
          },
          create: {
            schoolId,
            attemptId: attempt.id,
            questionId: ans.questionId,
            answer: ans.answer,
            markedForReview: ans.markedForReview ?? false,
            isCorrect: false,
            marks: 0,
          },
          update: {
            answer: ans.answer,
            markedForReview: ans.markedForReview ?? false,
          },
        });
      }
      return { ok: true, savedAt: new Date() };
    });
  }

  /**
   * Delete every saved answer for an in-progress attempt. Used by the
   * reset-on-minimize anti-cheat: clearing the client alone isn't enough
   * because startAttempt reloads savedAnswers from the DB on resume, so the
   * server copy must be wiped too or the "reset" silently comes back.
   */
  async clearAnswers(schoolId: string, dto: ClearQuizAnswersInput) {
    return this.prisma.forTenant(schoolId, async (tx) => {
      const attempt = await tx.quizAttempt.findFirst({
        where: {
          id: dto.attemptId,
          studentId: dto.studentId,
          status: "IN_PROGRESS",
        },
        select: { id: true },
      });
      if (!attempt) return { ok: true, cleared: 0 };
      const res = await tx.quizAnswer.deleteMany({
        where: { attemptId: attempt.id },
      });
      return { ok: true, cleared: res.count };
    });
  }

  async getAttemptReview(
    schoolId: string,
    attemptId: string,
    opts?: { public?: boolean },
  ) {
    const branding = await this.schoolBranding(schoolId);
    return this.prisma.forTenant(schoolId, async (tx) => {
      const attempt = await tx.quizAttempt.findFirst({
        where: { id: attemptId },
        include: {
          student: {
            select: {
              code: true,
              fullName: true,
              photoKey: true,
              class: { select: { name: true } },
              section: { select: { name: true } },
            },
          },
          quiz: {
            include: {
              subject: { select: { name: true } },
              teacher: { select: { fullName: true } },
              // Every question, filtered below to the paper this attempt was
              // sat on — which may include one since retired.
              questions: { orderBy: { orderIndex: "asc" } },
            },
          },
          answers: true,
        },
      });
      if (!attempt) throw new NotFoundException("Attempt not found");
      if (
        opts?.public &&
        (attempt.status === "IN_PROGRESS" ||
          (!attempt.quiz.showResultsImmediately &&
            attempt.status !== "GRADED" &&
            attempt.status !== "PENDING_REVIEW"))
      ) {
        // Teachers still get full review via staff auth; the public student
        // path only sees the review once the quiz allows it.
        throw new BadRequestException("Result is not available yet");
      }

      const answerMap = new Map(attempt.answers.map((a) => [a.questionId, a]));
      const paper = attempt.quiz.questions.filter((q) => onPaper(q, attempt));
      const totalMarks = paper.reduce((s, q) => s + q.marks, 0);
      let attempted = 0;
      let correct = 0;
      let incorrect = 0;
      let unanswered = 0;

      const questions = paper.map((q, i) => {
        const a = answerMap.get(q.id);
        let studentAnswer = a?.answer?.trim() ? a.answer : "";
        // A button answer is stored as TRUE / FALSE; the sheet shows the word
        // the student actually pressed. A written one is shown as written.
        if (q.questionType === "TRUE_FALSE" && (studentAnswer === "TRUE" || studentAnswer === "FALSE")) {
          studentAnswer = tfLabelsFor(q, attempt.quiz)[studentAnswer];
        }
        const answered = !!studentAnswer;
        if (!answered) unanswered++;
        else {
          attempted++;
          if (a?.isCorrect) correct++;
          else incorrect++;
        }
        const correctDisplay = correctDisplayFor(q, attempt.quiz);
        return {
          number: i + 1,
          questionId: q.id,
          // The answer row, so a teacher reviewing the sheet can override it.
          answerId: a?.id ?? null,
          question: q.question,
          questionType: q.questionType,
          studentAnswer: studentAnswer || null,
          correctAnswer: correctDisplay,
          marksAwarded: a?.marks ?? 0,
          maxMarks: q.marks,
          status: !answered
            ? ("UNANSWERED" as const)
            : a?.isCorrect
              ? ("CORRECT" as const)
              : ("INCORRECT" as const),
          explanation: a?.aiFeedback ?? null,
          direction: q.direction,
          contentFont: q.contentFont,
          questionHtml: q.questionHtml,
        };
      });

      const pct = attempt.percentage ?? 0;
      const started = attempt.startedAt.getTime();
      const ended = (attempt.submittedAt ?? attempt.startedAt).getTime();
      const timeTakenSec = Math.max(0, Math.round((ended - started) / 1000));

      let photoUrl: string | null = null;
      if (attempt.student.photoKey) {
        try {
          photoUrl = await this.storage.getSignedUrl(
            this.bucket,
            attempt.student.photoKey,
            3600,
          );
        } catch {
          photoUrl = null;
        }
      }

      return {
        ...branding,
        attemptId: attempt.id,
        status: attempt.status,
        student: {
          id: attempt.studentId,
          code: attempt.student.code,
          name: attempt.student.fullName,
          photoUrl,
          className: attempt.student.class.name,
          section: attempt.student.section?.name ?? null,
        },
        quiz: {
          id: attempt.quiz.id,
          title: attempt.quiz.title,
          code: attempt.quiz.code,
          subject: attempt.quiz.subject?.name ?? null,
          teacherName: attempt.quiz.teacher.fullName,
          allowReviewAnswers: attempt.quiz.allowReviewAnswers,
          allowPdfDownload: attempt.quiz.allowPdfDownload,
          showResultsImmediately: attempt.quiz.showResultsImmediately,
          direction: quizDirectionSetting(
            attempt.quiz.language,
            attempt.quiz.direction as DirectionSetting,
          ),
          contentFont: attempt.quiz.contentFont,
        },
        date: attempt.submittedAt ?? attempt.startedAt,
        timeTakenSec,
        totalQuestions: paper.length,
        attempted,
        correct,
        incorrect,
        unanswered,
        totalMarks,
        marksObtained: attempt.score ?? 0,
        percentage: pct,
        grade: attempt.grade ?? letterGrade(pct),
        result: attempt.result,
        teacherComment: attempt.teacherComment,
        questions,
      };
    });
  }

  async getStudentTimeline(
    schoolId: string,
    quizId: string,
    studentId: string,
  ) {
    return this.prisma.forTenant(schoolId, async (tx) => {
      const events = await tx.quizActivityEvent.findMany({
        where: { quizId, studentId },
        orderBy: { createdAt: "asc" },
      });
      return events.map((e) => ({
        event: e.event,
        at: e.createdAt,
        meta: e.meta,
      }));
    });
  }

  studentAttempts(schoolId: string, studentId: string) {
    return this.prisma.forTenant(schoolId, (tx) =>
      tx.quizAttempt.findMany({
        where: { studentId },
        orderBy: { submittedAt: "desc" },
        include: {
          quiz: { select: { title: true, code: true } },
        },
      }),
    );
  }

  /**
   * Quizzes visible to one student — published/closed quizzes targeting
   * their home class or any additional class they sit in (see
   * studentInClassWhere's twin, studentSitsIn), each annotated with that
   * student's own attempt history. This is what backs both the student
   * portal's Quizzes tab and the staff-side "preview as student" tool —
   * previously both called a stub that always returned an empty list.
   */
  async listForStudent(schoolId: string, studentId: string) {
    return this.prisma.forTenant(schoolId, async (tx) => {
      const student = await tx.student.findFirst({
        where: { id: studentId },
        select: {
          classId: true,
          sectionId: true,
          extraClasses: { select: { classId: true, sectionId: true } },
        },
      });
      if (!student) throw new NotFoundException("Student not found");

      const seats = [
        { classId: student.classId, sectionId: student.sectionId },
        ...student.extraClasses,
      ];

      const quizzes = await tx.quiz.findMany({
        where: {
          status: { in: ["PUBLISHED", "CLOSED"] },
          OR: seats.map((seat) => ({
            AND: [
              { classId: seat.classId },
              { OR: [{ sectionId: null }, { sectionId: seat.sectionId }] },
            ],
          })),
        },
        orderBy: { createdAt: "desc" },
        include: {
          subject: { select: { name: true } },
          teacher: { select: { fullName: true } },
          _count: { select: { questions: true } },
        },
      });

      const attempts = await tx.quizAttempt.findMany({
        where: { studentId, quizId: { in: quizzes.map((q) => q.id) } },
        orderBy: { startedAt: "desc" },
      });
      const attemptsByQuiz = new Map<string, typeof attempts>();
      for (const a of attempts) {
        const arr = attemptsByQuiz.get(a.quizId) ?? [];
        arr.push(a);
        attemptsByQuiz.set(a.quizId, arr);
      }

      return quizzes.map((q) => {
        const mine = attemptsByQuiz.get(q.id) ?? [];
        const best =
          mine.find((a) => a.status === "GRADED") ??
          mine.find((a) => a.status === "SUBMITTED" || a.status === "PENDING_REVIEW") ??
          null;
        return {
          id: q.id,
          code: q.code,
          title: q.title,
          subject: q.subject?.name ?? null,
          teacherName: q.teacher.fullName,
          status: q.status,
          timeLimitMin: q.timeLimitMin,
          startAt: q.startAt,
          endAt: q.endAt,
          maxAttempts: q.maxAttempts,
          questionCount: q._count.questions,
          attemptsUsed: mine.length,
          canAttempt:
            q.status === "PUBLISHED" &&
            mine.length < q.maxAttempts &&
            (!q.startAt || q.startAt <= new Date()) &&
            (!q.endAt || q.endAt >= new Date()),
          lastResult: best
            ? { status: best.status, score: best.score, percentage: best.percentage, result: best.result }
            : null,
        };
      });
    });
  }

  private normalizeText(s: string | null | undefined): string {
    return (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  }

  /** Parse a MATCH/FILL answer that may be a JSON array or a single string. */
  private parseAnswerArray(answer: string): string[] {
    if (!answer) return [];
    try {
      const parsed = JSON.parse(answer);
      if (Array.isArray(parsed)) return parsed.map((x) => String(x ?? ""));
    } catch {
      /* plain text */
    }
    return [answer];
  }

  /**
   * Deterministic (non-AI) grading for MCQ, MATCH, FILL_BLANK and EXACT DIRECT.
   * AI_CONCEPT DIRECT returns needsReview so submitAttempt hands it to the AI
   * scorer (or teacher review when AI is unavailable).
   */
  private gradeExact(
    q: {
      questionType: string;
      correctAnswer: string;
      marks: number;
      gradingMode: string;
      pairs: unknown;
      blanks: unknown;
      acceptedAnswers?: unknown;
    },
    answer: string,
  ): { marks: number; isCorrect: boolean; needsReview: boolean } {
    switch (q.questionType) {
      // Both True / False types resolve the answer the same way: the buttons
      // send TRUE or FALSE, which the rules read back as themselves, and a
      // written answer is read in any of the languages plus the school's own
      // extra words for this question.
      case "TRUE_FALSE":
      case "TRUE_FALSE_WRITTEN": {
        const ok = gradeTrueFalse(
          answer,
          q.correctAnswer,
          q.questionType === "TRUE_FALSE_WRITTEN"
            ? (q.acceptedAnswers as TfAccepted | null)
            : null,
        );
        return { marks: ok ? q.marks : 0, isCorrect: ok, needsReview: false };
      }
      case "MCQ": {
        const ok = answer === q.correctAnswer;
        return { marks: ok ? q.marks : 0, isCorrect: ok, needsReview: false };
      }
      case "DIRECT": {
        if (q.gradingMode === "AI_CONCEPT") {
          return { marks: 0, isCorrect: false, needsReview: true };
        }
        const ok =
          this.normalizeText(answer) === this.normalizeText(q.correctAnswer);
        return { marks: ok ? q.marks : 0, isCorrect: ok, needsReview: false };
      }
      case "FILL_BLANK": {
        const blanks =
          Array.isArray(q.blanks) && q.blanks.length
            ? (q.blanks as string[])
            : [q.correctAnswer];
        const given = this.parseAnswerArray(answer);
        let correct = 0;
        blanks.forEach((b, i) => {
          if (this.normalizeText(given[i]) === this.normalizeText(b)) correct++;
        });
        const marks = Math.round((correct / blanks.length) * q.marks);
        return { marks, isCorrect: correct === blanks.length, needsReview: false };
      }
      case "MATCH": {
        const pairs = Array.isArray(q.pairs)
          ? (q.pairs as { left: string; right: string }[])
          : [];
        const given = this.parseAnswerArray(answer);
        let correct = 0;
        pairs.forEach((p, i) => {
          if (this.normalizeText(given[i]) === this.normalizeText(p.right)) correct++;
        });
        const marks = pairs.length
          ? Math.round((correct / pairs.length) * q.marks)
          : 0;
        return { marks, isCorrect: correct === pairs.length, needsReview: false };
      }
      default: {
        const ok = answer === q.correctAnswer;
        return { marks: ok ? q.marks : 0, isCorrect: ok, needsReview: false };
      }
    }
  }

  async submitAttempt(schoolId: string, dto: SubmitQuizAttemptInput) {
    const prep = await this.prisma.forTenant(schoolId, async (tx) => {
      const quiz = await tx.quiz.findFirst({
        where: { code: dto.quizCode, status: "PUBLISHED" },
        include: {
          questions: true,
          class: { select: { name: true } },
          section: { select: { name: true } },
        },
      });
      if (!quiz) throw new NotFoundException("Quiz not found");
      this.assertQuizWindow(quiz);

      const student = await tx.student.findFirst({
        where: { id: dto.studentId },
        select: { id: true, status: true, classId: true, sectionId: true, extraClasses: { select: { classId: true, sectionId: true } } },
      });
      if (!student) throw new NotFoundException("Student not found");
      this.assertStudentEligible(student, quiz);

      let attempt = dto.attemptId
        ? await tx.quizAttempt.findFirst({
            where: {
              id: dto.attemptId,
              studentId: dto.studentId,
              quizId: quiz.id,
            },
          })
        : await tx.quizAttempt.findFirst({
            where: {
              quizId: quiz.id,
              studentId: dto.studentId,
              status: "IN_PROGRESS",
            },
            orderBy: { startedAt: "desc" },
          });

      if (attempt && attempt.status !== "IN_PROGRESS") {
        throw new BadRequestException("This attempt was already submitted");
      }

      if (!attempt) {
        const prior = await tx.quizAttempt.count({
          where: {
            quizId: quiz.id,
            studentId: dto.studentId,
            status: { in: ["SUBMITTED", "GRADED", "PENDING_REVIEW"] },
          },
        });
        if (prior >= quiz.maxAttempts) {
          throw new BadRequestException("Maximum attempts reached");
        }
        attempt = await tx.quizAttempt.create({
          data: {
            schoolId,
            quizId: quiz.id,
            studentId: dto.studentId,
            status: "IN_PROGRESS",
            quizVersion: quiz.version,
          },
        });
      }

      // Clear prior autosaved rows then rewrite with final answers.
      await tx.quizAnswer.deleteMany({ where: { attemptId: attempt.id } });

      // The paper this student sat, not every question the quiz has ever had.
      // A retired question counted into the total would mark down every
      // student who sat the new version for a question they were never shown.
      const sat = attempt;
      const paper = quiz.questions.filter((q) => onPaper(q, sat));
      const qmap = new Map(paper.map((q) => [q.id, q]));
      let score = 0;
      const totalMarks = paper.reduce((s, q) => s + q.marks, 0);
      let hasManual = false;
      const aiPending: {
        answerId: string;
        question: string;
        modelAnswer: string;
        studentAnswer: string;
        maxMarks: number;
      }[] = [];

      for (const ans of dto.answers) {
        const q = qmap.get(ans.questionId);
        if (!q) continue;

        if (q.requiresManualGrade) {
          hasManual = true;
          await tx.quizAnswer.create({
            data: {
              schoolId,
              attemptId: attempt.id,
              questionId: q.id,
              answer: ans.answer,
              isCorrect: false,
              marks: 0,
              markedForReview: ans.markedForReview ?? false,
            },
          });
          continue;
        }

        const graded = this.gradeExact(q, ans.answer);
        const row = await tx.quizAnswer.create({
          data: {
            schoolId,
            attemptId: attempt.id,
            questionId: q.id,
            answer: ans.answer,
            isCorrect: graded.isCorrect,
            marks: graded.marks,
            markedForReview: ans.markedForReview ?? false,
            awardedPercentage:
              graded.needsReview
                ? null
                : q.marks > 0
                  ? Math.round((graded.marks / q.marks) * 100)
                  : 0,
          },
        });
        if (graded.needsReview) {
          aiPending.push({
            answerId: row.id,
            question: q.question,
            modelAnswer: q.correctAnswer,
            studentAnswer: ans.answer,
            maxMarks: q.marks,
          });
        } else {
          score += graded.marks;
        }
      }

      const passing = quiz.passingMarks ?? Math.ceil(totalMarks * 0.5);
      const settledNow = aiPending.length === 0 && !hasManual;
      const percentage = totalMarks
        ? Math.round((score / totalMarks) * 1000) / 10
        : 0;
      const grade = letterGrade(percentage);
      await tx.quizAttempt.update({
        where: { id: attempt.id },
        data: {
          score,
          percentage,
          grade,
          submittedAt: new Date(),
          status: settledNow ? "GRADED" : "PENDING_REVIEW",
          result: settledNow ? (score >= passing ? "PASS" : "FAIL") : null,
        },
      });

      await this.recordActivity(tx, {
        schoolId,
        quizId: quiz.id,
        studentId: dto.studentId,
        event: "QUIZ_SUBMITTED",
      });
      if (settledNow) {
        await this.recordActivity(tx, {
          schoolId,
          quizId: quiz.id,
          studentId: dto.studentId,
          event: "SCORE_GENERATED",
          meta: { score, percentage, grade },
        });
      }

      return {
        attemptId: attempt.id,
        aiPending,
        hasManual,
        autoScore: score,
        totalMarks,
        passing,
        showResultsImmediately: quiz.showResultsImmediately,
        allowReviewAnswers: quiz.allowReviewAnswers,
        allowPdfDownload: quiz.allowPdfDownload,
      };
    });

    // ── AI grading happens OUTSIDE the transaction (network call to OpenAI) ──
    if (prep.aiPending.length === 0) {
      const attempt = await this.prisma.forTenant(schoolId, (tx) =>
        tx.quizAttempt.findFirst({ where: { id: prep.attemptId } }),
      );
      return {
        ...attempt,
        allowReviewAnswers: prep.allowReviewAnswers,
        allowPdfDownload: prep.allowPdfDownload,
        showResultsImmediately: prep.showResultsImmediately,
      };
    }

    const aiEnabled = await this.ai.isEnabled();
    let aiScore = 0;
    let allAiGraded = aiEnabled;
    let aiQuotaExhausted = false;
    if (aiEnabled) {
      for (const item of prep.aiPending) {
        // Monthly AI grading quota is per-school (subscription plan). Once
        // exhausted, remaining answers just stay pending for manual review
        // instead of blocking the student's submission.
        const quotaOk = await this.subscriptions.tryConsumeAiGrading(schoolId);
        if (!quotaOk) {
          allAiGraded = false;
          aiQuotaExhausted = true;
          continue;
        }
        const res = await this.ai.gradeConcept(
          item.question,
          item.modelAnswer,
          item.studentAnswer,
        );
        if (!res) {
          allAiGraded = false;
          continue;
        }
        const marks = Math.round((res.score / 100) * item.maxMarks);
        aiScore += marks;
        await this.prisma.forTenant(schoolId, (tx) =>
          tx.quizAnswer.update({
            where: { id: item.answerId },
            data: {
              marks,
              isCorrect: res.score >= 50,
              awardedPercentage: res.score,
              aiFeedback: res.feedback,
            },
          }),
        );
      }
    }

    const finalScore = prep.autoScore + aiScore;
    const percentage = prep.totalMarks
      ? Math.round((finalScore / prep.totalMarks) * 1000) / 10
      : 0;
    const pendingRemains = prep.hasManual || !allAiGraded;
    const grade = letterGrade(percentage);
    const attempt = await this.prisma.forTenant(schoolId, async (tx) => {
      const updated = await tx.quizAttempt.update({
        where: { id: prep.attemptId },
        data: {
          score: finalScore,
          percentage,
          grade,
          status: pendingRemains ? "PENDING_REVIEW" : "GRADED",
          result: pendingRemains
            ? null
            : finalScore >= prep.passing
              ? "PASS"
              : "FAIL",
        },
      });
      if (!pendingRemains) {
        await this.recordActivity(tx, {
          schoolId,
          quizId: updated.quizId,
          studentId: updated.studentId,
          event: "SCORE_GENERATED",
          meta: { score: finalScore, percentage, grade },
        });
      }
      return updated;
    });
    return {
      ...attempt,
      allowReviewAnswers: prep.allowReviewAnswers,
      allowPdfDownload: prep.allowPdfDownload,
      showResultsImmediately: prep.showResultsImmediately,
      ...(aiQuotaExhausted
        ? { aiQuotaNote: this.subscriptions.getAiQuotaExhaustedMessage() }
        : {}),
    };
  }

  /**
   * Set the mark on one answer — grading one the system left to the teacher,
   * or overriding one it marked itself.
   *
   * The second is new, and it is why this is audited: a student writes "T"
   * for TRUE, the system marks it wrong, the teacher decides it should count.
   * That is a change to an academic record, so the mark before and after, the
   * student's actual answer and the reason go into the school's audit log
   * under the name of whoever made it.
   */
  async gradeAnswer(
    schoolId: string,
    attemptId: string,
    answerId: string,
    dto: GradeQuizAnswerInput,
    opts?: { userId?: string; role?: string; username?: string },
  ) {
    const done = await this.prisma.forTenant(schoolId, async (tx) => {
      const answer = await tx.quizAnswer.findFirst({
        where: { id: answerId, attemptId },
        include: {
          attempt: {
            include: {
              quiz: { include: { questions: true } },
            },
          },
        },
      });
      if (!answer) throw new NotFoundException("Answer not found");

      if (opts?.role === "TEACHER" && opts.userId) {
        await this.assertOwnsQuiz(
          schoolId,
          opts.userId,
          answer.attempt.quizId,
        );
      }

      const question = answer.attempt.quiz.questions.find(
        (q) => q.id === answer.questionId,
      );
      if (!question) {
        throw new BadRequestException("That question is no longer on this quiz");
      }
      if (dto.marks > question.marks) {
        throw new BadRequestException(`Marks cannot exceed ${question.marks}`);
      }
      const override = !question.requiresManualGrade;
      const before = { marks: answer.marks, isCorrect: answer.isCorrect };
      const scoreBefore = answer.attempt.score;

      await tx.quizAnswer.update({
        where: { id: answerId },
        data: {
          marks: dto.marks,
          isCorrect: dto.marks === question.marks,
          awardedPercentage: question.marks
            ? Math.round((dto.marks / question.marks) * 100)
            : 0,
        },
      });

      // Recomputed over the paper this attempt was sat on, the same way it was
      // scored at submission, so an override moves the total by exactly the
      // marks that changed and nothing else.
      const sat = answer.attempt;
      const paper = sat.quiz.questions.filter((q) => onPaper(q, sat));
      const allAnswers = await tx.quizAnswer.findMany({ where: { attemptId } });
      const byQuestion = new Map(allAnswers.map((a) => [a.questionId, a]));
      let pending = false;
      let score = 0;
      let totalMarks = 0;
      for (const q of paper) {
        totalMarks += q.marks;
        const a = byQuestion.get(q.id);
        if (!a) continue;
        if (q.requiresManualGrade && a.marks === 0 && !a.answer) pending = true;
        score += a.marks;
      }

      const passing = sat.quiz.passingMarks ?? Math.ceil(totalMarks * 0.5);
      const percentage = totalMarks
        ? Math.round((score / totalMarks) * 1000) / 10
        : 0;

      const updated = await tx.quizAttempt.update({
        where: { id: attemptId },
        data: {
          score,
          percentage,
          // Kept in step with the score: a grade left from before the change
          // would contradict the marks printed beside it.
          grade: letterGrade(percentage),
          result: pending ? null : score >= passing ? "PASS" : "FAIL",
          status: pending ? "PENDING_REVIEW" : "GRADED",
        },
      });

      return {
        updated,
        audit: {
          override,
          quizId: sat.quizId,
          quizTitle: sat.quiz.title,
          studentId: sat.studentId,
          questionId: question.id,
          questionType: question.questionType,
          question: question.question.slice(0, 200),
          studentAnswer: (answer.answer ?? "").slice(0, 200),
          maxMarks: question.marks,
          marksBefore: before.marks,
          marksAfter: dto.marks,
          correctBefore: before.isCorrect,
          correctAfter: dto.marks === question.marks,
          scoreBefore,
          scoreAfter: score,
        },
      };
    });

    await this.audit.record({
      schoolId,
      userId: opts?.userId ?? null,
      username: opts?.username ?? null,
      role: (opts?.role as UserRole | undefined) ?? null,
      module: "quiz",
      action: done.audit.override ? "QUIZ_MARK_OVERRIDDEN" : "QUIZ_ANSWER_GRADED",
      metadata: {
        ...done.audit,
        attemptId,
        answerId,
        reason: dto.reason ?? null,
      },
    });
    return done.updated;
  }

  /**
   * The paper, served to a teacher trying it.
   *
   * Any status — a draft is exactly when a teacher most needs to try it — and
   * no window, no student, no eligibility check. It is served through the same
   * function as a student's paper, so what the teacher sees is what a student
   * will get.
   */
  async practicePaper(schoolId: string, quizId: string) {
    const branding = await this.schoolBranding(schoolId);
    const schoolQuizDefaults = await this.quizDefaults(schoolId);
    return this.prisma.forTenant(schoolId, async (tx) => {
      const quiz = await tx.quiz.findFirst({
        where: { id: quizId },
        include: {
          questions: { where: { retiredAt: null }, orderBy: { orderIndex: "asc" } },
          class: { select: { name: true } },
          section: { select: { name: true } },
          subject: { select: { name: true } },
          teacher: { select: { fullName: true } },
        },
      });
      if (!quiz) throw new NotFoundException("Quiz not found");
      if (quiz.questions.length === 0) {
        throw new BadRequestException("Add a question before trying the quiz");
      }
      const questions = quiz.shuffleQuestions
        ? shuffleArray(quiz.questions)
        : quiz.questions;
      const totalMarks = quiz.questions.reduce((n, q) => n + q.marks, 0);

      return {
        ...branding,
        practice: true as const,
        status: quiz.status,
        version: quiz.version,
        totalMarks,
        passingMarks: quiz.passingMarks ?? Math.ceil(totalMarks * 0.5),
        examinationRules: quiz.examinationRules || DEFAULT_EXAM_RULES,
        paper: {
          id: quiz.id,
          title: quiz.title,
          code: quiz.code,
          description: quiz.description,
          instructions: quiz.instructions,
          instructionsHtml: quiz.instructionsHtml,
          timeLimitMin: quiz.timeLimitMin,
          showResultsImmediately: quiz.showResultsImmediately,
          allowReviewAnswers: quiz.allowReviewAnswers,
          allowPdfDownload: quiz.allowPdfDownload,
          autoSubmit: schoolQuizDefaults.autoSubmit,
          autoSave: schoolQuizDefaults.autoSave,
          preventMinimize: quiz.preventMinimize,
          disableCopyPaste: quiz.disableCopyPaste,
          resetOnMinimize: quiz.resetOnMinimize,
          className: quiz.class.name,
          section: quiz.section?.name ?? null,
          subject: quiz.subject?.name ?? null,
          teacherName: quiz.teacher?.fullName ?? null,
          language: quiz.language,
          direction: quizDirectionSetting(
            quiz.language,
            quiz.direction as DirectionSetting,
          ),
          contentFont: quiz.contentFont,
          questions: this.servePaper(quiz, questions),
        },
      };
    });
  }

  /**
   * Grade a teacher's practice run, and keep it where no report can see it.
   *
   * Graded by the same rules as a student's answers. The two things a real
   * attempt would do that this does not: spend the school's AI grading
   * allowance, and wait for a teacher's hand-marking. Those questions are
   * reported as pending with their marks shown separately, so the teacher sees
   * what the machine-graded part of the paper came to and knows the rest is
   * graded later.
   */
  async submitPractice(
    schoolId: string,
    quizId: string,
    user: { userId: string; username?: string },
    dto: PracticeQuizSubmitInput,
  ) {
    const branding = await this.schoolBranding(schoolId);
    return this.prisma.forTenant(schoolId, async (tx) => {
      const quiz = await tx.quiz.findFirst({
        where: { id: quizId },
        include: {
          questions: { where: { retiredAt: null }, orderBy: { orderIndex: "asc" } },
          class: { select: { name: true } },
          section: { select: { name: true } },
          subject: { select: { name: true } },
          teacher: { select: { fullName: true } },
        },
      });
      if (!quiz) throw new NotFoundException("Quiz not found");

      const given = new Map(dto.answers.map((a) => [a.questionId, a.answer ?? ""]));
      let score = 0;
      let totalMarks = 0;
      let pendingMarks = 0;
      let attempted = 0;
      let correct = 0;
      let incorrect = 0;
      let unanswered = 0;
      const stored: {
        questionId: string;
        answer: string;
        isCorrect: boolean;
        marks: number;
        pending: boolean;
      }[] = [];

      const questions = quiz.questions.map((q, i) => {
        totalMarks += q.marks;
        const answer = given.get(q.id) ?? "";
        const answered = answer.trim().length > 0;
        let marks = 0;
        let isCorrect = false;
        let pending = false;
        if (answered) {
          if (q.requiresManualGrade) {
            pending = true;
          } else {
            const g = this.gradeExact(q, answer);
            if (g.needsReview) pending = true;
            else {
              marks = g.marks;
              isCorrect = g.isCorrect;
            }
          }
        }
        if (pending) pendingMarks += q.marks;
        score += marks;
        if (!answered) unanswered++;
        else {
          attempted++;
          if (pending) {
            /* neither right nor wrong yet */
          } else if (isCorrect) correct++;
          else incorrect++;
        }
        stored.push({ questionId: q.id, answer, isCorrect, marks, pending });

        let shown = answered ? answer : "";
        if (q.questionType === "TRUE_FALSE" && (shown === "TRUE" || shown === "FALSE")) {
          shown = tfLabelsFor(q, quiz)[shown];
        }
        return {
          number: i + 1,
          questionId: q.id,
          answerId: null,
          question: q.question,
          questionType: q.questionType,
          studentAnswer: shown || null,
          correctAnswer: correctDisplayFor(q, quiz),
          marksAwarded: marks,
          maxMarks: q.marks,
          status: !answered
            ? ("UNANSWERED" as const)
            : pending
              ? ("PENDING" as const)
              : isCorrect
                ? ("CORRECT" as const)
                : ("INCORRECT" as const),
          explanation: null,
          direction: q.direction,
          contentFont: q.contentFont,
          questionHtml: q.questionHtml,
        };
      });

      const percentage = totalMarks
        ? Math.round((score / totalMarks) * 1000) / 10
        : 0;
      const grade = letterGrade(percentage);
      const passing = quiz.passingMarks ?? Math.ceil(totalMarks * 0.5);
      // With marks still to be given, pass or fail is not yet known.
      const result = pendingMarks > 0 ? null : score >= passing ? "PASS" : "FAIL";

      const row = await tx.quizPracticeAttempt.create({
        data: {
          schoolId,
          quizId: quiz.id,
          userId: user.userId,
          username: user.username ?? null,
          quizVersion: quiz.version,
          answers: stored as unknown as Prisma.InputJsonValue,
          score,
          totalMarks,
          pendingMarks,
          percentage,
          grade,
          result,
          timeTakenSec: dto.timeTakenSec,
        },
      });

      return {
        ...branding,
        practice: true as const,
        attemptId: row.id,
        status: "PRACTICE",
        student: {
          id: "",
          code: "PRACTICE",
          name: user.username ?? "Teacher",
          photoUrl: null,
          className: quiz.class.name,
          section: quiz.section?.name ?? null,
        },
        quiz: {
          id: quiz.id,
          title: quiz.title,
          code: quiz.code,
          subject: quiz.subject?.name ?? null,
          teacherName: quiz.teacher.fullName,
          allowReviewAnswers: true,
          allowPdfDownload: false,
          showResultsImmediately: true,
          direction: quizDirectionSetting(
            quiz.language,
            quiz.direction as DirectionSetting,
          ),
          contentFont: quiz.contentFont,
        },
        date: row.submittedAt,
        timeTakenSec: dto.timeTakenSec,
        totalQuestions: quiz.questions.length,
        attempted,
        correct,
        incorrect,
        unanswered,
        totalMarks,
        marksObtained: score,
        pendingMarks,
        percentage,
        grade,
        result,
        teacherComment: null,
        questions,
      };
    });
  }
}
