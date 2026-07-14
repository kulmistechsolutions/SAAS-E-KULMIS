import { z } from "zod";

export const quizStatusSchema = z.enum(["DRAFT", "PUBLISHED", "CLOSED", "ARCHIVED"]);

export const quizQuestionTypeSchema = z.enum([
  "MCQ",
  "DIRECT",
  "MATCH",
  "FILL_BLANK",
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
    question: z.string().min(1),
    questionType: quizQuestionTypeSchema.default("MCQ"),
    // MCQ: the answer choices.
    options: z.array(z.string().min(1)).default([]),
    // MCQ: correct option text. DIRECT: model answer. FILL_BLANK: first/only blank.
    correctAnswer: z.string().default(""),
    // Only meaningful for DIRECT; other types are always graded EXACT.
    gradingMode: quizGradingModeSchema.default("EXACT"),
    // MATCH: the correct left↔right pairs.
    pairs: z.array(matchPairSchema).default([]),
    // FILL_BLANK: accepted answer per blank (index-aligned with the ___ slots).
    blanks: z.array(z.string().min(1)).default([]),
    marks: z.number().int().positive().default(1),
  })
  .superRefine((q, ctx) => {
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

export const createQuizSchema = z.object({
  title: z.string().min(1),
  academicYearId: z.string().min(1),
  classId: z.string().min(1),
  sectionId: z.string().optional().nullable(),
  subjectId: z.string().optional().nullable(),
  teacherId: z.string().min(1),
  description: z.string().optional().nullable(),
  timeLimitMin: z.number().int().positive().optional().nullable(),
  maxAttempts: z.number().int().positive().default(1),
  passingMarks: z.number().int().positive().optional().nullable(),
  startAt: z.string().datetime().optional().nullable(),
  endAt: z.string().datetime().optional().nullable(),
  shuffleQuestions: z.boolean().default(false),
  shuffleAnswers: z.boolean().default(false),
  showResultsImmediately: z.boolean().default(true),
  instructions: z.string().optional().nullable(),
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
  timeLimitMin: z.number().int().positive().optional().nullable(),
  passingMarks: z.number().int().positive().optional().nullable(),
  maxAttempts: z.number().int().positive().optional(),
  shuffleQuestions: z.boolean().optional(),
  shuffleAnswers: z.boolean().optional(),
  showResultsImmediately: z.boolean().optional(),
  preventMinimize: z.boolean().optional(),
  disableCopyPaste: z.boolean().optional(),
  resetOnMinimize: z.boolean().optional(),
  questions: z.array(quizQuestionSchema).min(1).optional(),
});

export type UpdateQuizBuilderInput = z.infer<typeof updateQuizBuilderSchema>;

export const verifyQuizAccessSchema = z.object({
  quizCode: z.string().min(1),
  studentCode: z.string().min(1),
  password: z.string().optional(),
});

export type VerifyQuizAccessInput = z.infer<typeof verifyQuizAccessSchema>;

export const submitQuizAttemptSchema = z.object({
  quizCode: z.string().min(1),
  studentId: z.string().min(1),
  answers: z.array(
    z.object({
      questionId: z.string().min(1),
      // Plain text for MCQ/DIRECT/FILL; a JSON string ({leftIndex: rightValue})
      // for MATCH. Empty string = left unanswered.
      answer: z.string().default(""),
    }),
  ),
});

export type SubmitQuizAttemptInput = z.infer<typeof submitQuizAttemptSchema>;

export const gradeQuizAnswerSchema = z.object({
  marks: z.number().int().min(0),
});

export type GradeQuizAnswerInput = z.infer<typeof gradeQuizAnswerSchema>;
