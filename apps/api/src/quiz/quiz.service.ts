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
} from "@ekulmis/shared";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { TeachersService } from "../teachers/teachers.service";
import { AiService } from "../ai/ai.service";
import { SubscriptionsService } from "../subscriptions/subscriptions.service";
import { StorageService } from "../storage/storage.service";

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
          maxAttempts: dto.maxAttempts,
          passingMarks: dto.passingMarks ?? null,
          startAt: dto.startAt ? new Date(dto.startAt) : null,
          endAt: dto.endAt ? new Date(dto.endAt) : null,
          shuffleQuestions: dto.shuffleQuestions,
          shuffleAnswers: dto.shuffleAnswers,
          showResultsImmediately: dto.showResultsImmediately,
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
  async updateBuilder(
    schoolId: string,
    quizId: string,
    dto: UpdateQuizBuilderInput,
    opts?: { userId?: string; role?: string },
  ) {
    if (opts?.role === "TEACHER" && opts.userId) {
      await this.assertOwnsQuiz(schoolId, opts.userId, quizId);
    }
    return this.prisma.forTenant(schoolId, async (tx) => {
      const quiz = await tx.quiz.findFirst({
        where: { id: quizId },
        select: { id: true, status: true },
      });
      if (!quiz) throw new NotFoundException("Quiz not found");
      if (quiz.status !== "DRAFT") {
        throw new BadRequestException("Only draft quizzes can be edited");
      }

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
        },
      });

      if (dto.questions) {
        await tx.quizQuestion.deleteMany({ where: { quizId } });
        await tx.quiz.update({
          where: { id: quizId },
          data: {
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
                requiresManualGrade:
                  q.questionType === "ESSAY" ||
                  q.questionType === "SHORT_ANSWER",
                orderIndex: i,
              })),
            },
          },
        });
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
    },
    quiz: { classId: string; sectionId: string | null },
  ) {
    if (student.status !== "ACTIVE") {
      throw new ForbiddenException("Student account is not active");
    }
    if (student.classId !== quiz.classId) {
      throw new ForbiddenException("Student is not in the assigned class");
    }
    if (quiz.sectionId && student.sectionId !== quiz.sectionId) {
      throw new ForbiddenException("Student is not in the assigned section");
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
          questions: { select: { marks: true } },
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
          description: quiz.description,
          showResultsImmediately: quiz.showResultsImmediately,
          allowReviewAnswers: quiz.allowReviewAnswers,
          allowPdfDownload: quiz.allowPdfDownload,
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
        select: { id: true, status: true, classId: true, sectionId: true },
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
          questions: { select: { marks: true } },
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

  async getByCode(schoolId: string, code: string) {
    return this.prisma.forTenant(schoolId, async (tx) => {
      const quiz = await tx.quiz.findFirst({
        where: { code, status: "PUBLISHED" },
        include: {
          questions: { orderBy: { orderIndex: "asc" } },
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
        preventMinimize: quiz.preventMinimize,
        disableCopyPaste: quiz.disableCopyPaste,
        resetOnMinimize: quiz.resetOnMinimize,
        className: quiz.class.name,
        section: quiz.section?.name ?? null,
        subject: quiz.subject?.name ?? null,
        teacherName: quiz.teacher?.fullName ?? null,
        questions: questions.map((q) => {
          let options = Array.isArray(q.options) ? (q.options as string[]) : [];
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
          };
        }),
      };
    });
  }

  async publish(schoolId: string, quizId: string) {
    return this.prisma.forTenant(schoolId, async (tx) => {
      const quiz = await tx.quiz.findFirst({
        where: { id: quizId },
        include: {
          _count: { select: { questions: true } },
          class: { select: { hasSections: true } },
        },
      });
      if (!quiz) throw new NotFoundException("Quiz not found");
      if (quiz.class.hasSections && !quiz.sectionId) {
        throw new BadRequestException("Quiz must target a specific section before publishing");
      }
      if (quiz._count.questions < 1) {
        throw new BadRequestException("Add at least one question before publishing");
      }
      return tx.quiz.update({
        where: { id: quizId },
        data: { status: "PUBLISHED", publishedAt: new Date() },
      });
    });
  }

  async getById(schoolId: string, quizId: string) {
    return this.prisma.forTenant(schoolId, async (tx) => {
      const quiz = await tx.quiz.findFirst({
        where: { id: quizId },
        include: {
          questions: { orderBy: { orderIndex: "asc" } },
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
          classId: quiz.classId,
          ...(quiz.sectionId ? { sectionId: quiz.sectionId } : {}),
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
        include: { questions: { select: { id: true } } },
      });
      if (!quiz) throw new NotFoundException("Quiz not found");
      this.assertQuizWindow(quiz);

      const student = await tx.student.findFirst({
        where: { id: dto.studentId },
        select: { id: true, status: true, classId: true, sectionId: true },
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
      const totalMarks = attempt.quiz.questions.reduce((s, q) => s + q.marks, 0);
      let attempted = 0;
      let correct = 0;
      let incorrect = 0;
      let unanswered = 0;

      const questions = attempt.quiz.questions.map((q, i) => {
        const a = answerMap.get(q.id);
        const studentAnswer = a?.answer?.trim() ? a.answer : "";
        const answered = !!studentAnswer;
        if (!answered) unanswered++;
        else {
          attempted++;
          if (a?.isCorrect) correct++;
          else incorrect++;
        }
        let correctDisplay = q.correctAnswer;
        if (q.questionType === "MATCH" && Array.isArray(q.pairs)) {
          correctDisplay = (q.pairs as { left: string; right: string }[])
            .map((p) => `${p.left} → ${p.right}`)
            .join("; ");
        } else if (q.questionType === "FILL_BLANK" && Array.isArray(q.blanks)) {
          correctDisplay = (q.blanks as string[]).join(", ");
        }
        return {
          number: i + 1,
          questionId: q.id,
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
        },
        date: attempt.submittedAt ?? attempt.startedAt,
        timeTakenSec,
        totalQuestions: attempt.quiz.questions.length,
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
    },
    answer: string,
  ): { marks: number; isCorrect: boolean; needsReview: boolean } {
    switch (q.questionType) {
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
        include: { questions: true },
      });
      if (!quiz) throw new NotFoundException("Quiz not found");
      this.assertQuizWindow(quiz);

      const student = await tx.student.findFirst({
        where: { id: dto.studentId },
        select: { id: true, status: true, classId: true, sectionId: true },
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
          },
        });
      }

      // Clear prior autosaved rows then rewrite with final answers.
      await tx.quizAnswer.deleteMany({ where: { attemptId: attempt.id } });

      const qmap = new Map(quiz.questions.map((q) => [q.id, q]));
      let score = 0;
      const totalMarks = quiz.questions.reduce((s, q) => s + q.marks, 0);
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

  async gradeAnswer(
    schoolId: string,
    attemptId: string,
    answerId: string,
    dto: GradeQuizAnswerInput,
    opts?: { userId?: string; role?: string },
  ) {
    return this.prisma.forTenant(schoolId, async (tx) => {
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
      if (!question?.requiresManualGrade) {
        throw new BadRequestException("This answer does not require manual grading");
      }
      if (dto.marks > question.marks) {
        throw new BadRequestException(`Marks cannot exceed ${question.marks}`);
      }

      await tx.quizAnswer.update({
        where: { id: answerId },
        data: {
          marks: dto.marks,
          isCorrect: dto.marks === question.marks,
        },
      });

      const allAnswers = await tx.quizAnswer.findMany({
        where: { attemptId },
      });
      const qmap = new Map(
        answer.attempt.quiz.questions.map((q) => [q.id, q]),
      );
      let pending = false;
      let score = 0;
      let totalMarks = 0;
      for (const a of allAnswers) {
        const q = qmap.get(a.questionId);
        if (!q) continue;
        totalMarks += q.marks;
        if (q.requiresManualGrade && a.marks === 0 && !a.answer) {
          pending = true;
        }
        score += a.marks;
      }

      const passing =
        answer.attempt.quiz.passingMarks ??
        Math.ceil(totalMarks * 0.5);
      const percentage = totalMarks
        ? Math.round((score / totalMarks) * 1000) / 10
        : 0;

      return tx.quizAttempt.update({
        where: { id: attemptId },
        data: {
          score,
          percentage,
          result: pending ? null : score >= passing ? "PASS" : "FAIL",
          status: pending ? "PENDING_REVIEW" : "GRADED",
        },
      });
    });
  }
}
