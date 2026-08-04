import { z } from "zod";

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
