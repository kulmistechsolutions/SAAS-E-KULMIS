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
  /// Only collected by the DETAILED registration form — see
  /// School.studentFormTemplate. Always optional so the standard form, the
  /// Excel import and the parent portal all keep working unchanged.
  placeOfBirth: z.string().nullable().optional(),
  motherName: z.string().nullable().optional(),
  parentName: z.string().min(1, "Parent name is required"),
  parentPhone: z.string().min(1, "Parent phone is required"),
  classId: z.string().min(1, "Class is required"),
  sectionId: z.string().min(1).nullable().optional(),
  /// Optional by default — a school that hasn't set up its village/district
  /// list has nothing to pick from, and an existing student re-imported or
  /// edited without one keeps it null rather than being forced to choose.
  /// School.villageRequired/districtRequired can make either mandatory; that
  /// is enforced in the service, not here, since it depends on school
  /// settings the schema alone doesn't have.
  villageId: z.string().min(1).nullable().optional(),
  districtId: z.string().min(1).nullable().optional(),
  monthlyFee: z.number().int().nonnegative().optional(),
  feeStartMode: z
    .enum(["FULL_CURRENT", "AGREEMENT", "NEXT_MONTH"])
    .optional(),
  agreementAmount: z.number().int().nonnegative().optional(),
  /// Permanent tuition exemption — see Student.feeWaived.
  feeWaived: z.boolean().optional(),
  /// Charge the school's one-time registration fee now, on top of whatever
  /// feeStartMode decides for the recurring tuition fee.
  chargeRegistrationFee: z.boolean().optional(),
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
    /// DETAILED-form bio fields — see registerStudentSchema.
    placeOfBirth: z.string().nullable().optional(),
    motherName: z.string().nullable().optional(),
    classId: z.string().min(1).optional(),
    sectionId: z.string().nullable().optional(),
    villageId: z.string().min(1).nullable().optional(),
    districtId: z.string().min(1).nullable().optional(),
    monthlyFee: z.number().int().nonnegative().optional(),
    /// Permanent tuition exemption — see Student.feeWaived. Editable any
    /// time, not just at registration, since it's meant to be an ongoing
    /// status an admin turns on or off as circumstances change.
    feeWaived: z.boolean().optional(),
    status: studentStatusSchema.optional(),
    /**
     * Who the child answers to. Sending these re-links the student to the
     * parent holding this phone — an existing one is reused, an unknown one is
     * created — rather than renaming whichever parent they are attached to
     * now. Correcting a child registered under the wrong family is the whole
     * point, so the wrong family must be left as it was.
     */
    parentName: z.string().min(1).optional(),
    parentPhone: z.string().min(1).optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: "Nothing to update" });
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;

/**
 * Add a student to an ADDITIONAL class alongside their home class.
 * The home class stays Student.classId — this only ever adds extras.
 */
export const addStudentClassSchema = z.object({
  classId: z.string().min(1, "Class is required"),
  sectionId: z.string().min(1).nullable().optional(),
});
export type AddStudentClassInput = z.infer<typeof addStudentClassSchema>;
