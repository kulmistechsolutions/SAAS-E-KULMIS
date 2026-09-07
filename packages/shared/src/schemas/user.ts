import { z } from "zod";
import { userRoleSchema } from "../roles";

/** User account status (mirrors Prisma UserStatus). */
export const UserStatus = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
  LOCKED: "LOCKED",
} as const;

export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

export const userStatusSchema = z.nativeEnum(UserStatus);

export const createUserSchema = z.object({
  username: z.string().min(3, "Min 3 characters").max(50),
  fullName: z.string().min(1, "Full name is required").max(120).optional(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: userRoleSchema,
  status: userStatusSchema.optional(),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z
  .object({
    username: z.string().min(3, "Min 3 characters").max(50).optional(),
    fullName: z.string().min(1).max(120).optional(),
    role: userRoleSchema.optional(),
    /**
     * The school's own role for this person, or null to put them back on the
     * built-in one. The built-in role is always kept alongside, so deleting a
     * custom role leaves everyone able to sign in rather than stranded on an
     * id that no longer resolves.
     */
    customRoleId: z.string().nullable().optional(),
    status: userStatusSchema.optional(),
  })
  .refine(
    (v) =>
      v.role !== undefined ||
      v.customRoleId !== undefined ||
      v.status !== undefined ||
      v.username !== undefined ||
      v.fullName !== undefined,
    { message: "Provide at least one field to update" },
  );
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const resetPasswordSchema = z.object({
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
