import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import type { AuthUser, JwtPayload } from "./auth.types";
import { IS_PUBLIC_KEY } from "./public.decorator";
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

    req.user = {
      userId: payload.sub,
      schoolId: payload.sid,
      role: payload.role,
      username: payload.username,
    };
    // Ensure tenant scoping for token-authenticated requests.
    req.tenant ??= { schoolId: payload.sid, subdomain: "" };
    return true;
  }
}
