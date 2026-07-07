import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";
import type { PlatformAdminCtx } from "./platform.types";

interface PlatformRequest extends Request {
  platformAdmin?: PlatformAdminCtx;
}

/** Injects the authenticated platform Super Admin. */
export const CurrentPlatformAdmin = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): PlatformAdminCtx => {
    const req = ctx.switchToHttp().getRequest<PlatformRequest>();
    if (!req.platformAdmin) {
      throw new UnauthorizedException();
    }
    return req.platformAdmin;
  },
);
