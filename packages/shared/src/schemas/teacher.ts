import { z } from "zod";
import { genderSchema } from "./student";

export const Shift = {
  MORNING: "MORNING",
  AFTERNOON: "AFTERNOON",
  /// A teacher who works both shifts. Only valid on the teacher's own
  /// profile — never on a single assignment row, which is one class in one
  /// shift. See assignmentShiftSchema below.
  BOTH: "BOTH",
} as const;
export type Shift = (typeof Shift)[keyof typeof Shift];
export const shiftSchema = z.nativeEnum(Shift);

/** The shift ONE assignment row is taught in — never BOTH. */
export const assignmentShiftSchema = z.enum(["MORNING", "AFTERNOON"]);
export type AssignmentShift = z.infer<typeof assignmentShiftSchema>;

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
  /** Which shift this slot is in. Only meaningful for a BOTH-shift teacher;
   *  omit it for a single-shift teacher and the row simply has no shift tag. */
  shift: assignmentShiftSchema.nullable().optional(),
});
export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>;

/** One row inside a bulk assignment request. */
export const assignmentItemSchema = z.object({
  classId: z.string().min(1),
  sectionId: z.string().min(1).nullable().optional(),
  subjectId: z.string().min(1),
  shift: assignmentShiftSchema.nullable().optional(),
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
