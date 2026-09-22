import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type {
  CreateQuestionBankItemInput,
  QuestionBankFromQuizInput,
  QuestionBankListInput,
  QuestionBankUseInput,
  QuizQuestionInput,
  UpdateQuestionBankItemInput,
} from "@ekulmis/shared";
import { PrismaService } from "../prisma/prisma.service";
import { TeachersService } from "../teachers/teachers.service";
import { QuizService } from "./quiz.service";
import { questionContent } from "./question-content";

/** Who is asking, as far as the bank is concerned. */
interface Asker {
  userId: string;
  role: string;
  username?: string;
}

/** The languages a bank question can be filed under. */
const LANGUAGES = new Set(["AUTO", "so", "en", "ar"]);

/**
 * The school's question bank.
 *
 * Questions written once and used again. Two rules shape everything here:
 *
 * A bank question is copied into a quiz, never linked. Editing it afterwards
 * must not reach into a paper students have already sat — a published quiz
 * is an academic record — so "use" hands back a copy and the bank forgets
 * where it went, apart from counting that it was used.
 *
 * A teacher sees their own questions and the ones colleagues chose to share,
 * and edits only their own. Administrators see and edit everything in their
 * school. Nobody sees another school's: the table has row-level security like
 * every other tenant table, and every query runs inside forTenant.
 */
