import { z } from "zod";
import { employmentStatusSchema } from "./teacher";

/** Register a non-teaching staff member (guard, cleaner, and similar roles). */
export const createEmployeeSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  position: z.string().min(1, "Position is required"),
  phone: z.string().min(1).nullable().optional(),
  salary: z.number().int().nonnegative().optional(),
  status: employmentStatusSchema.optional(),
  notes: z.string().nullable().optional(),
});
export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;

export const updateEmployeeSchema = z
  .object({
    fullName: z.string().min(1).optional(),
    position: z.string().min(1).optional(),
    phone: z.string().nullable().optional(),
    salary: z.number().int().nonnegative().optional(),
    status: employmentStatusSchema.optional(),
    notes: z.string().nullable().optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: "Nothing to update" });
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
