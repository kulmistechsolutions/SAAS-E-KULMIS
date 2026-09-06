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

/**
 * Kept in step with the server's own `@Roles` decorators, not with what a
 * screen would like to draw. Where the two ever differ the server wins, and
 * this list is what gets corrected.
 */
export const MODULES_BY_ROLE: Record<string, PermissionModule[]> = {
  [UserRole.SUPER_ADMINISTRATOR]: ALL_MODULES,
  [UserRole.ADMINISTRATOR]: ALL_MODULES,

  [UserRole.ACADEMIC_MANAGER]: [
    "academics",
    "teachers",
    "promotions",
    "examinations",
    "quiz",
    "reports",
    "sms",
  ],
  [UserRole.FINANCE_OFFICER]: [
    "fees",
    "finance",
    "salaries",
    "expenses",
    "reports",
    "sms",
  ],
  // Takes registers for the classes it was assigned. Nothing else.
  [UserRole.ATTENDANCE_OFFICER]: ["attendance", "reports"],
  [UserRole.EXAM_MANAGER]: ["examinations", "quiz", "reports", "sms"],
  [UserRole.RECEPTION_OFFICER]: ["students", "parents", "teachers", "reports"],
  [UserRole.RECEPTION]: ["students", "parents", "teachers", "reports"],
  [UserRole.LIBRARIAN]: ["library", "students", "reports"],

  // Portal roles. Their rows describe their own portal, never the staff shell.
  [UserRole.TEACHER]: [
    "teachers",
    "attendance",
    "examinations",
    "quiz",
    "academics",
    "reports",
  ],
  [UserRole.PARENT]: ["attendance", "fees", "examinations", "quiz"],
  [UserRole.STUDENT]: ["attendance", "fees", "examinations", "quiz"],
};

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
