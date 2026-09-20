import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import type { AuthUser, JwtPayload } from "./auth.types";
import { IS_PUBLIC_KEY } from "./public.decorator";
import { BILLING_SCOPE_KEY } from "./billing-scope.decorator";
import type { TenantRequest } from "../tenant/tenant-request";

interface AuthedRequest extends TenantRequest {
  user?: AuthUser;
}

/**
 * Global guard: verifies the Bearer access token, attaches `req.user`, and
 * derives `req.tenant` from the token so authenticated calls are tenant-scoped
 * even without a subdomain. Routes marked `@Public()` are skipped.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
  ) {}

  canActivate(ctx: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const header = req.headers.authorization ?? "";
    const [scheme, token] = header.split(" ");
    if (scheme !== "Bearer" || !token) {
      throw new UnauthorizedException("Missing bearer token");
    }

    let payload: JwtPayload;
    try {
      payload = this.jwt.verify<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException("Invalid or expired token");
    }

    // A renewal token opens the billing routes and nothing else. Checked
    // before `req.user` is attached, so a route that never considered this
    // case cannot receive a caller it would treat as an ordinary signed-in
    // administrator. Deny by default: the alternative is a credential that
    // quietly works somewhere nobody thought to look.
    if (payload.scope === "BILLING") {
      const allowed = this.reflector.getAllAndOverride<boolean>(
        BILLING_SCOPE_KEY,
        [ctx.getHandler(), ctx.getClass()],
      );
      if (!allowed) {
        throw new ForbiddenException(
          "Your subscription has expired. This session can only choose and pay for a plan.",
        );
      }
    }

    req.user = {
      userId: payload.sub,
      schoolId: payload.sid,
      role: payload.role,
      customRoleId: payload.crid,
      // Read the permission table under the school's own role when there is
      // one; the built-in role is only the fallback.
      permissionRole: payload.crid ?? payload.role,
      username: payload.username,
      scope: payload.scope,
      impersonatedBy: payload.imp,
    };
    // Ensure tenant scoping for token-authenticated requests.
    req.tenant ??= { schoolId: payload.sid, subdomain: "" };
    return true;
  }
}
