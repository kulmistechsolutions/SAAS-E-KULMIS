import { z } from "zod";

/** How often a self-purchased subscription is billed. */
export const BillingCycle = {
  MONTHLY: "MONTHLY",
  YEARLY: "YEARLY",
} as const;
export type BillingCycle = (typeof BillingCycle)[keyof typeof BillingCycle];
export const billingCycleSchema = z.nativeEnum(BillingCycle);

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
  /** Monthly rate per student. When set, this drives self-service pricing instead of priceUsd. */
  pricePerStudentUsd: z.number().nonnegative().nullable().optional(),
  /** Per-unit price for a school to top up capacity mid-cycle ("Extend").
   *  Null means that resource cannot be extended on this plan. */
  extendPricePerStudentUsd: z.number().nonnegative().nullable().optional(),
  extendPricePerTeacherUsd: z.number().nonnegative().nullable().optional(),
  extendPricePerAiCreditUsd: z.number().nonnegative().nullable().optional(),
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
    pricePerStudentUsd: z.number().nonnegative().nullable().optional(),
    extendPricePerStudentUsd: z.number().nonnegative().nullable().optional(),
    extendPricePerTeacherUsd: z.number().nonnegative().nullable().optional(),
    extendPricePerAiCreditUsd: z.number().nonnegative().nullable().optional(),
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
  billingCycle: billingCycleSchema.default("MONTHLY"),
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

// ── Subscription "Extend" — self-service mid-cycle capacity top-up ────────

export const subscriptionExtendResourceSchema = z.enum([
  "STUDENT",
  "TEACHER",
  "AI_GRADING",
]);
export type SubscriptionExtendResource = z.infer<
  typeof subscriptionExtendResourceSchema
>;

/** School: preview the prorated cost of extending capacity — no charge yet. */
export const previewSubscriptionExtendSchema = z.object({
  resource: subscriptionExtendResourceSchema,
  quantity: z.number().int().positive().max(100_000),
});
export type PreviewSubscriptionExtendInput = z.infer<
  typeof previewSubscriptionExtendSchema
>;

/** School: self-service purchase of a capacity top-up via WaafiPay. */
export const purchaseSubscriptionExtendSchema = z.object({
  resource: subscriptionExtendResourceSchema,
  quantity: z.number().int().positive().max(100_000),
  payerAccount: z.string().min(8).max(20).optional(),
  channel: z.enum(["API_PURCHASE", "HPP_PURCHASE"]).optional(),
  paymentMethod: z.string().min(3).max(40).optional(),
});
export type PurchaseSubscriptionExtendInput = z.infer<
  typeof purchaseSubscriptionExtendSchema
>;

/** Platform admin: grant a capacity top-up to a school directly, free of
 * charge — no WaafiPay order, the school admin does nothing. */
export const grantSubscriptionExtendSchema = z.object({
  resource: subscriptionExtendResourceSchema,
  quantity: z.number().int().positive().max(100_000),
});
export type GrantSubscriptionExtendInput = z.infer<
  typeof grantSubscriptionExtendSchema
>;
