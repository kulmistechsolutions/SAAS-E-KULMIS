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
  attendance: ["/attendance", "/student-cases"],
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

/**
 * Roles that are not school staff: each has its own portal and must never
 * reach the (app) staff shell.
 *
 * This distinction matters because their rows in `builtInRolePermissions`
 * describe what they may see *inside their own portal* — a parent's
 * "attendance: view" means their child's attendance, not the staff register.
 * Running those through MODULE_PREFIXES the way a staff role is scoped would
 * hand a parent the staff attendance register, fee collection and exam
 * management pages, which is exactly the leak this map prevents.
 */
const PORTAL_HOME: Record<string, string> = {
  TEACHER: "/teacher-portal",
  PARENT: "/parent-portal",
  // Students have no dedicated shell — the public results lookup is their page.
  STUDENT: "/results",
};

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

/** True for non-staff roles that belong in their own portal, not (app). */
export function isPortalRole(role: string): boolean {
  return normalizeRole(role) in PORTAL_HOME;
}

/** Where a non-staff role belongs, or null for staff. */
export function portalHomeForRole(role: string): string | null {
  return PORTAL_HOME[normalizeRole(role)] ?? null;
}

/** Allowed route prefixes for a role, or `["/"]` for full access. */
export function allowedPrefixesForRole(role: string): string[] {
  if (isFullAccessRole(role)) return ["/"];
  // Non-staff roles get no (app) route at all, not even the shared dashboard.
  if (isPortalRole(role)) return [];
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
  const portal = portalHomeForRole(role);
  if (portal) return portal;
  const prefixes = allowedPrefixesForRole(role).filter(
    (p) => !COMMON_PREFIXES.includes(p),
  );
  return prefixes[0] ?? "/dashboard";
}
