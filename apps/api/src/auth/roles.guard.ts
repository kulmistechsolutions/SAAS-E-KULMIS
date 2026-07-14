import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { UserRole } from "@ekulmis/shared";
import type { AuthUser } from "./auth.types";
import { ROLES_KEY } from "./roles.decorator";

interface AuthedRequest {
  user?: AuthUser;
}

/**
 * Global guard: enforces `@Roles(...)`. Runs after JwtAuthGuard, so `req.user`
 * is present. Routes without `@Roles` are unrestricted (still need auth unless
 * `@Public`).
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
