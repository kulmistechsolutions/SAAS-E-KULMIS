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
    receiptFooter: z.string().nullable().optional(),
    reportFooter: z.string().nullable().optional(),
    resultFooter: z.string().nullable().optional(),
    studentPrefix: z.string().min(1).max(10).optional(),
    teacherPrefix: z.string().min(1).max(10).optional(),
    parentPrefix: z.string().min(1).max(10).optional(),
    receiptPrefix: z.string().min(1).max(10).optional(),
    invoicePrefix: z.string().min(1).max(10).optional(),
    certificatePrefix: z.string().min(1).max(10).optional(),
  })
  .refine((o) => Object.keys(o).length > 0, {
    message: "Provide at least one field to update",
  });

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
