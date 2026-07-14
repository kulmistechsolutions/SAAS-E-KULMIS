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
});
export type CreateClassInput = z.infer<typeof createClassSchema>;

export const updateClassSchema = z
  .object({
    name: academicNameSchema.optional(),
    orderIndex: z.number().int().optional(),
    hasSections: z.boolean().optional(),
    notes: z.string().nullable().optional(),
    status: entityStatusSchema.optional(),
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
