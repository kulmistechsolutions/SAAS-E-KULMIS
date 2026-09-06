import { UserRole } from "../roles";

/**
 * What each role actually holds — the one list both sides read.
 *
 * A role's permissions had been written down three times: once in the web's
 * permission matrix, once as `@Roles` on each endpoint, and once, implicitly,
 * in whatever a screen happened to render. The dashboard was the third kind.
 * An attendance officer, granted attendance and reports and nothing else,
 * opened it to 127 students, 3 teachers, 55 parents and 20 classes — four
 * counts of a school they hold no part of, on the first screen they see.
 *
 * Masking the money was not enough, because the fault was never about money.
 * It was that "signed in" was being treated as "may see the totals". A role
 * sees the modules it was granted, and a screen that shows anything else is
 * showing what nobody agreed to.
 */

export type PermissionModule =
  | "students"
  | "teachers"
  | "parents"
  | "attendance"
  | "fees"
  | "examinations"
  | "quiz"
  | "reports"
  | "finance"
  | "expenses"
  | "salaries"
  | "promotions"
  | "academics"
  | "settings"
  | "users"
  | "audit"
  | "sms"
  | "library";

export const ALL_MODULES: PermissionModule[] = [
  "students",
  "teachers",
  "parents",
  "attendance",
  "fees",
  "examinations",
  "quiz",
  "reports",
  "finance",
  "expenses",
  "salaries",
  "promotions",
  "academics",
  "settings",
  "users",
  "audit",
  "sms",
  "library",
];

export type PermissionAction =
  | "view"
  | "create"
  | "update"
  | "delete"
  | "import"
  | "export"
  | "print"
  | "approve";

export const ALL_ACTIONS: PermissionAction[] = [
  "view",
  "create",
  "update",
  "delete",
  "import",
  "export",
  "print",
  "approve",
];

/** Everything a module can be done to — for the roles that own it outright. */
const FULL = ALL_ACTIONS;
/** Reading and taking a copy, but changing nothing. */
const READ: PermissionAction[] = ["view", "export", "print"];

/**
 * The whole permission table, module by module and action by action.
 *
 * This is the only place a built-in role's permissions are written down.
 * The Roles & Permissions screen, the sidebar, the route guard and the
 * dashboard all read it, so none of them can show a school a different answer
 * from the others — which is exactly what they were doing: a finance officer's
 * matrix showed Students fully ticked, a module the role has never held.
 *
 * Kept in step with the server's own `@Roles` decorators, not with what a
 * screen would like to draw. Where the two ever differ the server wins, and
 * this table is what gets corrected.
 */
export const PERMISSIONS_BY_ROLE: Record<
  string,
  Partial<Record<PermissionModule, PermissionAction[]>>
