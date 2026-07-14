import { z } from "zod";

export const Gender = { MALE: "MALE", FEMALE: "FEMALE" } as const;
export type Gender = (typeof Gender)[keyof typeof Gender];
export const genderSchema = z.nativeEnum(Gender);

export const StudentStatus = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
  GRADUATED: "GRADUATED",
} as const;
export type StudentStatus = (typeof StudentStatus)[keyof typeof StudentStatus];
export const studentStatusSchema = z.nativeEnum(StudentStatus);

/** Individual student registration (Module 1). Parent is auto-created/reused. */
export const registerStudentSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  gender: genderSchema,
  dob: z.coerce.date().nullable().optional(),
  phone: z.string().min(1).nullable().optional(),
  notes: z.string().nullable().optional(),
  parentName: z.string().min(1, "Parent name is required"),
  parentPhone: z.string().min(1, "Parent phone is required"),
  classId: z.string().min(1, "Class is required"),
  sectionId: z.string().min(1).nullable().optional(),
  monthlyFee: z.number().int().nonnegative().optional(),
  feeStartMode: z
    .enum(["FULL_CURRENT", "AGREEMENT", "NEXT_MONTH"])
    .optional(),
  agreementAmount: z.number().int().nonnegative().optional(),
});
export type RegisterStudentInput = z.infer<typeof registerStudentSchema>;

export const ParentStatus = { ACTIVE: "ACTIVE", INACTIVE: "INACTIVE" } as const;
export type ParentStatus = (typeof ParentStatus)[keyof typeof ParentStatus];
export const parentStatusSchema = z.nativeEnum(ParentStatus);

export const updateParentSchema = z
  .object({
    name: z.string().min(1).optional(),
    phone: z.string().min(1).optional(),
    altPhone: z.string().nullable().optional(),
    email: z.string().email().nullable().optional(),
    address: z.string().nullable().optional(),
    occupation: z.string().nullable().optional(),
    status: parentStatusSchema.optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: "Nothing to update" });
export type UpdateParentInput = z.infer<typeof updateParentSchema>;

export const updateStudentSchema = z
  .object({
    fullName: z.string().min(1).optional(),
    gender: genderSchema.optional(),
    dob: z.coerce.date().nullable().optional(),
    phone: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    classId: z.string().min(1).optional(),
    sectionId: z.string().nullable().optional(),
    monthlyFee: z.number().int().nonnegative().optional(),
    status: studentStatusSchema.optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: "Nothing to update" });
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;
