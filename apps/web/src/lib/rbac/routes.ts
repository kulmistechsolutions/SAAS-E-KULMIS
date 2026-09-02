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
  // The ID Generator prints student documents, so it follows student access —
  // and is listed again under `examinations` so an Exam Manager can print exam
  // cards without being handed the whole student register (PRD §28). A route is
  // allowed when ANY granted module claims it, so listing it twice widens
  // access to exactly those two roles rather than to everyone.
  students: ["/students", "/id-cards"],
  teachers: ["/teachers"],
  parents: ["/parents"],
  attendance: ["/attendance", "/student-cases"],
  fees: ["/finance"],
  examinations: ["/examinations", "/id-cards"],
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

/**
 * Roles the School Copilot answers to, matching its `@Roles` on the API.
 *
 * It reads the school's finances to answer questions, so it cannot ride along
 * with the `reports` permission the way it used to: that grant belongs to the
 * Attendance Officer, Exam Manager, Librarian and Reception Officer as well,
 * and all four were shown a Copilot link that the server then refused.
 */
const COPILOT_ROLES = ["ADMINISTRATOR", "SUPER_ADMINISTRATOR", "FINANCE_OFFICER", "ACADEMIC_MANAGER"];

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
  if (COPILOT_ROLES.includes(normalized)) prefixes.add("/copilot");
  return [...prefixes];
}

/**
 * Who may open each report category, mirroring the `@Roles` on the endpoints
 * that serve them (apps/api/src/reports/reports.controller.ts).
 *
 * `reports` is granted to almost every staff role, and it used to carry the
 * whole of `/reports/*` with it — so an Attendance Officer, an Exam Manager, a
 * Librarian and a Reception Officer were all shown Fee Reports and Financial
 * Reports in the sidebar. The API refused them, but a menu that lists the
 * school's fee and salary reporting to whoever holds a register is telling
 * them something they were not granted.
 *
 * These lists are copied from the server rather than derived from the
 * permission matrix, because the two genuinely differ: a Finance Officer has
 * no `attendance` permission yet is allowed attendance reports, and an Exam
 * Manager has no `students` permission yet is allowed student reports.
 * Deriving would have quietly taken those away.
 *
 * Administrators short-circuit before this map is consulted.
 */
const REPORT_CATEGORY_ROLES: Record<string, string[]> = {
  students: ["FINANCE_OFFICER", "EXAM_MANAGER", "RECEPTION_OFFICER", "LIBRARIAN"],
  teachers: ["FINANCE_OFFICER", "EXAM_MANAGER", "ACADEMIC_MANAGER"],
  attendance: [
    "FINANCE_OFFICER",
    "EXAM_MANAGER",
    "ATTENDANCE_OFFICER",
    "ACADEMIC_MANAGER",
  ],
  fees: ["FINANCE_OFFICER"],
  examinations: ["FINANCE_OFFICER", "EXAM_MANAGER", "ACADEMIC_MANAGER"],
  promotions: ["FINANCE_OFFICER", "EXAM_MANAGER", "ACADEMIC_MANAGER"],
  salary: ["FINANCE_OFFICER"],
  expenses: ["FINANCE_OFFICER"],
  financial: ["FINANCE_OFFICER"],
  quiz: ["FINANCE_OFFICER", "EXAM_MANAGER"],
};

/** Whether a role may open a given (app) pathname. */
export function isRouteAllowedForRole(role: string, pathname: string): boolean {
  if (isFullAccessRole(role)) return true;
  if (isPortalRole(role)) return false;

  // The reports index stays with the `reports` grant; a category inside it
  // answers only to the roles its endpoint answers to.
  if (pathname.startsWith("/reports/")) {
    const allowed = REPORT_CATEGORY_ROLES[pathname.split("/")[2] ?? ""];
    if (allowed && !allowed.includes(normalizeRole(role))) return false;
  }

  const prefixes = allowedPrefixesForRole(role);
  return prefixes.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

/** The page a role should land on / be redirected to when blocked. */
export function landingRouteForRole(role: string): string {
  if (isFullAccessRole(role)) return "/dashboard";
  // An attendance officer's first screen is the work they came to do, not the
  // module's front door.
  if (normalizeRole(role) === "ATTENDANCE_OFFICER") return "/attendance/my-classes";
  const portal = portalHomeForRole(role);
  if (portal) return portal;
  const prefixes = allowedPrefixesForRole(role).filter(
    (p) => !COMMON_PREFIXES.includes(p),
  );
  return prefixes[0] ?? "/dashboard";
}
