import { z } from "zod";
import { normalizeAcademicName } from "../grades";

const academicNameSchema = z
  .string()
  .min(1)
  .transform((v) => normalizeAcademicName(v))
  .refine((v) => v.length > 0, { message: "Name is required" });

export const entityStatusSchema = z.enum(["ACTIVE", "INACTIVE"]);
export type EntityStatusValue = z.infer<typeof entityStatusSchema>;

// ── Academic Year ──
export const createAcademicYearSchema = z.object({
  name: z.string().min(1, "Name is required"),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  isActive: z.boolean().optional(),
});
export type CreateAcademicYearInput = z.infer<typeof createAcademicYearSchema>;

export const updateAcademicYearSchema = z
  .object({
    name: z.string().min(1).optional(),
    startDate: z.coerce.date().nullable().optional(),
    endDate: z.coerce.date().nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: "Nothing to update" });
export type UpdateAcademicYearInput = z.infer<typeof updateAcademicYearSchema>;

// ── Class ──
export const createClassSchema = z.object({
  academicYearId: z.string().min(1),
  name: academicNameSchema,
  orderIndex: z.number().int().optional(),
  hasSections: z.boolean().optional(),
  notes: z.string().nullable().optional(),
  status: entityStatusSchema.optional(),
  /// Both null on the default Grade 1–12 ladder. Set only when the school
  /// runs a custom structure; a stage is optional even then.
  levelId: z.string().min(1).nullable().optional(),
  stageId: z.string().min(1).nullable().optional(),
});
export type CreateClassInput = z.infer<typeof createClassSchema>;

export const updateClassSchema = z
  .object({
    name: academicNameSchema.optional(),
    orderIndex: z.number().int().optional(),
    hasSections: z.boolean().optional(),
    notes: z.string().nullable().optional(),
    status: entityStatusSchema.optional(),
    levelId: z.string().min(1).nullable().optional(),
    stageId: z.string().min(1).nullable().optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: "Nothing to update" });
export type UpdateClassInput = z.infer<typeof updateClassSchema>;

// ── Section ──
export const createSectionSchema = z.object({
  classId: z.string().min(1),
  name: academicNameSchema,
  status: entityStatusSchema.optional(),
});
export type CreateSectionInput = z.infer<typeof createSectionSchema>;

export const updateSectionSchema = z
  .object({
    name: academicNameSchema.optional(),
    status: entityStatusSchema.optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: "Nothing to update" });
export type UpdateSectionInput = z.infer<typeof updateSectionSchema>;

// ── Subject ──
export const createSubjectSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1).nullable().optional(),
  status: entityStatusSchema.optional(),
});
export type CreateSubjectInput = z.infer<typeof createSubjectSchema>;

export const updateSubjectSchema = z
  .object({
    name: z.string().min(1).optional(),
    code: z.string().min(1).nullable().optional(),
    status: entityStatusSchema.optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: "Nothing to update" });
export type UpdateSubjectInput = z.infer<typeof updateSubjectSchema>;

// ── Class ↔ Subject assignment ──
export const createClassSubjectSchema = z.object({
  academicYearId: z.string().min(1),
  classId: z.string().min(1),
  sectionId: z.string().min(1).nullable().optional(),
  subjectId: z.string().min(1),
});
export type CreateClassSubjectInput = z.infer<typeof createClassSubjectSchema>;

// ── Custom academic structure ──
// Two optional tiers above Class, so a school can build its own ladder
// (الإبتدائي → المستوى الأول → الفصل الخامس) instead of Grade 1–12. Both are
// opt-in; a school on the default ladder never creates any of these.

export const repeatScopeSchema = z.enum(["CLASS", "STAGE"]);
export type RepeatScopeValue = z.infer<typeof repeatScopeSchema>;

export const createAcademicLevelSchema = z.object({
  academicYearId: z.string().min(1),
  name: academicNameSchema,
  orderIndex: z.number().int().optional(),
  status: entityStatusSchema.optional(),
});
export type CreateAcademicLevelInput = z.infer<typeof createAcademicLevelSchema>;

export const updateAcademicLevelSchema = z
  .object({
    name: academicNameSchema.optional(),
    orderIndex: z.number().int().optional(),
    status: entityStatusSchema.optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: "Nothing to update" });
export type UpdateAcademicLevelInput = z.infer<typeof updateAcademicLevelSchema>;

export const createAcademicStageSchema = z.object({
  levelId: z.string().min(1),
  name: academicNameSchema,
  orderIndex: z.number().int().optional(),
  status: entityStatusSchema.optional(),
});
export type CreateAcademicStageInput = z.infer<typeof createAcademicStageSchema>;

export const updateAcademicStageSchema = z
  .object({
    name: academicNameSchema.optional(),
    orderIndex: z.number().int().optional(),
    status: entityStatusSchema.optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: "Nothing to update" });
export type UpdateAcademicStageInput = z.infer<typeof updateAcademicStageSchema>;

/// Ids in the order they should appear. Position becomes orderIndex, which is
/// what promotion walks, so this is how a school rewrites its promotion path.
export const reorderSchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
});
export type ReorderInput = z.infer<typeof reorderSchema>;

export const academicStructureSettingsSchema = z
  .object({
    customStructureEnabled: z.boolean().optional(),
    /// How many classes a student passes through in one academic year: 1 is
    /// the classic yearly promotion, 2 the two-semester Arabic model.
    termsPerYear: z.number().int().min(1).max(6).optional(),
    repeatScope: repeatScopeSchema.optional(),
    /// Removes the leftover default Grade 1-12 list from every class picker
    /// once the school's own levels cover its classes. The classes themselves
    /// are not deleted — only hidden from selection.
    hideDefaultGrades: z.boolean().optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: "Nothing to update" });
export type AcademicStructureSettingsInput = z.infer<
  typeof academicStructureSettingsSchema
>;

/// Copy a whole ladder into another year, so a school defines it once rather
/// than rebuilding fourteen classes every August.
export const cloneAcademicStructureSchema = z.object({
  fromAcademicYearId: z.string().min(1),
  toAcademicYearId: z.string().min(1),
  includeSections: z.boolean().optional(),
});
export type CloneAcademicStructureInput = z.infer<
  typeof cloneAcademicStructureSchema
>;
