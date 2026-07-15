/**
 * @ekulmis/shared — types & Zod schemas shared by the API (NestJS) and
 * the web app (Next.js). Single source of truth for validation.
 */
export * from "./roles";
export * from "./grades";
export * from "./schemas/auth";
export * from "./schemas/user";
export * from "./schemas/settings";
export * from "./schemas/academics";
export * from "./schemas/student";
export * from "./schemas/student-photo";
export * from "./schemas/teacher";
export * from "./schemas/attendance";
export * from "./schemas/finance";
export * from "./schemas/platform";
export * from "./schemas/examination";
export * from "./schemas/promotion";
export * from "./schemas/quiz";
export * from "./schemas/sms";
export * from "./schemas/library";
export * from "./schemas/ai";
export * from "./schemas/subscriptions";

/** Multi-tenant primitives (MASTER_PRD scope decision: multi-tenant SaaS). */
export interface TenantContext {
  /** The resolved tenant (school) id for the current request. */
  schoolId: string;
  /** Subdomain the tenant was resolved from, e.g. "iskuul1". */
  subdomain: string;
}
