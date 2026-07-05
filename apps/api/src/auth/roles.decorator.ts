import { SetMetadata } from "@nestjs/common";
import type { UserRole } from "@ekulmis/shared";

export const ROLES_KEY = "roles";

/** Restricts a route to the given roles (enforced by RolesGuard). */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
