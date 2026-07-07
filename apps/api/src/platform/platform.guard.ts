import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { Request } from "express";
import type { PlatformAdminCtx, PlatformJwtPayload } from "./platform.types";

interface PlatformRequest extends Request {
  platformAdmin?: PlatformAdminCtx;
}

/**
 * Guards platform (Super Admin) routes. Requires a valid access token whose
 * payload has `platform: true`. School tokens (which carry a schoolId, not the
 * platform flag) are rejected — keeping the two layers fully separate.
 */
@Injectable()
export class PlatformGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<PlatformRequest>();
    const [scheme, token] = (req.headers.authorization ?? "").split(" ");
    if (scheme !== "Bearer" || !token) {
      throw new UnauthorizedException("Missing bearer token");
    }
    let payload: PlatformJwtPayload;
    try {
      payload = this.jwt.verify<PlatformJwtPayload>(token);
    } catch {
      throw new UnauthorizedException("Invalid or expired token");
    }
    if (payload.platform !== true) {
      throw new UnauthorizedException("Not a platform token");
    }
    req.platformAdmin = { adminId: payload.sub, username: payload.username };
    return true;
  }
}
