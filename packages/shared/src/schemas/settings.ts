import { z } from "zod";

/** Partial update of a school's settings/branding (Module 16). */
export const updateSettingsSchema = z
  .object({
    name: z.string().min(1).optional(),
    motto: z.string().nullable().optional(),
    address: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
    email: z.string().email().nullable().optional(),
    website: z.string().url().nullable().optional(),
    principalName: z.string().nullable().optional(),
    currency: z.string().min(1).optional(),
    timezone: z.string().min(1).optional(),
    language: z.string().min(1).optional(),
    documentHeaderLayout: z.enum(["LEFT", "CENTERED"]).optional(),
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
