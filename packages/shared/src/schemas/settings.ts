import { z } from "zod";

const gradeBandSchema = z.object({
  min: z.number().min(0).max(100),
  max: z.number().min(0).max(100),
  grade: z.string().min(1).max(10),
});

/** A "HH:MM" wall-clock time, as the settings time inputs produce. */
const clockTime = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a time like 07:30");

// ── Settings sections stored whole (see School.*Settings in schema.prisma) ──
// Each mirrors one Settings page. Every field is required within its section
// because the UI always sends the whole page back; it is the SECTION that is
// optional on the patch, not the fields inside it.

export const attendanceSettingsSchema = z.object({
  startTime: clockTime,
  endTime: clockTime,
  lateTime: clockTime,
  lockTime: clockTime,
  excusedEnabled: z.boolean(),
});

export const examSettingsSchema = z.object({
  maxTerms: z.number().int().min(1).max(12),
  defaultExamStatus: z.string().min(1),
  resultPublishing: z.boolean(),
  resultLocking: z.boolean(),
  studentResultPortal: z.boolean(),
  parentResultPortal: z.boolean(),
  publicResultPortal: z.boolean(),
  blockResultFeature: z.boolean(),
});

export const quizSettingsSchema = z.object({
  maxAttempts: z.number().int().min(1).max(20),
  autoSubmit: z.boolean(),
  autoSave: z.boolean(),
  showResultsImmediately: z.boolean(),
  questionRandomization: z.boolean(),
});

export const academicSettingsSchema = z.object({
  activeAcademicYear: z.string(),
  schoolLevel: z.string(),
  gradeScale: z.string(),
  defaultAttendanceStatus: z.enum(["PRESENT", "ABSENT"]),
  graduationClass: z.string(),
  autoPromote: z.boolean(),
});

export const salarySettingsSchema = z.object({
  payrollDay: z.number().int().min(1).max(28),
  allowPartialSalary: z.boolean(),
  currency: z.string().min(1),
});

export const expenseSettingsSchema = z.object({
  defaultCategories: z.array(z.string().min(1)),
});

export const notificationSettingsSchema = z.object({
  inApp: z.boolean(),
  email: z.boolean(),
  sms: z.boolean(),
  whatsapp: z.boolean(),
  events: z.object({
    newStudent: z.boolean(),
    examPublished: z.boolean(),
    quizPublished: z.boolean(),
    resultPublished: z.boolean(),
  }),
});

/** Session timeout stays a real column (auth reads it on every sign-in), so
 *  it is deliberately not repeated here. */
export const securitySettingsSchema = z.object({
  minPasswordLength: z.number().int().min(4).max(64),
  requireComplexity: z.boolean(),
  requireUppercase: z.boolean(),
  requireNumber: z.boolean(),
  loginAttemptLimit: z.number().int().min(1).max(20),
  twoFactorEnabled: z.boolean(),
  ipRestriction: z.string(),
});

export type AttendanceSettingsInput = z.infer<typeof attendanceSettingsSchema>;
export type ExamSettingsInput = z.infer<typeof examSettingsSchema>;
export type QuizSettingsInput = z.infer<typeof quizSettingsSchema>;
export type AcademicSettingsInput = z.infer<typeof academicSettingsSchema>;
export type SalarySettingsInput = z.infer<typeof salarySettingsSchema>;
export type ExpenseSettingsInput = z.infer<typeof expenseSettingsSchema>;
export type NotificationSettingsInput = z.infer<typeof notificationSettingsSchema>;
export type SecuritySettingsInput = z.infer<typeof securitySettingsSchema>;

/** A CSS hex colour, `#rgb` or `#rrggbb`, normalised to lowercase. */
const hexColor = z
  .string()
  .regex(
    /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/,
    "Use a hex colour like #3b82f6",
  )
  .transform((v) => v.toLowerCase());

