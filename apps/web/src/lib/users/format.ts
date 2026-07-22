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

export function builtInRolePermissions(role: BuiltInRole): PermissionMap {
  const allMods = MODULES.map((m) => m.id);
  let p = emptyPermissions();

  switch (role) {
    case "SUPER_ADMINISTRATOR":
      return grantAll(p, allMods);
    case "ADMINISTRATOR":
      p = grantAll(
        p,
        allMods.filter((m) => m !== "users" && m !== "audit"),
      );
      p = grant(p, "users", ["view", "create", "update", "export", "print"]);
      p = grant(p, "audit", ["view", "export"]);
      p = grant(p, "sms", ["view", "create", "export"]);
      return p;
    case "ACADEMIC_MANAGER":
      p = grantAll(p, [
        "academics",
        "teachers",
        "promotions",
        "reports",
        "examinations",
      ]);
      p = grant(p, "sms", ["view", "create"]);
      return p;
    case "TEACHER":
      // Student access is per-teacher (canViewStudents) — not role-wide.
      p = grant(p, "teachers", ["view", "update"]);
      p = grant(p, "attendance", ["view", "create", "update"]);
      // Official exams: view assigned + enter marks only (no create/delete/lock/publish).
      p = grant(p, "examinations", ["view", "update"]);
      p = grant(p, "quiz", ["view", "create", "update"]);
      p = grant(p, "academics", ["view"]);
      p = grant(p, "reports", ["view"]);
      return p;
    case "PARENT":
      p = grant(p, "attendance", ["view"]);
      p = grant(p, "fees", ["view", "print"]);
      p = grant(p, "examinations", ["view"]);
      p = grant(p, "quiz", ["view"]);
      return p;
    case "STUDENT":
      p = grant(p, "attendance", ["view"]);
      p = grant(p, "fees", ["view"]);
      p = grant(p, "examinations", ["view"]);
      p = grant(p, "quiz", ["view"]);
      return p;
    case "FINANCE_OFFICER":
      p = grantAll(p, ["fees", "salaries", "expenses", "finance", "reports"]);
      p = grant(p, "sms", ["view", "create", "export"]);
      return p;
    case "ATTENDANCE_OFFICER":
      p = grantAll(p, ["attendance", "reports"]);
      return p;
    case "EXAM_MANAGER":
      p = grantAll(p, ["examinations", "reports"]);
      p = grant(p, "sms", ["view", "create"]);
      return p;
    case "RECEPTION_OFFICER":
      p = grant(p, "students", ["view", "create", "update"]);
      p = grant(p, "parents", ["view", "create", "update"]);
      p = grant(p, "teachers", ["view", "create", "update"]);
      p = grant(p, "reports", ["view"]);
      return p;
    case "LIBRARIAN":
      p = grantAll(p, ["library"]);
      p = grant(p, "students", ["view"]);
      p = grant(p, "reports", ["view"]);
      return p;
    default:
      return p;
  }
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
