import { SetMetadata } from "@nestjs/common";

export const PERMISSION_KEY = "requiredPermission";

/**
 * The permission a route needs, as "module.action" — `fees.update`.
 *
 * `@Roles` answers "which roles", which cannot express a school having taken
 * an action away from a role it otherwise holds. This answers "which
 * permission", so removing `fees.update` from Finance Officer stops the
 * request rather than only hiding the button.
 *
 * Several may be listed, and holding any one of them is enough. Some routes
 * genuinely serve two jobs: the class roster is read both by the office that
 * manages students and by the officer about to take its register, and those
 * are different grants for the same data.
 */
export const RequirePermission = (...permissions: string[]) =>
  SetMetadata(PERMISSION_KEY, permissions);
