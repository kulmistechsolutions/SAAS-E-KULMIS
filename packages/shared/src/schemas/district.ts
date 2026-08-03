import { z } from "zod";
import { entityStatusSchema } from "./academics";

/**
 * A school-defined list of districts, offered on the DETAILED registration
 * form (see School.studentFormTemplate). Mirrors village.ts exactly.
 */
export const createDistrictSchema = z.object({
  name: z.string().min(1, "Name is required"),
  orderIndex: z.number().int().optional(),
});
export type CreateDistrictInput = z.infer<typeof createDistrictSchema>;

export const updateDistrictSchema = z
  .object({
    name: z.string().min(1).optional(),
    orderIndex: z.number().int().optional(),
    status: entityStatusSchema.optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: "Nothing to update" });
export type UpdateDistrictInput = z.infer<typeof updateDistrictSchema>;
