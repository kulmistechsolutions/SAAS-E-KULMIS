import { z } from "zod";
import { quizQuestionSchema } from "./quiz";

/**
 * The school's question bank.
 *
 * Questions a teacher has written once and wants to use again — next term,
 * in another section, in the end-of-year paper. A bank question is copied
 * into a quiz, never linked: editing it in the bank afterwards must not
 * reach into a paper students have already sat, because a published quiz is
 * an academic record.
 */

export const questionDifficultySchema = z.enum(["EASY", "MEDIUM", "HARD"]);
export type QuestionDifficulty = z.infer<typeof questionDifficultySchema>;

export const questionBankLanguageSchema = z.enum(["AUTO", "so", "en", "ar"]);

/** Everything about a bank question that is not the question itself. */
export const questionBankMetaSchema = z.object({
  subjectId: z.string().min(1).nullish(),
  classId: z.string().min(1).nullish(),
  academicYearId: z.string().min(1).nullish(),
  /** Free text — "Fractions", "Tajwiid: Idghaam" — so a school uses its own. */
  topic: z.string().trim().max(80).nullish(),
  difficulty: questionDifficultySchema.default("MEDIUM"),
  language: questionBankLanguageSchema.default("AUTO"),
  /**
   * Whether other teachers in the school can see and use it.
   *
   * On by default: a bank is worth most when a department shares it. A
   * teacher who wants a question to themselves turns it off.
   */
  shared: z.boolean().default(true),
});

export const createQuestionBankItemSchema = z.object({
  question: quizQuestionSchema,
  meta: questionBankMetaSchema,
});
export type CreateQuestionBankItemInput = z.infer<typeof createQuestionBankItemSchema>;

export const updateQuestionBankItemSchema = z.object({
  question: quizQuestionSchema.optional(),
  meta: questionBankMetaSchema.partial().optional(),
});
export type UpdateQuestionBankItemInput = z.infer<typeof updateQuestionBankItemSchema>;

/** Save questions from a quiz into the bank. */
export const questionBankFromQuizSchema = z.object({
  quizId: z.string().min(1),
  questionIds: z.array(z.string().min(1)).min(1).max(200),
  topic: z.string().trim().max(80).nullish(),
  difficulty: questionDifficultySchema.default("MEDIUM"),
  shared: z.boolean().default(true),
});
export type QuestionBankFromQuizInput = z.infer<typeof questionBankFromQuizSchema>;

/** Take bank questions out, to be added to a quiz. */
export const questionBankUseSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(100),
});
export type QuestionBankUseInput = z.infer<typeof questionBankUseSchema>;

export const questionBankListSchema = z.object({
  q: z.string().trim().max(100).optional(),
  questionType: z.string().max(40).optional(),
  language: questionBankLanguageSchema.optional(),
  subjectId: z.string().optional(),
  classId: z.string().optional(),
  academicYearId: z.string().optional(),
  topic: z.string().trim().max(80).optional(),
  difficulty: questionDifficultySchema.optional(),
  teacherId: z.string().optional(),
  /** Only questions this person wrote. */
  mine: z.coerce.boolean().optional(),
  skip: z.coerce.number().int().min(0).default(0),
  take: z.coerce.number().int().min(1).max(100).default(25),
});
export type QuestionBankListInput = z.infer<typeof questionBankListSchema>;
