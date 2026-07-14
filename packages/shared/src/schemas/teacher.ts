import { z } from "zod";
import { genderSchema } from "./student";

export const Shift = { MORNING: "MORNING", AFTERNOON: "AFTERNOON" } as const;
export type Shift = (typeof Shift)[keyof typeof Shift];
export const shiftSchema = z.nativeEnum(Shift);

export const EmploymentStatus = { ACTIVE: "ACTIVE", INACTIVE: "INACTIVE" } as const;
export type EmploymentStatus =
  (typeof EmploymentStatus)[keyof typeof EmploymentStatus];
export const employmentStatusSchema = z.nativeEnum(EmploymentStatus);

export const teacherPasswordSchema = z
  .string()
  .min(5, "Password must be at least 5 characters");

/** Teacher registration (Module 3). Login account is auto-created. */
export const registerTeacherSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  gender: genderSchema,
  phone: z.string().min(1).nullable().optional(),
  email: z.string().email().nullable().optional(),
  address: z.string().nullable().optional(),
  qualification: z.string().nullable().optional(),
  salary: z.number().int().nonnegative().optional(),
  shift: shiftSchema,
  password: teacherPasswordSchema.optional(),
});
export type RegisterTeacherInput = z.infer<typeof registerTeacherSchema>;

export const resetTeacherPasswordSchema = z.object({
  newPassword: teacherPasswordSchema,
});
export type ResetTeacherPasswordInput = z.infer<
  typeof resetTeacherPasswordSchema
>;

export const updateTeacherSchema = z
  .object({
    fullName: z.string().min(1).optional(),
    gender: genderSchema.optional(),
    phone: z.string().nullable().optional(),
    email: z.string().email().nullable().optional(),
    address: z.string().nullable().optional(),
    qualification: z.string().nullable().optional(),
    salary: z.number().int().nonnegative().optional(),
    shift: shiftSchema.optional(),
    status: employmentStatusSchema.optional(),
    canViewStudents: z.boolean().optional(),
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

/** One row inside a bulk assignment request. */
export const assignmentItemSchema = z.object({
  classId: z.string().min(1),
  sectionId: z.string().min(1).nullable().optional(),
  subjectId: z.string().min(1),
});
export type AssignmentItemInput = z.infer<typeof assignmentItemSchema>;

/**
 * Create many independent TeacherAssignment rows for one teacher + year.
 *
 * Each item is one Class × Section × Subject combination.
 * Multiple subjects in the same class/section = multiple items.
 * Exact duplicates (same teacher/year/class/section/subject) are skipped.
 */
export const bulkCreateAssignmentsSchema = z.object({
  teacherId: z.string().min(1),
  academicYearId: z.string().min(1),
  items: z
    .array(assignmentItemSchema)
    .min(1, "At least one assignment is required")
    .max(500, "Too many assignments in one request"),
});
export type BulkCreateAssignmentsInput = z.infer<
  typeof bulkCreateAssignmentsSchema
>;
