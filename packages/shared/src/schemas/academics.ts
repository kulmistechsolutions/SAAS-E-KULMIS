import { z } from "zod";

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
  name: z.string().min(1),
  orderIndex: z.number().int().optional(),
});
export type CreateClassInput = z.infer<typeof createClassSchema>;

export const updateClassSchema = z
  .object({
    name: z.string().min(1).optional(),
    orderIndex: z.number().int().optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: "Nothing to update" });
export type UpdateClassInput = z.infer<typeof updateClassSchema>;

// ── Section ──
export const createSectionSchema = z.object({
  classId: z.string().min(1),
  name: z.string().min(1),
});
export type CreateSectionInput = z.infer<typeof createSectionSchema>;

export const updateSectionSchema = z.object({
  name: z.string().min(1),
});
export type UpdateSectionInput = z.infer<typeof updateSectionSchema>;

// ── Subject ──
export const createSubjectSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1).nullable().optional(),
});
export type CreateSubjectInput = z.infer<typeof createSubjectSchema>;

export const updateSubjectSchema = z
  .object({
    name: z.string().min(1).optional(),
    code: z.string().min(1).nullable().optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: "Nothing to update" });
export type UpdateSubjectInput = z.infer<typeof updateSubjectSchema>;
