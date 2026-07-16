import { z } from "zod";

/** Super Admin: create/update a subscription plan tier. */
export const createSubscriptionPlanSchema = z.object({
  name: z.string().min(1, "Plan name is required").max(80),
  maxStudents: z.number().int().positive().nullable(),
  durationDays: z.number().int().positive("Duration must be at least 1 day"),
  aiGradingMonthlyQuota: z.number().int().nonnegative().nullable(),
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
    durationDays: z.number().int().positive().optional(),
    aiGradingMonthlyQuota: z.number().int().nonnegative().nullable().optional(),
    priceUsd: z.number().nonnegative().nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: "Nothing to update" });
export type UpdateSubscriptionPlanInput = z.infer<
  typeof updateSubscriptionPlanSchema
>;

/** Super Admin: assign (or renew) a school's subscription to a plan. */
export const assignSchoolSubscriptionSchema = z.object({
  planId: z.string().min(1, "Plan is required"),
  startDate: z.string().datetime().optional(),
});
export type AssignSchoolSubscriptionInput = z.infer<
  typeof assignSchoolSubscriptionSchema
>;
