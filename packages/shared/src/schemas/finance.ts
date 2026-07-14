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
