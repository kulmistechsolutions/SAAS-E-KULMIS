import { z } from "zod";
import { tfConflicts } from "../quiz/true-false";

export const quizStatusSchema = z.enum(["DRAFT", "PUBLISHED", "CLOSED", "ARCHIVED"]);

export const quizQuestionTypeSchema = z.enum([
  "MCQ",
  "DIRECT",
  "MATCH",
  "FILL_BLANK",
  // Two buttons; the answer comes back as "TRUE" or "FALSE".
  "TRUE_FALSE",
  // The student writes the word. A different skill and a different paper.
  "TRUE_FALSE_WRITTEN",
  // legacy types kept for backward compatibility
  "ESSAY",
  "SHORT_ANSWER",
]);
export type QuizQuestionType = z.infer<typeof quizQuestionTypeSchema>;

export const quizGradingModeSchema = z.enum(["EXACT", "AI_CONCEPT"]);
export type QuizGradingMode = z.infer<typeof quizGradingModeSchema>;

export const matchPairSchema = z.object({
  left: z.string().min(1),
  right: z.string().min(1),
});

export const quizQuestionSchema = z
  .object({
    /**
     * The question this row already is, when it is one.
     *
     * Sent back by the builder so a save can update in place instead of
     * deleting and recreating. Without it the server cannot tell an edited
     * question from a new one, which is how a published paper lost the answer
     * sheets behind it: new ids, and every stored answer pointing at a
     * question that no longer existed.
     */
    id: z.string().min(1).optional(),
    /**
     * Which way this question runs, when it differs from the quiz.
     *
     * Null means "as the quiz says", which is what almost every question
     * wants. It is per question because a single paper legitimately mixes
     * them: question 1 English, question 2 Arabic.
     */
    direction: z.enum(["AUTO", "LTR", "RTL"]).nullish(),
    /** An Arabic face for this question alone. Null follows the quiz. */
    contentFont: z.string().max(40).nullish(),
    question: z.string().min(1),
    /**
     * The same question with the teacher's formatting, when there is any.
     *
     * Sanitised on the server before it is stored — a sanitiser that runs
     * only in the browser is decoration, since the request can be made
     * without one. `question` keeps the words and is what grading, the
     * change history and every export read.
     */
    questionHtml: z.string().max(20000).nullish(),
    questionType: quizQuestionTypeSchema.default("MCQ"),
    // MCQ: the answer choices.
    options: z.array(z.string().min(1)).default([]),
    /**
     * The formatted options, index-aligned with `options`.
     *
     * `options` stays plain because a submitted answer is matched against it;
     * formatting an option must not change what counts as correct.
     */
    optionsHtml: z.array(z.string().max(4000)).nullish(),
    // MCQ: correct option text. DIRECT: model answer. FILL_BLANK: first/only blank.
    correctAnswer: z.string().default(""),
    // Only meaningful for DIRECT; other types are always graded EXACT.
    gradingMode: quizGradingModeSchema.default("EXACT"),
    // MATCH: the correct left↔right pairs.
    pairs: z.array(matchPairSchema).default([]),
    // FILL_BLANK: accepted answer per blank (index-aligned with the ___ slots).
    blanks: z.array(z.string().min(1)).default([]),
    marks: z.number().int().positive().default(1),
    /**
     * TRUE_FALSE_WRITTEN: extra words the school accepts, per side.
     *
     * On top of the built-in true / صح / run and false / خطأ / been, which
     * always count. "T" or "sax" is the school's call, not the system's.
     */
    acceptedAnswers: z
      .object({
        TRUE: z.array(z.string().max(60)).max(20).optional(),
        FALSE: z.array(z.string().max(60)).max(20).optional(),
      })
      .nullish(),
  })
  .superRefine((q, ctx) => {
    if (
      (q.questionType === "TRUE_FALSE" || q.questionType === "TRUE_FALSE_WRITTEN") &&
      q.correctAnswer !== "TRUE" &&
      q.correctAnswer !== "FALSE"
    ) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Choose TRUE or FALSE as the correct answer", path: ["correctAnswer"] });
    }
    if (q.questionType === "TRUE_FALSE_WRITTEN") {
      // A word accepted on both sides would mark every answer that uses it
      // right. Caught here, by the teacher who made it.
      const clash = tfConflicts(q.acceptedAnswers ?? null);
      if (clash.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Accepted for both TRUE and FALSE: ${clash.join(", ")}`,
          path: ["acceptedAnswers"],
        });
      }
    }
    if (q.questionType === "MCQ" && q.options.length < 2) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "MCQ needs at least 2 options", path: ["options"] });
    }
    if (q.questionType === "MCQ" && !q.correctAnswer) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Select the correct option", path: ["correctAnswer"] });
    }
    if (q.questionType === "MATCH" && q.pairs.length < 2) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "MATCH needs at least 2 pairs", path: ["pairs"] });
    }
    if (q.questionType === "FILL_BLANK" && q.blanks.length < 1 && !q.correctAnswer) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Provide the blank answer(s)", path: ["blanks"] });
    }
    if (q.questionType === "DIRECT" && !q.correctAnswer) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Provide the model answer", path: ["correctAnswer"] });
    }
  });

/** One question, as the builder and the question bank send it. */
export type QuizQuestionInput = z.infer<typeof quizQuestionSchema>;

export const createQuizSchema = z.object({
  title: z.string().min(1),
  academicYearId: z.string().min(1),
  classId: z.string().min(1),
  sectionId: z.string().optional().nullable(),
  subjectId: z.string().optional().nullable(),
  teacherId: z.string().min(1),
  description: z.string().optional().nullable(),
  timeLimitMin: z.number().int().positive().optional().nullable(),
  // No hardcoded default: left unset, these fall back to the school's own
  // Online Quiz Settings, which in turn fall back to the platform default.
  // A .default() here would erase the difference between "the teacher chose
  // this" and "the teacher said nothing", and the school's setting could
  // never apply.
  maxAttempts: z.number().int().positive().optional(),
  passingMarks: z.number().int().positive().optional().nullable(),
  startAt: z.string().datetime().optional().nullable(),
  endAt: z.string().datetime().optional().nullable(),
  shuffleQuestions: z.boolean().optional(),
  shuffleAnswers: z.boolean().default(false),
  showResultsImmediately: z.boolean().optional(),
  allowReviewAnswers: z.boolean().default(true),
  allowPdfDownload: z.boolean().default(true),
  instructions: z.string().optional().nullable(),
  examinationRules: z.string().optional().nullable(),
  preventMinimize: z.boolean().default(false),
  disableCopyPaste: z.boolean().default(false),
  resetOnMinimize: z.boolean().default(false),
  questions: z.array(quizQuestionSchema).min(1),
});

export type CreateQuizInput = z.infer<typeof createQuizSchema>;

/** Edit a DRAFT quiz's settings and/or replace its full question set. */
export const updateQuizBuilderSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  instructions: z.string().optional().nullable(),
  examinationRules: z.string().optional().nullable(),
  timeLimitMin: z.number().int().positive().optional().nullable(),
  passingMarks: z.number().int().positive().optional().nullable(),
  maxAttempts: z.number().int().positive().optional(),
  shuffleQuestions: z.boolean().optional(),
  shuffleAnswers: z.boolean().optional(),
  showResultsImmediately: z.boolean().optional(),
  allowReviewAnswers: z.boolean().optional(),
  allowPdfDownload: z.boolean().optional(),
  preventMinimize: z.boolean().optional(),
  disableCopyPaste: z.boolean().optional(),
  resetOnMinimize: z.boolean().optional(),
  questions: z.array(quizQuestionSchema).min(1).optional(),
  /**
   * Which kind of change this is, for a quiz students have already sat.
   *
   * CORRECTION fixes the paper in place — a typo, a mark, a formatting slip.
   * The students who sat it sat that question, only misspelt, so their sheets
   * follow the correction.
   *
   * NEW_VERSION is a different paper. A question whose substance moved is
   * retired and replaced, so every answer already given stays attached to the
   * question it was actually given for, and the new question goes only to
   * students who have not started.
   *
   * Ignored on a draft: nobody has sat it, so there is nothing to protect.
   */
  /** ENGLISH | ARABIC | SOMALI | MIXED | AUTO. */
  language: z.string().max(20).optional(),
  /**
   * AUTO detects from the text, which is almost always right. The override
   * exists because a question can be mostly English with an Arabic quotation
   * in it, or the reverse, and only the teacher knows which way it is meant
   * to run.
   */
  direction: z.enum(["AUTO", "LTR", "RTL"]).optional(),
  /** An Arabic face for the whole paper. */
  contentFont: z.string().max(40).nullish(),
  /** The instructions with the teacher's formatting, when there is any. */
  instructionsHtml: z.string().max(20000).nullish(),
  editMode: z.enum(["CORRECTION", "NEW_VERSION"]).optional(),
  /** Why, in the teacher's words. Written into the quiz's change history. */
  editReason: z.string().max(300).optional(),
});

export type UpdateQuizBuilderInput = z.infer<typeof updateQuizBuilderSchema>;

export const verifyQuizAccessSchema = z.object({
  quizCode: z.string().min(1),
  studentCode: z.string().min(1),
});

export type VerifyQuizAccessInput = z.infer<typeof verifyQuizAccessSchema>;

export const quizLinkOpenedSchema = z.object({
  quizCode: z.string().min(1),
  studentCode: z.string().min(1),
});

export type QuizLinkOpenedInput = z.infer<typeof quizLinkOpenedSchema>;

export const startQuizAttemptSchema = z.object({
  quizCode: z.string().min(1),
  studentId: z.string().min(1),
});

export type StartQuizAttemptInput = z.infer<typeof startQuizAttemptSchema>;

export const saveQuizAnswersSchema = z.object({
  attemptId: z.string().min(1),
  studentId: z.string().min(1),
  answers: z.array(
    z.object({
      questionId: z.string().min(1),
      answer: z.string().default(""),
      markedForReview: z.boolean().optional(),
    }),
  ),
});

export type SaveQuizAnswersInput = z.infer<typeof saveQuizAnswersSchema>;

/** Wipe every saved answer for an in-progress attempt (reset-on-minimize). */
export const clearQuizAnswersSchema = z.object({
  attemptId: z.string().min(1),
  studentId: z.string().min(1),
});

export type ClearQuizAnswersInput = z.infer<typeof clearQuizAnswersSchema>;

export const submitQuizAttemptSchema = z.object({
  quizCode: z.string().min(1),
  studentId: z.string().min(1),
  attemptId: z.string().optional(),
  answers: z.array(
    z.object({
      questionId: z.string().min(1),
      // Plain text for MCQ/DIRECT/FILL; a JSON string ({leftIndex: rightValue})
      // for MATCH. Empty string = left unanswered.
      answer: z.string().default(""),
      markedForReview: z.boolean().optional(),
    }),
  ),
});

export type SubmitQuizAttemptInput = z.infer<typeof submitQuizAttemptSchema>;

export const gradeQuizAnswerSchema = z.object({
  marks: z.number().int().min(0),
  /**
   * Why, when this changes a mark the system already gave.
   *
   * Overriding an automatic mark — a student wrote "T" and the teacher
   * accepts it — changes an academic record, so it is written to the audit
   * log with the mark before and after and the reason in the teacher's words.
   */
  reason: z.string().trim().max(300).optional(),
});

/**
 * A teacher trying their own paper.
 *
 * No student, no attempt row, no attempt count: the answers are graded by the
 * same rules a student's would be and stored in a table of their own, which
 * nothing that reports on students reads.
 */
export const practiceQuizSubmitSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.string().min(1),
        answer: z.string().max(20000).default(""),
      }),
    )
    .max(500),
  /** Seconds from starting the practice run to submitting it. */
  timeTakenSec: z.number().int().min(0).max(24 * 3600).default(0),
});

export type PracticeQuizSubmitInput = z.infer<typeof practiceQuizSubmitSchema>;

export type GradeQuizAnswerInput = z.infer<typeof gradeQuizAnswerSchema>;
