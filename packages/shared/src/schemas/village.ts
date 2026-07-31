import { z } from "zod";
import { entityStatusSchema } from "./academics";

/**
 * A school-defined list of neighborhoods/villages, offered as an optional
 * field when registering a student. General-purpose — every school gets
 * this, independent of whether it uses the custom academic structure.
 */
export const createVillageSchema = z.object({
  name: z.string().min(1, "Name is required"),
  orderIndex: z.number().int().optional(),
});
export type CreateVillageInput = z.infer<typeof createVillageSchema>;

export const updateVillageSchema = z
  .object({
    name: z.string().min(1).optional(),
    orderIndex: z.number().int().optional(),
    status: entityStatusSchema.optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: "Nothing to update" });
export type UpdateVillageInput = z.infer<typeof updateVillageSchema>;
