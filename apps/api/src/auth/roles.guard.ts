import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { UserRole } from "@ekulmis/shared";
import { UserRole as Role } from "@ekulmis/shared";
import type { AuthUser } from "./auth.types";
import { ROLES_KEY } from "./roles.decorator";
import { PERMISSION_KEY } from "./require-permission.decorator";

/**
 * Roles that have their own portal and must never reach a staff endpoint,
 * whatever a school writes in its permission table.
 *
 * Their permission rows describe what they see in their own portal — a
 * parent's "attendance: view" means their child's attendance, not the staff
 * register — so a school ticking a box there must not open the school-wide
 * endpoint behind the same words.
 */
const PORTAL_ROLES: string[] = [Role.PARENT, Role.STUDENT];

interface AuthedRequest {
  user?: AuthUser;
}

/**
 * Global guard: enforces `@Roles(...)`. Runs after JwtAuthGuard, so `req.user`
 * is present. Routes without `@Roles` are unrestricted (still need auth unless
 * `@Public`).
 *
 * Where a route also declares `@RequirePermission`, the permission decides and
 * this steps aside. Otherwise the role list would cap what a school can grant:
 * an administrator adding `teachers.view` to the Librarian saw nothing happen,
 * because the hard-coded role list on GET /teachers rejected the librarian
 * before the permission was ever consulted — and being able to add a
 * permission is half the point of having them.
 *
 * The portal roles are the exception, and they are not negotiable: a parent or
 * a student never reaches a staff endpoint, whatever the table says.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[] | undefined>(
      ROLES_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );
    if (!required || required.length === 0) {
      return true;
    }

    const req = ctx.switchToHttp().getRequest<AuthedRequest>();

    const permission = this.reflector.getAllAndOverride<string[] | undefined>(
      PERMISSION_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );
    if (permission?.length && req.user && !PORTAL_ROLES.includes(req.user.role)) {
      // PermissionsGuard runs next and is the real answer for this route.
      return true;
    }
    // SUPER_ADMINISTRATOR is a superset of ADMINISTRATOR: always permitted.
    const isSuperset =
      req.user?.role === "SUPER_ADMINISTRATOR" &&
      required.includes("ADMINISTRATOR" as UserRole);
    if (!req.user || (!required.includes(req.user.role) && !isSuperset)) {
      throw new ForbiddenException("Insufficient role");
    }
    return true;
  }
}