@Injectable()
export class QuestionBankService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly teachers: TeachersService,
    private readonly quiz: QuizService,
  ) {}

  /** The teacher this person is, when they are one. */
  private async teacherIdFor(schoolId: string, who: Asker): Promise<string | null> {
    if (who.role !== "TEACHER") return null;
    const t = await this.teachers.findByUserId(schoolId, who.userId);
    return t.id;
  }

  /** What this person may see: their own and shared, or everything. */
  private visible(teacherId: string | null): Prisma.QuestionBankItemWhereInput {
    if (!teacherId) return { archivedAt: null };
    return { archivedAt: null, OR: [{ teacherId }, { shared: true }] };
  }

  /** Whether this person may change or remove this question. */
  private canEdit(
    item: { teacherId: string | null },
    teacherId: string | null,
    who: Asker,
  ): boolean {
    if (who.role !== "TEACHER") return true;
    return !!teacherId && item.teacherId === teacherId;
  }

  async list(schoolId: string, who: Asker, f: QuestionBankListInput) {
    const teacherId = await this.teacherIdFor(schoolId, who);
    const and: Prisma.QuestionBankItemWhereInput[] = [this.visible(teacherId)];
    if (f.questionType) and.push({ questionType: f.questionType });
    if (f.language) and.push({ language: f.language });
    if (f.subjectId) and.push({ subjectId: f.subjectId });
    if (f.classId) and.push({ classId: f.classId });
    if (f.academicYearId) and.push({ academicYearId: f.academicYearId });
    if (f.difficulty) and.push({ difficulty: f.difficulty });
    if (f.teacherId) and.push({ teacherId: f.teacherId });
    if (f.topic) and.push({ topic: { equals: f.topic, mode: "insensitive" } });
    if (f.mine) {
      and.push(teacherId ? { teacherId } : { createdByUserId: who.userId });
    }
    if (f.q) {
      and.push({
        OR: [
          { question: { contains: f.q, mode: "insensitive" } },
          { topic: { contains: f.q, mode: "insensitive" } },
        ],
      });
    }
    const where: Prisma.QuestionBankItemWhereInput = { AND: and };

    return this.prisma.forTenant(schoolId, async (tx) => {
      const [total, rows] = await Promise.all([
        tx.questionBankItem.count({ where }),
        tx.questionBankItem.findMany({
          where,
          orderBy: { updatedAt: "desc" },
          skip: f.skip,
          take: f.take,
        }),
      ]);
      const names = await this.names(tx, rows);
      return {
        total,
        items: rows.map((r) => ({
          ...r,
          subjectName: r.subjectId ? (names.subjects.get(r.subjectId) ?? null) : null,
          className: r.classId ? (names.classes.get(r.classId) ?? null) : null,
          academicYearName: r.academicYearId
            ? (names.years.get(r.academicYearId) ?? null)
            : null,
          teacherName: r.teacherId
            ? (names.teachers.get(r.teacherId) ?? r.createdByName)
            : r.createdByName,
          canEdit: this.canEdit(r, teacherId, who),
        })),
      };
    });
  }

  /** Names for the ids on a page of results — four small lookups, not a join per row. */
  private async names(
    tx: Prisma.TransactionClient,
    rows: {
      subjectId: string | null;
      classId: string | null;
      academicYearId: string | null;
      teacherId: string | null;
    }[],
  ) {
    const ids = (k: keyof (typeof rows)[number]) =>
      [...new Set(rows.map((r) => r[k]).filter((v): v is string => !!v))];
    const [subjects, classes, years, teachers] = await Promise.all([
      tx.subject.findMany({ where: { id: { in: ids("subjectId") } }, select: { id: true, name: true } }),
      tx.class.findMany({ where: { id: { in: ids("classId") } }, select: { id: true, name: true } }),
      tx.academicYear.findMany({ where: { id: { in: ids("academicYearId") } }, select: { id: true, name: true } }),
      tx.teacher.findMany({ where: { id: { in: ids("teacherId") } }, select: { id: true, fullName: true } }),
    ]);
    return {
      subjects: new Map(subjects.map((s) => [s.id, s.name])),
      classes: new Map(classes.map((c) => [c.id, c.name])),
      years: new Map(years.map((y) => [y.id, y.name])),
      teachers: new Map(teachers.map((t) => [t.id, t.fullName])),
    };
  }

  /**
   * Everything the filters need, in one call.
   *
   * Served by the bank itself rather than read from the admin screens'
   * stores, which are empty for a teacher signed in to the teacher portal —
   * the filters would otherwise show nothing to the people most likely to use
   * them.
   */
  async options(schoolId: string, who: Asker) {
    const teacherId = await this.teacherIdFor(schoolId, who);
    return this.prisma.forTenant(schoolId, async (tx) => {
      const [subjects, classes, years, teachers, topics] = await Promise.all([
        tx.subject.findMany({
          where: { status: "ACTIVE" },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        }),
        tx.class.findMany({
          where: { status: "ACTIVE" },
          select: { id: true, name: true, academicYearId: true },
          orderBy: [{ orderIndex: "asc" }, { name: "asc" }],
        }),
        tx.academicYear.findMany({
          select: { id: true, name: true, isActive: true },
          orderBy: { name: "desc" },
        }),
        tx.teacher.findMany({
          where: { status: "ACTIVE" },
          select: { id: true, fullName: true },
          orderBy: { fullName: "asc" },
        }),
        tx.questionBankItem.findMany({
          where: { ...this.visible(teacherId), topic: { not: null } },
          select: { topic: true },
          distinct: ["topic"],
          orderBy: { topic: "asc" },
          take: 300,
        }),
      ]);
      return {
        subjects,
        classes,
        academicYears: years,
        teachers,
        topics: topics.map((t) => t.topic).filter((t): t is string => !!t),
        myTeacherId: teacherId,
      };
    });
  }

  /** The stored form of a question, with fields of other types cleared. */
  private content(q: QuizQuestionInput) {
    const c = questionContent(q);
    return {
      ...c,
      // On an update, undefined would mean "leave it" — so a question changed
      // from MATCH to MCQ would keep its old pairs forever. Cleared instead.
      pairs: (c.pairs as Prisma.InputJsonValue | undefined) ?? Prisma.DbNull,
      blanks: (c.blanks as Prisma.InputJsonValue | undefined) ?? Prisma.DbNull,
    };
  }

  async create(schoolId: string, who: Asker, dto: CreateQuestionBankItemInput) {
    const teacherId = await this.teacherIdFor(schoolId, who);
    return this.prisma.forTenant(schoolId, (tx) =>
      tx.questionBankItem.create({
        data: {
          schoolId,
          teacherId,
          createdByUserId: who.userId,
          createdByName: who.username ?? null,
          subjectId: dto.meta.subjectId ?? null,
          classId: dto.meta.classId ?? null,
          academicYearId: dto.meta.academicYearId ?? null,
          topic: dto.meta.topic || null,
          difficulty: dto.meta.difficulty,
          language: dto.meta.language,
          shared: dto.meta.shared,
          ...this.content(dto.question),
        },
      }),
    );
  }

  async update(
    schoolId: string,
    who: Asker,
    id: string,
    dto: UpdateQuestionBankItemInput,
  ) {
    const teacherId = await this.teacherIdFor(schoolId, who);
    return this.prisma.forTenant(schoolId, async (tx) => {
      const item = await tx.questionBankItem.findFirst({
        where: { id, ...this.visible(teacherId) },
      });
      if (!item) throw new NotFoundException("Question not found");
      if (!this.canEdit(item, teacherId, who)) {
        throw new ForbiddenException("You can only change questions you wrote");
      }
      const m = dto.meta ?? {};
      return tx.questionBankItem.update({
        where: { id },
        data: {
          ...(m.subjectId !== undefined ? { subjectId: m.subjectId ?? null } : {}),
          ...(m.classId !== undefined ? { classId: m.classId ?? null } : {}),
          ...(m.academicYearId !== undefined
            ? { academicYearId: m.academicYearId ?? null }
            : {}),
          ...(m.topic !== undefined ? { topic: m.topic || null } : {}),
          ...(m.difficulty ? { difficulty: m.difficulty } : {}),
          ...(m.language ? { language: m.language } : {}),
          ...(m.shared !== undefined ? { shared: m.shared } : {}),
          ...(dto.question ? this.content(dto.question) : {}),
        },
      });
    });
  }

  /**
   * Take a question out of the bank.
   *
   * Archived, not deleted: a question that has been used is part of where a
   * paper came from, and nothing a school wrote should disappear because
   * somebody tidied a list.
   */
  async archive(schoolId: string, who: Asker, id: string) {
    const teacherId = await this.teacherIdFor(schoolId, who);
    return this.prisma.forTenant(schoolId, async (tx) => {
      const item = await tx.questionBankItem.findFirst({
        where: { id, ...this.visible(teacherId) },
      });
      if (!item) throw new NotFoundException("Question not found");
      if (!this.canEdit(item, teacherId, who)) {
        throw new ForbiddenException("You can only remove questions you wrote");
      }
      await tx.questionBankItem.update({
        where: { id },
        data: { archivedAt: new Date() },
      });
      return { ok: true };
    });
  }

  /**
   * Save questions from a quiz into the bank.
   *
   * Filed under the quiz's own subject, class, year and language, so the
   * teacher only has to say the topic and how hard it is. A question already
   * in the bank — same words, same type, same answer, same author — is not
   * added twice; saving a paper to the bank a second time should not double
   * it.
   */
  async fromQuiz(schoolId: string, who: Asker, dto: QuestionBankFromQuizInput) {
    const teacherId = await this.teacherIdFor(schoolId, who);
    if (who.role === "TEACHER") {
      await this.quiz.assertOwnsQuiz(schoolId, who.userId, dto.quizId);
    }
    return this.prisma.forTenant(schoolId, async (tx) => {
      const quiz = await tx.quiz.findFirst({
        where: { id: dto.quizId },
        include: {
          questions: {
            where: { id: { in: dto.questionIds }, retiredAt: null },
            orderBy: { orderIndex: "asc" },
          },
        },
      });
      if (!quiz) throw new NotFoundException("Quiz not found");

      let added = 0;
      let skipped = 0;
      for (const q of quiz.questions) {
        const already = await tx.questionBankItem.findFirst({
          where: {
            archivedAt: null,
            question: q.question,
            questionType: q.questionType,
            correctAnswer: q.correctAnswer,
            ...(teacherId ? { teacherId } : { createdByUserId: who.userId }),
          },
          select: { id: true },
        });
        if (already) {
          skipped++;
          continue;
        }
        await tx.questionBankItem.create({
          data: {
            schoolId,
            teacherId,
            createdByUserId: who.userId,
            createdByName: who.username ?? null,
            subjectId: quiz.subjectId,
            classId: quiz.classId,
            academicYearId: quiz.academicYearId,
            topic: dto.topic || null,
            difficulty: dto.difficulty,
            language: LANGUAGES.has(quiz.language) ? quiz.language : "AUTO",
            shared: dto.shared,
            // Already sanitised when it was saved to the quiz; copied as is.
            question: q.question,
            questionHtml: q.questionHtml,
            questionType: q.questionType,
            options: q.options ?? [],
            optionsHtml: q.optionsHtml ?? Prisma.DbNull,
            correctAnswer: q.correctAnswer,
            gradingMode: q.gradingMode,
            pairs: q.pairs ?? Prisma.DbNull,
            blanks: q.blanks ?? Prisma.DbNull,
            acceptedAnswers: q.acceptedAnswers ?? Prisma.DbNull,
            marks: q.marks,
            // The quiz's own direction and face travel with the question, or
            // an Arabic question would arrive in its next quiz left-to-right.
            direction:
              q.direction ?? (quiz.direction && quiz.direction !== "AUTO" ? quiz.direction : null),
            contentFont: q.contentFont ?? quiz.contentFont,
          },
        });
        added++;
      }
      return { added, skipped };
    });
  }

  /**
   * Hand back copies of bank questions to put into a quiz.
   *
   * Copies, in the shape the quiz builder edits, with no id — so saving the
   * quiz creates new questions of its own and the bank keeps its originals.
   * Counted as used, which is how a school finds the questions worth keeping.
   */
  async use(schoolId: string, who: Asker, dto: QuestionBankUseInput) {
    const teacherId = await this.teacherIdFor(schoolId, who);
    return this.prisma.forTenant(schoolId, async (tx) => {
      const rows = await tx.questionBankItem.findMany({
        where: { id: { in: dto.ids }, ...this.visible(teacherId) },
      });
      if (rows.length) {
        await tx.questionBankItem.updateMany({
          where: { id: { in: rows.map((r) => r.id) } },
          data: { usageCount: { increment: 1 }, lastUsedAt: new Date() },
        });
      }
      const byId = new Map(rows.map((r) => [r.id, r]));
      return dto.ids
        .map((id) => byId.get(id))
        .filter((r): r is NonNullable<typeof r> => !!r)
        .map((r) => ({
          bankItemId: r.id,
          question: r.question,
          questionHtml: r.questionHtml,
          questionType: r.questionType,
          options: Array.isArray(r.options) ? (r.options as string[]) : [],
          optionsHtml: Array.isArray(r.optionsHtml) ? (r.optionsHtml as string[]) : null,
          correctAnswer: r.correctAnswer,
          gradingMode: r.gradingMode,
          pairs: Array.isArray(r.pairs) ? r.pairs : null,
          blanks: Array.isArray(r.blanks) ? r.blanks : null,
          acceptedAnswers: r.acceptedAnswers ?? null,
          marks: r.marks,
          direction: r.direction,
          contentFont: r.contentFont,
        }));
    });
  }
}
