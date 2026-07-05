import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";
import type { AuthUser } from "./auth.types";
import type { TenantRequest } from "../tenant/tenant-request";

interface AuthedRequest extends TenantRequest {
  user?: AuthUser;
}

/** Injects the authenticated `AuthUser`. Throws if the route isn't authed. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    if (!req.user) {
      throw new UnauthorizedException();
    }
    return req.user;
  },
);
