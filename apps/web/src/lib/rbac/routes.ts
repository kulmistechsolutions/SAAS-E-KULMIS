"use client";

import { builtInRolePermissions } from "@/lib/users/format";
import type { BuiltInRole, PermissionModule } from "@/lib/users/types";

/**
 * Role-based route access for the (app) shell. Derived from the SAME built-in
 * permission matrix used everywhere else (`builtInRolePermissions`) so the
 * menu, the route guard, and backend `@Roles` all agree.
 *
 * ADMINISTRATOR / SUPER_ADMINISTRATOR get everything. TEACHER has its own
 * bespoke route set (see `lib/teachers/routes.ts`). Every other staff role is
 * scoped here to the pages their permissions actually grant.
 */

/** Map a permission module to the route prefix(es) that surface it. */
const MODULE_PREFIXES: Record<PermissionModule, string[]> = {
  students: ["/students"],
  teachers: ["/teachers"],
  parents: ["/parents"],
  attendance: ["/attendance"],
  fees: ["/finance"],
  examinations: ["/examinations"],
  quiz: ["/quiz"],
  reports: ["/reports"],
  finance: ["/finance"],
  expenses: ["/expenses"],
  salaries: ["/salary"],
  promotions: ["/promotions"],
  academics: ["/academics"],
  settings: ["/settings"],
  users: ["/users"],
  audit: [],
  sms: ["/sms"],
  library: ["/library"],
};

/** Always available to any authenticated staff member. */
const COMMON_PREFIXES = ["/dashboard", "/profile", "/announcements"];

/** Normalize the JWT role to a built-in role key the matrix understands. */
export function normalizeRole(role: string): string {
  if (role === "ADMINISTRATOR") return "SUPER_ADMINISTRATOR";
  if (role === "RECEPTION") return "RECEPTION_OFFICER";
  return role;
}

/** True for roles that may access the entire (app) shell. */
export function isFullAccessRole(role: string): boolean {
  const r = normalizeRole(role);
  return r === "SUPER_ADMINISTRATOR" || r === "ADMINISTRATOR";
}

/** Allowed route prefixes for a role, or `["/"]` for full access. */
export function allowedPrefixesForRole(role: string): string[] {
  if (isFullAccessRole(role)) return ["/"];
  const normalized = normalizeRole(role) as BuiltInRole;
  const perms = builtInRolePermissions(normalized);
  const prefixes = new Set<string>(COMMON_PREFIXES);
  for (const mod of Object.keys(MODULE_PREFIXES) as PermissionModule[]) {
    if (perms[mod]?.view) {
      for (const p of MODULE_PREFIXES[mod]) prefixes.add(p);
    }
  }
  return [...prefixes];
}

/** Whether a role may open a given (app) pathname. */
export function isRouteAllowedForRole(role: string, pathname: string): boolean {
  const prefixes = allowedPrefixesForRole(role);
  if (prefixes.includes("/")) return true;
  return prefixes.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

/** The page a role should land on / be redirected to when blocked. */
export function landingRouteForRole(role: string): string {
  if (isFullAccessRole(role)) return "/dashboard";
  const prefixes = allowedPrefixesForRole(role).filter(
    (p) => !COMMON_PREFIXES.includes(p),
  );
  return prefixes[0] ?? "/dashboard";
}
