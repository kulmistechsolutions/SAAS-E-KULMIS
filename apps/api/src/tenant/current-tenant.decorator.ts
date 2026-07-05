import {
  createParamDecorator,
  ExecutionContext,
  BadRequestException,
} from "@nestjs/common";
import type { TenantContext } from "@ekulmis/shared";
import type { TenantRequest } from "./tenant-request";

/**
 * Injects the resolved `TenantContext` into a handler. Throws if the request
 * has no tenant — use it on any route that operates on tenant-scoped data.
 */
export const CurrentTenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): TenantContext => {
    const req = ctx.switchToHttp().getRequest<TenantRequest>();
    if (!req.tenant) {
      throw new BadRequestException("No tenant resolved for this request");
    }
    return req.tenant;
  },
);