/** Partial update of a school's settings/branding (Module 16). */
export const updateSettingsSchema = z
  .object({
    name: z.string().min(1).optional(),
    motto: z.string().nullable().optional(),
    address: z.string().nullable().optional(),
    city: z.string().nullable().optional(),
    country: z.string().nullable().optional(),
    academicYear: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
    email: z.string().email().nullable().optional(),
    website: z.string().url().nullable().optional(),
    principalName: z.string().nullable().optional(),
    currency: z.string().min(1).optional(),
    timezone: z.string().min(1).optional(),
    language: z.string().min(1).optional(),
    documentHeaderLayout: z.enum(["LEFT", "CENTERED"]).optional(),
    /// Minutes an access token stays valid before forcing a re-login. Null
    /// resets to the platform default (JWT_ACCESS_TTL).
    sessionTimeoutMinutes: z.number().int().min(5).max(1440).nullable().optional(),
    receiptHeader: z.string().nullable().optional(),
    receiptFooter: z.string().nullable().optional(),
    payslipHeader: z.string().nullable().optional(),
    payslipFooter: z.string().nullable().optional(),
    expenseHeader: z.string().nullable().optional(),
    expenseFooter: z.string().nullable().optional(),
    studentHeader: z.string().nullable().optional(),
    studentFooter: z.string().nullable().optional(),
    teacherHeader: z.string().nullable().optional(),
    teacherFooter: z.string().nullable().optional(),
    parentHeader: z.string().nullable().optional(),
    parentFooter: z.string().nullable().optional(),
    reportHeader: z.string().nullable().optional(),
    reportFooter: z.string().nullable().optional(),
    resultFooter: z.string().nullable().optional(),
    /// Settings → Examinations → Grade Configuration bands. Sent as a full
    /// array replacement (not a merge) since the UI edits the whole table.
    gradeBands: z.array(gradeBandSchema).min(1).nullable().optional(),
    /// Minimum overall percentage counted as a pass. Null resets to the
    /// platform default (50).
    examPassingPercentage: z.number().int().min(0).max(100).nullable().optional(),
    // Whole-section preferences. Null resets that page to its defaults.
    attendanceSettings: attendanceSettingsSchema.nullable().optional(),
    examSettings: examSettingsSchema.nullable().optional(),
    quizSettings: quizSettingsSchema.nullable().optional(),
    academicSettings: academicSettingsSchema.nullable().optional(),
    salarySettings: salarySettingsSchema.nullable().optional(),
    expenseSettings: expenseSettingsSchema.nullable().optional(),
    notificationSettings: notificationSettingsSchema.nullable().optional(),
    securitySettings: securitySettingsSchema.nullable().optional(),
    studentPrefix: z.string().min(1).max(10).optional(),
    /// Digits the numeric part of a student/parent code is padded to
    /// (STD0007 is 4). Only new codes take a changed value.
    studentIdLength: z.number().int().min(3).max(8).optional(),
    /// Which registration form the school fills in — see
    /// School.studentFormTemplate. Switching only changes which fields the
    /// form shows; already-saved students keep their data either way.
    studentFormTemplate: z.enum(["STANDARD", "DETAILED"]).optional(),
    /// Makes Village/District mandatory at registration instead of optional.
    /// See School.villageRequired/districtRequired.
    villageRequired: z.boolean().optional(),
    districtRequired: z.boolean().optional(),
    /// Lets students sign in to their own portal — see
    /// School.studentPortalEnabled.
    studentPortalEnabled: z.boolean().optional(),
    teacherPrefix: z.string().min(1).max(10).optional(),
    parentPrefix: z.string().min(1).max(10).optional(),
    receiptPrefix: z.string().min(1).max(10).optional(),
    invoicePrefix: z.string().min(1).max(10).optional(),
    certificatePrefix: z.string().min(1).max(10).optional(),
    billingMode: z.enum(["MONTHLY", "ACADEMIC_YEAR"]).optional(),
    feeAcademicMonths: z.number().int().positive().max(12).optional(),
    feeBillingStartMonth: z.number().int().min(1).max(12).optional(),
    feeBillingEndMonth: z.number().int().min(1).max(12).optional(),
    feeAllowPartial: z.boolean().optional(),
    feeAllowAdvance: z.boolean().optional(),
    feeCarryForward: z.boolean().optional(),
    feeMonthSetupDay: z.number().int().min(1).max(28).optional(),
    registrationFeeAmount: z.number().int().nonnegative().optional(),
    // Branding. Colours are hex ("#3b82f6" or "#fff"); null clears the choice
    // and returns that colour to the app default.
    primaryColor: hexColor.nullable().optional(),
    secondaryColor: hexColor.nullable().optional(),
    accentColor: hexColor.nullable().optional(),
    brandLoginTitle: z.string().nullable().optional(),
    brandFooterText: z.string().nullable().optional(),
  })
  .refine((o) => Object.keys(o).length > 0, {
    message: "Provide at least one field to update",
  });

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;

export const uploadSchoolLogoSchema = z.object({
  file: z.string().min(1, "Logo data is required"),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "image/svg+xml"]),
});

export type UploadSchoolLogoInput = z.infer<typeof uploadSchoolLogoSchema>;