> = {
  [UserRole.SUPER_ADMINISTRATOR]: Object.fromEntries(
    ALL_MODULES.map((m) => [m, FULL]),
  ),
  [UserRole.ADMINISTRATOR]: {
    ...Object.fromEntries(
      ALL_MODULES.filter((m) => m !== "users" && m !== "audit" && m !== "sms").map(
        (m) => [m, FULL],
      ),
    ),
    // A school administrator manages accounts but does not delete the record
    // of what they did.
    users: ["view", "create", "update", "export", "print"],
    audit: ["view", "export"],
    sms: ["view", "create", "export"],
  },
  [UserRole.ACADEMIC_MANAGER]: {
    promotions: FULL,
    reports: FULL,
    // Reads the school's academic picture. Creating an exam, entering marks
    // and importing them are the exam manager's, and the server has always
    // refused an academic manager there.
    academics: READ,
    teachers: READ,
    examinations: READ,
    quiz: ["view", "export"],
    sms: ["view", "create"],
  },
  [UserRole.FINANCE_OFFICER]: {
    fees: FULL,
    finance: FULL,
    salaries: FULL,
    expenses: FULL,
    reports: FULL,
    sms: ["view", "create", "export"],
  },
  [UserRole.ATTENDANCE_OFFICER]: {
    // Takes registers for the classes it was assigned. Appointing officers and
    // reviewing how they perform belongs to the school, not to the officer
    // being reviewed — so this stops short of delete and approve.
    attendance: ["view", "create", "update", "export", "print"],
    reports: FULL,
  },
  [UserRole.EXAM_MANAGER]: {
    examinations: FULL,
    quiz: FULL,
    reports: FULL,
    sms: ["view", "create"],
  },
  [UserRole.RECEPTION_OFFICER]: {
    students: ["view", "create", "update"],
    parents: ["view", "create", "update"],
    // Hiring is not a front-desk job: the server accepts a teacher record only
    // from an administrator.
    teachers: ["view"],
    reports: READ,
  },
  [UserRole.LIBRARIAN]: {
    library: FULL,
    students: ["view"],
    reports: ["view"],
  },

  [UserRole.TEACHER]: {
    teachers: ["view", "update"],
    attendance: ["view", "create", "update"],
    examinations: ["view", "update"],
    quiz: ["view", "create", "update"],
    academics: ["view"],
    reports: ["view"],
  },
  [UserRole.PARENT]: {
    attendance: ["view"],
    fees: ["view", "print"],
    examinations: ["view"],
    quiz: ["view"],
  },
  [UserRole.STUDENT]: {
    attendance: ["view"],
    fees: ["view"],
    examinations: ["view"],
    quiz: ["view"],
  },
};

// Legacy value, same desk as RECEPTION_OFFICER.
PERMISSIONS_BY_ROLE[UserRole.RECEPTION] =
  PERMISSIONS_BY_ROLE[UserRole.RECEPTION_OFFICER];

/**
 * Which modules each role holds — derived, so it cannot drift from the table
 * above the way two hand-written lists always eventually do.
 */
export const MODULES_BY_ROLE: Record<string, PermissionModule[]> = (() => {
  const out: Record<string, PermissionModule[]> = {};
  for (const role of Object.keys(PERMISSIONS_BY_ROLE)) {
    out[role] = (
      Object.keys(PERMISSIONS_BY_ROLE[role]!) as PermissionModule[]
    ).filter((m) => (PERMISSIONS_BY_ROLE[role]![m] ?? []).length > 0);
  }
  return out;
})();

/** Every action a role may take on a module. Empty when it holds none. */
export function actionsForRoleModule(
  role: string,
  module: PermissionModule,
): PermissionAction[] {
  return PERMISSIONS_BY_ROLE[role]?.[module] ?? [];
}

/** Whether a role holds a module at all. Unknown roles hold nothing. */
export function roleHasModule(role: string, module: PermissionModule): boolean {
  return (MODULES_BY_ROLE[role] ?? []).includes(module);
}

/** Every module a role holds. */
export function modulesForRole(role: string): PermissionModule[] {
  return MODULES_BY_ROLE[role] ?? [];
}

/**
 * Which parts of the dashboard a role may be shown.
 *
 * Each section is named by the module that grants it, so adding a section
 * means deciding whose it is — rather than it defaulting, as every section
 * did, to everyone who could log in.
 */
export interface DashboardVisibility {
  students: boolean;
  teachers: boolean;
  parents: boolean;
  academics: boolean;
  attendance: boolean;
  fees: boolean;
  finance: boolean;
  exams: boolean;
  /** The audit feed: who did what across the whole school. */
  activity: boolean;
}

export function dashboardVisibilityFor(role: string): DashboardVisibility {
  const has = (m: PermissionModule) => roleHasModule(role, m);
  return {
    students: has("students"),
    teachers: has("teachers"),
    parents: has("parents"),
    academics: has("academics"),
    attendance: has("attendance"),
    fees: has("fees"),
    finance: has("finance"),
    exams: has("examinations"),
    activity: has("audit"),
  };
}
