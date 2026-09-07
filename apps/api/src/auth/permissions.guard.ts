import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { UserRole } from "@ekulmis/shared";
import { PermissionsService } from "../permissions/permissions.service";
import { PERMISSION_KEY } from "./require-permission.decorator";
import type { AuthUser } from "./auth.types";

/**
 * Enforces `@RequirePermission("fees.update")` against the school's own
 * effective permissions.
 *
 * Routes without the decorator are left to `RolesGuard` as before, so this
 * can be adopted route by route rather than in one sweep that would have to
 * be right everywhere at once.
 *
 * Deny by default: no user, no permission listed for the role, or a role
 * nobody has defined all end the request. The one exception is the school
 * owner's own account, which is the account that grants permissions in the
 * first place and cannot be locked out of doing so.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissions: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[] | undefined>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required?.length) return true;

    const user = context.switchToHttp().getRequest<{ user?: AuthUser }>().user;
    if (!user) throw new ForbiddenException("Not signed in");
    if (user.role === UserRole.SUPER_ADMINISTRATOR) return true;

    // Any one of them opens the route.
    for (const permission of required) {
      if (
        await this.permissions.can(
          user.schoolId,
          user.permissionRole,
          permission,
        )
      ) {
        return true;
      }
    }
    // Names the permission, not the role: the administrator reading this in
    // support needs to know which switch to turn back on.
    throw new ForbiddenException(
      `Missing permission: ${required.join(" or ")}`,
    );
  }
}
