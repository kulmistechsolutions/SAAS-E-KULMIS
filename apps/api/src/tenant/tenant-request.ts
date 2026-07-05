import type { Request } from "express";
import type { TenantContext } from "@ekulmis/shared";

/** Express request augmented with the resolved tenant (set by TenantMiddleware). */
export interface TenantRequest extends Request {
  tenant?: TenantContext;
}
