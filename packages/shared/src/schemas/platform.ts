import { z } from "zod";

/** Create a new school (tenant) + its first School Administrator. */
export const createSchoolSchema = z.object({
  name: z.string().min(1, "School name is required"),
  subdomain: z
    .string()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers and hyphens only"),
  adminUsername: z.string().min(3, "Min 3 characters").max(50),
  adminPassword: z.string().min(8, "Password must be at least 8 characters"),
  adminName: z.string().min(1).optional(),
});
export type CreateSchoolInput = z.infer<typeof createSchoolSchema>;

export const updateSchoolSchema = z
  .object({
    name: z.string().min(1).optional(),
    status: z.enum(["ACTIVE", "SUSPENDED"]).optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: "Nothing to update" });
export type UpdateSchoolInput = z.infer<typeof updateSchoolSchema>;
