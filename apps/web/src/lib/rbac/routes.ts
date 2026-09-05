"use client";

import { staffCanOpen, staffRoutePrefixes } from "@ekulmis/shared";

/**
 * Role-based route access for the (app) shell.
 *
 * The decision itself lives in `@ekulmis/shared` (`staff-routes.ts`), written
 * page by page against what the server enforces, so the menu, this guard and
 * the API cannot drift apart the way they had. This file only translates
 * between the shell's idea of a role and that table.
 *
 * ADMINISTRATOR / SUPER_ADMINISTRATOR get everything. TEACHER, PARENT and
 * STUDENT belong in their own portals and never reach here.
 */

/**
 * Roles that are not school staff: each has its own portal and must never
 * reach the (app) staff shell.
 *
 * This distinction matters because their permission rows describe what they
 * may see *inside their own portal* — a parent's "attendance: view" means
 * their child's attendance, not the staff register.
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
  return staffRoutePrefixes(normalizeRole(role));
}

/** Whether a role may open a given (app) pathname. */
export function isRouteAllowedForRole(role: string, pathname: string): boolean {
  if (isFullAccessRole(role)) return true;
  if (isPortalRole(role)) return false;
  return staffCanOpen(normalizeRole(role), pathname);
}

/** The page a role should land on / be redirected to when blocked. */
export function landingRouteForRole(role: string): string {
  if (isFullAccessRole(role)) return "/dashboard";
  // An attendance officer's first screen is the work they came to do, not the
  // module's front door.
  if (normalizeRole(role) === "ATTENDANCE_OFFICER") return "/attendance/my-classes";
  const portal = portalHomeForRole(role);
  if (portal) return portal;
  return "/dashboard";
}
