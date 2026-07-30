import { z } from "zod";

/** Super Admin: create/update a subscription plan tier. */
export const createSubscriptionPlanSchema = z.object({
  name: z.string().min(1, "Plan name is required").max(80),
  maxStudents: z.number().int().positive().nullable(),
  maxTeachers: z.number().int().positive().nullable().optional(),
  durationDays: z.number().int().positive("Duration must be at least 1 day"),
  aiGradingMonthlyQuota: z.number().int().nonnegative().nullable(),
  /** Total library PDF storage in MB. Null = unlimited. */
  libraryStorageMb: z.number().int().nonnegative().nullable().optional(),
  priceUsd: z.number().nonnegative().nullable().optional(),
  isActive: z.boolean().optional(),
});
export type CreateSubscriptionPlanInput = z.infer<
  typeof createSubscriptionPlanSchema
>;

export const updateSubscriptionPlanSchema = z
  .object({
    name: z.string().min(1).max(80).optional(),
    maxStudents: z.number().int().positive().nullable().optional(),
    maxTeachers: z.number().int().positive().nullable().optional(),
    durationDays: z.number().int().positive().optional(),
    aiGradingMonthlyQuota: z.number().int().nonnegative().nullable().optional(),
    libraryStorageMb: z.number().int().nonnegative().nullable().optional(),
    priceUsd: z.number().nonnegative().nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: "Nothing to update" });
export type UpdateSubscriptionPlanInput = z.infer<
  typeof updateSubscriptionPlanSchema
>;

/** School: self-service purchase of a subscription plan via WaafiPay. */
export const purchaseSubscriptionPlanSchema = z.object({
  planId: z.string().min(1),
  /** Mobile wallet number in international format (required for API_PURCHASE). */
  payerAccount: z.string().min(8).max(20).optional(),
  /** Override channel; defaults to Super Admin Waafi config. */
  channel: z.enum(["API_PURCHASE", "HPP_PURCHASE"]).optional(),
  paymentMethod: z.string().min(3).max(40).optional(),
});
export type PurchaseSubscriptionPlanInput = z.infer<
  typeof purchaseSubscriptionPlanSchema
>;

/**
 * A one-off length for this assignment only — the plan's own durationDays is
 * unaffected, so every other school on the same plan keeps its normal term.
 * Months are calendar months (the 15th to the 15th), not a 30-day multiple,
 * so "3 months" lands on the same day-of-month it started.
 */
export const customDurationSchema = z.object({
  unit: z.enum(["DAYS", "MONTHS"]),
  value: z.number().int().min(1).max(3650),
});
export type CustomDurationInput = z.infer<typeof customDurationSchema>;

/** Super Admin: assign (or renew) a school's subscription to a plan. */
export const assignSchoolSubscriptionSchema = z.object({
  planId: z.string().min(1, "Plan is required"),
  startDate: z.string().datetime().optional(),
  customDuration: customDurationSchema.optional(),
});
export type AssignSchoolSubscriptionInput = z.infer<
  typeof assignSchoolSubscriptionSchema
>;
