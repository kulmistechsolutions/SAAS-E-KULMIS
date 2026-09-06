import { PERMISSIONS_BY_ROLE } from "@ekulmis/shared";
import type {
  BuiltInRole,
  PermissionAction,
  PermissionMap,
  PermissionModule,
  SystemRole,
} from "./types";

export function shortDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

export function dateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function userIdCode(seq: number): string {
  return `USR-${String(seq).padStart(6, "0")}`;
}

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMINISTRATOR: "Super Administrator",
  ADMINISTRATOR: "Administrator",
  ACADEMIC_MANAGER: "Academic Manager",
  TEACHER: "Teacher",
  PARENT: "Parent",
  STUDENT: "Student",
  FINANCE_OFFICER: "Finance Officer",
  ATTENDANCE_OFFICER: "Attendance Officer",
  EXAM_MANAGER: "Exam Manager",
  RECEPTION_OFFICER: "Reception Officer",
  LIBRARIAN: "Librarian",
  // Legacy value kept only so an existing account created before Reception
  // Officer existed still shows a real label instead of raw enum text.
  RECEPTION: "Reception (Legacy)",
};

export function roleLabel(role: SystemRole): string {
  return ROLE_LABELS[role] ?? role.replace(/_/g, " ");
}

export const BUILT_IN_ROLES: BuiltInRole[] = [
  "SUPER_ADMINISTRATOR",
  "ADMINISTRATOR",
  "ACADEMIC_MANAGER",
  "TEACHER",
  "PARENT",
  "STUDENT",
  "FINANCE_OFFICER",
  "ATTENDANCE_OFFICER",
  "EXAM_MANAGER",
  "RECEPTION_OFFICER",
  "LIBRARIAN",
];

/**
 * Super Administrator is the school owner's own account, not a role the school
 * hands out — it is hidden from everyone but a super admin.
 */
export const OWNER_ONLY_ROLES: BuiltInRole[] = ["SUPER_ADMINISTRATOR"];

/**
 * Roles that can be picked when creating a staff user. Parent and Student
 * accounts are provisioned automatically when a student is registered, so they
 * are never handed out by hand, and Super Administrator is owner-only.
 */
export const ASSIGNABLE_ROLES: BuiltInRole[] = BUILT_IN_ROLES.filter(
  (r) => r !== "SUPER_ADMINISTRATOR" && r !== "PARENT" && r !== "STUDENT",
);

export const MODULES: { id: PermissionModule; label: string }[] = [
  { id: "students", label: "Students" },
  { id: "teachers", label: "Teachers" },
  { id: "parents", label: "Parents" },
  { id: "attendance", label: "Attendance" },
  { id: "fees", label: "Fee Management" },
  { id: "examinations", label: "Examinations" },
  { id: "quiz", label: "Online Quiz" },
  { id: "reports", label: "Reports" },
  { id: "finance", label: "Finance" },
  { id: "expenses", label: "Expenses" },
  { id: "salaries", label: "Salaries" },
  { id: "promotions", label: "Promotions" },
  { id: "academics", label: "Academics" },
  { id: "settings", label: "Settings" },
  { id: "users", label: "User Management" },
  { id: "audit", label: "Audit Logs" },
  { id: "sms", label: "SMS" },
  { id: "library", label: "Library" },
];

export const ACTIONS: { id: PermissionAction; label: string }[] = [
  { id: "view", label: "View" },
  { id: "create", label: "Create" },
  { id: "update", label: "Update" },
  { id: "delete", label: "Delete" },
  { id: "import", label: "Import" },
  { id: "export", label: "Export" },
  { id: "print", label: "Print" },
  { id: "approve", label: "Approve" },
];

export function emptyPermissions(): PermissionMap {
  const map = {} as PermissionMap;
  for (const m of MODULES) {
    map[m.id] = {
      view: false,
      create: false,
      update: false,
      delete: false,
      import: false,
      export: false,
      print: false,
      approve: false,
    };
  }
  return map;
}

/** Merge stored permissions with defaults so new modules never crash the UI. */
export function normalizePermissions(
  source?: Partial<PermissionMap> | null,
): PermissionMap {
  const base = emptyPermissions();
  if (!source) return base;
  for (const m of MODULES) {
    const mod = source[m.id];
    if (!mod) continue;
    for (const a of ACTIONS) {
      if (typeof mod[a.id] === "boolean") {
        base[m.id][a.id] = mod[a.id];
      }
    }
  }
  return base;
}

function grant(
  map: PermissionMap,
  module: PermissionModule,
  actions: PermissionAction[],
): PermissionMap {
  const next = { ...map, [module]: { ...map[module] } };
  for (const a of actions) next[module][a] = true;
  return next;
}

function grantAll(
  map: PermissionMap,
  modules: PermissionModule[],
): PermissionMap {
  let next = map;
  for (const mod of modules) {
    next = grant(
      next,
      mod,
      ACTIONS.map((a) => a.id),
    );
  }
  return next;
}

/**
 * A built-in role's permissions, expanded from the shared table.
 *
 * The table lives in `@ekulmis/shared` because the sidebar, the route guard,
 * the dashboard and the server all have to agree with this screen. They did
 * not: a finance officer's matrix showed Students ticked across all eight
 * actions — a module the role has never held, on any screen, on any server.
 */
export function builtInRolePermissions(role: BuiltInRole): PermissionMap {
  let p = emptyPermissions();
  const table = PERMISSIONS_BY_ROLE[role] ?? {};
  for (const [module, actions] of Object.entries(table)) {
    if (!actions?.length) continue;
    p = grant(p, module as PermissionModule, actions as PermissionAction[]);
  }
  return p;
}

export function hashPassword(password: string): string {
  if (typeof btoa !== "undefined") {
    return btoa(`ekulmis:${password}`);
  }
  return `ekulmis:${password}`;
}

export function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}

export function statusLabel(status: string): string {
  return status.charAt(0) + status.slice(1).toLowerCase();
}
