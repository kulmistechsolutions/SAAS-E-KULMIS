import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import type {
  CreateQuizInput,
  GradeQuizAnswerInput,
  SubmitQuizAttemptInput,
  UpdateQuizBuilderInput,
  VerifyQuizAccessInput,
} from "@ekulmis/shared";
import { PrismaService } from "../prisma/prisma.service";
import { TeachersService } from "../teachers/teachers.service";
import { AiService } from "../ai/ai.service";
import { SubscriptionsService } from "../subscriptions/subscriptions.service";
import { verifyPassword } from "../auth/password.util";

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

@Injectable()
export class QuizService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly teachers: TeachersService,
    private readonly ai: AiService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

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
    if (!dto.sectionId) {
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
          instructions: dto.instructions ?? null,
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
              // Legacy free-text types still need a human; the new DIRECT type is
              // auto-graded (exact now, AI in phase 2), MATCH/FILL are exact.
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

  async verifyAccess(schoolId: string, dto: VerifyQuizAccessInput) {
    return this.prisma.forTenant(schoolId, async (tx) => {
      const quiz = await tx.quiz.findFirst({
        where: { code: dto.quizCode },
        include: {
          class: { select: { name: true } },
          section: { select: { name: true } },
          subject: { select: { name: true } },
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
          portalPasswordHash: true,
        },
      });
      if (!student) throw new UnauthorizedException("Invalid student ID");
      const passwordOk =
        !!student.portalPasswordHash &&
        (await verifyPassword(dto.password, student.portalPasswordHash));
      if (!passwordOk) {
        throw new UnauthorizedException("Invalid student ID or password");
      }
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

      return {
        studentId: student.id,
        studentCode: student.code,
        studentName: student.fullName,
        remainingAttempts: quiz.maxAttempts - prior,
        quiz: {
          id: quiz.id,
          title: quiz.title,
          code: quiz.code,
          className: quiz.class.name,
          section: quiz.section?.name ?? null,
          subject: quiz.subject?.name ?? null,
          description: quiz.description,
          timeLimitMin: quiz.timeLimitMin,
          maxAttempts: quiz.maxAttempts,
          showResultsImmediately: quiz.showResultsImmediately,
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
        preventMinimize: quiz.preventMinimize,
        disableCopyPaste: quiz.disableCopyPaste,
        resetOnMinimize: quiz.resetOnMinimize,
        className: quiz.class.name,
        section: quiz.section?.name ?? null,
        subject: quiz.subject?.name ?? null,
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
        include: { _count: { select: { questions: true } } },
      });
      if (!quiz) throw new NotFoundException("Quiz not found");
      if (!quiz.sectionId) {
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

      const now = Date.now();
      const students_rows = students.map((s, idx) => {
        const attempt = latestAttemptByStudent.get(s.id) ?? null;
        let status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "TIME_EXPIRED" =
          "NOT_STARTED";
        if (attempt) {
          if (attempt.status === "IN_PROGRESS") {
            const deadline = quiz.timeLimitMin
              ? attempt.startedAt.getTime() + quiz.timeLimitMin * 60_000
              : null;
            status = deadline && now > deadline ? "TIME_EXPIRED" : "IN_PROGRESS";
          } else {
            status = "COMPLETED";
          }
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
          startTime: attempt?.startedAt ?? null,
          finishTime: attempt?.submittedAt ?? null,
          score: attempt?.score ?? null,
          percentage: attempt?.percentage ?? null,
        };
      });

      const summary = {
        total: students_rows.length,
        notStarted: students_rows.filter((r) => r.status === "NOT_STARTED").length,
        inProgress: students_rows.filter((r) => r.status === "IN_PROGRESS").length,
        completed: students_rows.filter((r) => r.status === "COMPLETED").length,
        timeExpired: students_rows.filter((r) => r.status === "TIME_EXPIRED").length,
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
   * AI_CONCEPT DIRECT is deferred to review (phase 2 wires the OpenAI scorer).
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

      const qmap = new Map(quiz.questions.map((q) => [q.id, q]));
      let score = 0;
      let totalMarks = 0;
      let hasManual = false;
      const aiPending: {
        answerId: string;
        question: string;
        modelAnswer: string;
        studentAnswer: string;
        maxMarks: number;
      }[] = [];

      const attempt = await tx.quizAttempt.create({
        data: {
          schoolId,
          quizId: quiz.id,
          studentId: dto.studentId,
          status: "SUBMITTED",
          submittedAt: new Date(),
        },
      });

      for (const ans of dto.answers) {
        const q = qmap.get(ans.questionId);
        if (!q) continue;
        totalMarks += q.marks;

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
            awardedPercentage:
              graded.needsReview
                ? null
                : q.marks > 0
                  ? Math.round((graded.marks / q.marks) * 100)
                  : 0,
          },
        });
        if (graded.needsReview) {
          // AI_CONCEPT DIRECT — scored by OpenAI after the transaction.
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
      await tx.quizAttempt.update({
        where: { id: attempt.id },
        data: {
          score,
          percentage,
          status: settledNow ? "GRADED" : "PENDING_REVIEW",
          result: settledNow ? (score >= passing ? "PASS" : "FAIL") : null,
        },
      });

      return {
        attemptId: attempt.id,
        aiPending,
        hasManual,
        autoScore: score,
        totalMarks,
        passing,
      };
    });

    // ── AI grading happens OUTSIDE the transaction (network call to OpenAI) ──
    if (prep.aiPending.length === 0) {
      return this.prisma.forTenant(schoolId, (tx) =>
        tx.quizAttempt.findFirst({ where: { id: prep.attemptId } }),
      );
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
    const attempt = await this.prisma.forTenant(schoolId, (tx) =>
      tx.quizAttempt.update({
        where: { id: prep.attemptId },
        data: {
          score: finalScore,
          percentage,
          status: pendingRemains ? "PENDING_REVIEW" : "GRADED",
          result: pendingRemains
            ? null
            : finalScore >= prep.passing
              ? "PASS"
              : "FAIL",
        },
      }),
    );
    return {
      ...attempt,
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
