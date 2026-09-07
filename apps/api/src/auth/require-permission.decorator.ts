import { SetMetadata } from "@nestjs/common";

export const PERMISSION_KEY = "requiredPermission";

/**
 * The permission a route needs, as "module.action" — `fees.update`.
 *
 * `@Roles` answers "which roles", which cannot express a school having taken
 * an action away from a role it otherwise holds. This answers "which
 * permission", so removing `fees.update` from Finance Officer stops the
 * request rather than only hiding the button.
 */
export const RequirePermission = (permission: string) =>
  SetMetadata(PERMISSION_KEY, permission);
