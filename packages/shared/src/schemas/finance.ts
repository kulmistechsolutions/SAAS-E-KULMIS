import { z } from "zod";

export const PaymentType = {
  THIS_MONTH: "THIS_MONTH",
  PARTIAL: "PARTIAL",
  ADVANCE: "ADVANCE",
} as const;
export type PaymentType = (typeof PaymentType)[keyof typeof PaymentType];
export const paymentTypeSchema = z.nativeEnum(PaymentType);

export const SalaryStatus = {
  PENDING: "PENDING",
  PAID: "PAID",
  PARTIAL: "PARTIAL",
} as const;
export type SalaryStatus = (typeof SalaryStatus)[keyof typeof SalaryStatus];
export const salaryStatusSchema = z.nativeEnum(SalaryStatus);

const year = z.number().int().min(2000).max(2100);
const month = z.number().int().min(1).max(12);
const positiveAmount = z.number().int().positive();

// ── Fees (Module 7) ──
export const chargeMonthSchema = z.object({
  classId: z.string().min(1),
  sectionId: z.string().min(1).nullable().optional(),
  year,
  month,
  amount: z.number().int().nonnegative().optional(), // defaults to student's monthlyFee
});
export type ChargeMonthInput = z.infer<typeof chargeMonthSchema>;

/**
 * Monthly fee setup: turn billing on for a month, for every class or a chosen
 * few. This is the deliberate act that starts monthly billing.
 */
export const setupMonthSchema = z
  .object({
    year,
    month,
    scope: z.enum(["all", "selected"]),
    classIds: z.array(z.string().min(1)).optional(),
    amount: z.number().int().nonnegative().optional(),
  })
  .refine((o) => o.scope === "all" || (o.classIds && o.classIds.length > 0), {
    message: "Select at least one class",
    path: ["classIds"],
  });
export type SetupMonthInput = z.infer<typeof setupMonthSchema>;

export const payFeeSchema = z.object({
  studentId: z.string().min(1),
  amount: positiveAmount,
  type: paymentTypeSchema,
  method: z.string().min(1).nullable().optional(),
  note: z.string().min(1).nullable().optional(),
});
export type PayFeeInput = z.infer<typeof payFeeSchema>;

export const BillingMode = {
  MONTHLY: "MONTHLY",
  ACADEMIC_YEAR: "ACADEMIC_YEAR",
} as const;
export type BillingMode = (typeof BillingMode)[keyof typeof BillingMode];
export const billingModeSchema = z.nativeEnum(BillingMode);

export const FeeStartMode = {
  FULL_CURRENT: "FULL_CURRENT",
  AGREEMENT: "AGREEMENT",
  NEXT_MONTH: "NEXT_MONTH",
} as const;
export type FeeStartMode = (typeof FeeStartMode)[keyof typeof FeeStartMode];
export const feeStartModeSchema = z.nativeEnum(FeeStartMode);

export const setupAcademicYearFeesSchema = z.object({
  academicYearId: z.string().min(1),
  academicMonths: z.number().int().positive().optional(),
  monthlyFee: z.number().int().nonnegative().optional(),
  billingStartMonth: month.optional(),
  billingEndMonth: month.optional(),
});
export type SetupAcademicYearFeesInput = z.infer<
  typeof setupAcademicYearFeesSchema
>;

export const studentFeeStartSchema = z.object({
  feeStartMode: feeStartModeSchema.optional(),
  agreementAmount: z.number().int().nonnegative().optional(),
  billingStartYear: year.optional(),
  billingStartMonth: month.optional(),
});
export type StudentFeeStartInput = z.infer<typeof studentFeeStartSchema>;

// ── Salary (Module 8) ──
export const createSalarySchema = z.object({
  teacherId: z.string().min(1).nullable().optional(),
  employeeName: z.string().min(1),
  position: z.string().min(1).nullable().optional(),
  amount: positiveAmount,
  year,
  month,
  status: salaryStatusSchema.optional(),
  note: z.string().min(1).nullable().optional(),
});
export type CreateSalaryInput = z.infer<typeof createSalarySchema>;

export const updateSalarySchema = z
  .object({
    amount: positiveAmount.optional(),
    status: salaryStatusSchema.optional(),
    note: z.string().nullable().optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: "Nothing to update" });
export type UpdateSalaryInput = z.infer<typeof updateSalarySchema>;

// ── Extra fees (additional charges billed on top of the monthly fee) ──

const extraFeeClassAmountSchema = z.object({
  classId: z.string().min(1),
  amount: z.number().int().nonnegative(),
});

const extraFeeBase = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  description: z.string().trim().max(500).nullable().optional(),
  year,
  month,
  /** true = one price for every class; false = per-class prices. */
  appliesToAllClasses: z.boolean().default(true),
  /** Required when appliesToAllClasses is true. */
  defaultAmount: z.number().int().nonnegative().nullable().optional(),
  /** Required (non-empty) when appliesToAllClasses is false. */
  classAmounts: z.array(extraFeeClassAmountSchema).default([]),
});

/** Whichever targeting mode is picked must carry its amounts. */
const refineExtraFee = (
  val: z.infer<typeof extraFeeBase>,
  ctx: z.RefinementCtx,
) => {
  if (val.appliesToAllClasses) {
    if (val.defaultAmount == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["defaultAmount"],
        message: "Enter the amount to charge every class",
      });
    }
  } else if (!val.classAmounts.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["classAmounts"],
      message: "Pick at least one class and set its amount",
    });
  }
};

export const createExtraFeeSchema = extraFeeBase.superRefine(refineExtraFee);
export type CreateExtraFeeInput = z.infer<typeof createExtraFeeSchema>;

export const updateExtraFeeSchema = extraFeeBase.superRefine(refineExtraFee);
export type UpdateExtraFeeInput = z.infer<typeof updateExtraFeeSchema>;

// ── Expense (Module 9) ──
export const createExpenseCategorySchema = z.object({
  name: z.string().min(1),
});
export type CreateExpenseCategoryInput = z.infer<
  typeof createExpenseCategorySchema
>;

export const createExpenseSchema = z.object({
  categoryId: z.string().min(1).nullable().optional(),
  title: z.string().min(1),
  amount: positiveAmount,
  method: z.string().min(1).nullable().optional(),
  note: z.string().min(1).nullable().optional(),
  spentAt: z.coerce.date().optional(),
});
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
