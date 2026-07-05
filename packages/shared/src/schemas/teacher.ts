import { z } from "zod";
import { genderSchema } from "./student";

export const Shift = { MORNING: "MORNING", AFTERNOON: "AFTERNOON" } as const;
export type Shift = (typeof Shift)[keyof typeof Shift];
export const shiftSchema = z.nativeEnum(Shift);

export const EmploymentStatus = { ACTIVE: "ACTIVE", INACTIVE: "INACTIVE" } as const;
export type EmploymentStatus =
  (typeof EmploymentStatus)[keyof typeof EmploymentStatus];
export const employmentStatusSchema = z.nativeEnum(EmploymentStatus);

/** Teacher registration (Module 3). Login account is auto-created. */
export const registerTeacherSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  gender: genderSchema,
  phone: z.string().min(1).nullable().optional(),
  salary: z.number().int().nonnegative().optional(),
  shift: shiftSchema,
});
export type RegisterTeacherInput = z.infer<typeof registerTeacherSchema>;

export const updateTeacherSchema = z
  .object({
    fullName: z.string().min(1).optional(),
    gender: genderSchema.optional(),
    phone: z.string().nullable().optional(),
    salary: z.number().int().nonnegative().optional(),
    shift: shiftSchema.optional(),
    status: employmentStatusSchema.optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: "Nothing to update" });
export type UpdateTeacherInput = z.infer<typeof updateTeacherSchema>;

// ── Teacher Assignment (Module 4) ──
export const createAssignmentSchema = z.object({
  teacherId: z.string().min(1),
  academicYearId: z.string().min(1),
  classId: z.string().min(1),
  sectionId: z.string().min(1).nullable().optional(), // null = all sections
  subjectId: z.string().min(1),
});
export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>;
