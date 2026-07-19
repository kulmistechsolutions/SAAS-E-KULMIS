import { z } from "zod";

export const examStatusSchema = z.enum([
  "DRAFT",
  "OPEN",
  "IN_PROGRESS",
  "COMPLETED",
  "LOCKED",
  "PUBLISHED",
  "ARCHIVED",
]);

export const examTypeSchema = z.enum(["TEACHER_ASSESSMENT", "SCHOOL_IMPORT"]);

export const createExamGroupSchema = z.object({
  name: z.string().min(1),
  academicYearId: z.string().min(1),
  description: z.string().optional().nullable(),
});

export type CreateExamGroupInput = z.infer<typeof createExamGroupSchema>;

export const createExamSchema = z.object({
  name: z.string().min(1),
  academicYearId: z.string().min(1),
  examGroupId: z.string().optional().nullable(),
  examType: examTypeSchema.default("TEACHER_ASSESSMENT"),
  term: z.string().min(1),
  maxMarks: z.number().int().positive().default(100),
  weightPercent: z.number().int().min(1).max(100).default(100),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  classId: z.string().min(1),
  sectionId: z.string().optional().nullable(),
  subjectIds: z.array(z.string().min(1)).min(1),
});

export type CreateExamInput = z.infer<typeof createExamSchema>;

/** One class + section combination for bulk exam creation. */
export const examCreationTargetSchema = z.object({
  classId: z.string().min(1),
  /** null = all sections of the class, or class has no sections */
  sectionId: z.string().nullable(),
});

export type ExamCreationTarget = z.infer<typeof examCreationTargetSchema>;

/**
 * Admin bulk exam creation — subjects are resolved from teacher assignments,
 * never supplied manually.
 */
export const examCreationBulkSchema = z
  .object({
    name: z.string().min(1, "Exam name is required"),
    academicYearId: z.string().min(1),
    examGroupId: z.string().optional().nullable(),
    examType: examTypeSchema.default("TEACHER_ASSESSMENT"),
    term: z.string().min(1),
    maxMarks: z.number().int().positive(),
    weightPercent: z.number().int().min(1).max(100),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    targets: z.array(examCreationTargetSchema).min(1, "Select at least one class"),
  })
  .refine((o) => o.endDate >= o.startDate, {
    message: "End date must be on or after start date",
    path: ["endDate"],
  });

export type ExamCreationBulkInput = z.infer<typeof examCreationBulkSchema>;

export const updateExamStatusSchema = z.object({
  status: examStatusSchema,
});

export const upsertExamMarksSchema = z.object({
  examId: z.string().min(1),
  records: z
    .array(
      z.object({
        studentId: z.string().min(1),
        subjectId: z.string().min(1),
        marks: z.number().int().min(0).nullable(),
      }),
    )
    .min(1),
});

export type UpsertExamMarksInput = z.infer<typeof upsertExamMarksSchema>;

export const blockStudentSchema = z.object({
  studentId: z.string().min(1),
  examId: z.string().optional().nullable(),
  academicYearId: z.string().min(1),
  reason: z.string().min(1),
});

export type BlockStudentInput = z.infer<typeof blockStudentSchema>;

export const publicResultLookupSchema = z.object({
  code: z.string().min(1),
  academicYear: z.string().optional(),
});

export type PublicResultLookupInput = z.infer<typeof publicResultLookupSchema>;

export const examSubmissionReminderSchema = z.object({
  examId: z.string().min(1),
  subjectId: z.string().min(1),
  sms: z.boolean().optional(),
  email: z.boolean().optional(),
});

export type ExamSubmissionReminderInput = z.infer<
  typeof examSubmissionReminderSchema
>;

export const teacherLockSchema = z.object({
  locked: z.boolean(),
});

export const studentPortalPublishSchema = z.object({
  published: z.boolean(),
});

// ── Bulk marks import ──────────────────────────────────────────────────────

/** Build a template for one or more exams (one worksheet each). */
export const marksTemplateSchema = z.object({
  examIds: z.array(z.string().min(1)).min(1, "Pick at least one exam"),
});
export type MarksTemplateInput = z.infer<typeof marksTemplateSchema>;

/** Validate a filled-in workbook. Read-only — nothing is written. */
export const validateMarksSchema = z.object({
  examIds: z.array(z.string().min(1)).min(1),
  /** The .xlsx as base64, matching how student imports are posted. */
  file: z.string().min(1),
});
export type ValidateMarksInput = z.infer<typeof validateMarksSchema>;

/** Write the marks. Runs the same validation first and refuses if it fails. */
export const commitMarksSchema = validateMarksSchema;
export type CommitMarksInput = ValidateMarksInput;
