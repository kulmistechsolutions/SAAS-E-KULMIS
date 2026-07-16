import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import type { PlatformAdminCtx, PlatformAdminRole } from "./platform.types";

export const PLATFORM_ROLES_KEY = "platform_roles";

/** Require one of the listed platform roles (in addition to PlatformGuard). */
export const RequirePlatformRoles = (...roles: PlatformAdminRole[]) =>
  SetMetadata(PLATFORM_ROLES_KEY, roles);

interface PlatformRequest extends Request {
  platformAdmin?: PlatformAdminCtx;
}

@Injectable()
export class PlatformRolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<PlatformAdminRole[]>(
      PLATFORM_ROLES_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );
    if (!required?.length) return true;

    const req = ctx.switchToHttp().getRequest<PlatformRequest>();
    const admin = req.platformAdmin;
    if (!admin) {
      throw new UnauthorizedException("Not a platform token");
    }
    if (!required.includes(admin.role)) {
      throw new ForbiddenException(
        "Insufficient platform permissions. Only Super Admins can perform this action.",
      );
    }
    return true;
  }
}
