import { UserRole } from "../roles";

/**
 * Which staff role may open which page — one list, mirroring the server.
 *
 * The menu, the route guard and the Roles & Permissions screen used to each
 * work this out for themselves from a coarse module grant, and they did not
 * agree. A module is not a page: `attendance` covers both taking a register
 * and the admin screen that assigns registers to officers, so granting the
 * module handed an attendance officer the page where officers are appointed.
 * `examinations` covers both entering marks and reading a summary, so an
 * academic manager was shown Create Exam, Enter Marks and Import Marks, and
 * was refused by the server on every one of them.
 *
 * Both halves of that are the same fault. A menu that offers what the server
 * will refuse wastes somebody's afternoon; a menu that offers what the server
 * will ALLOW but nobody granted is a leak. So this table is written at the
 * granularity the server actually enforces — the page — and is checked
 * against the controllers by the spec beside it.
 *
 * Administrators short-circuit before this is consulted, and the portal roles
 * (TEACHER, PARENT, STUDENT) never reach the staff shell at all.
 */

type StaffRole = Exclude<
  UserRole,
  | typeof UserRole.ADMINISTRATOR
  | typeof UserRole.SUPER_ADMINISTRATOR
  | typeof UserRole.TEACHER
  | typeof UserRole.PARENT
  | typeof UserRole.STUDENT
>;

const AM = UserRole.ACADEMIC_MANAGER;
const FO = UserRole.FINANCE_OFFICER;
const AO = UserRole.ATTENDANCE_OFFICER;
const EM = UserRole.EXAM_MANAGER;
const RO = UserRole.RECEPTION_OFFICER;
const LIB = UserRole.LIBRARIAN;

export interface StaffRouteRule {
  /** Path prefix, matched as an exact path or followed by "/". */
  prefix: string;
  /** Roles other than administrator that may open it. Empty = admin only. */
  roles: StaffRole[];
}

/**
 * Ordered most specific first: the first prefix that matches decides, so a
 * child page can be narrower OR wider than the section it sits in.
 */
export const STAFF_ROUTE_RULES: StaffRouteRule[] = [
  // --- Everyone signed in as staff -----------------------------------------
  { prefix: "/dashboard", roles: [AM, FO, AO, EM, RO, LIB] },
  { prefix: "/profile", roles: [AM, FO, AO, EM, RO, LIB] },
  { prefix: "/announcements", roles: [AM, FO, AO, EM, RO, LIB] },

  // --- Attendance ----------------------------------------------------------
  // Appointing officers and reading how they are doing is the school watching
  // its own staff. An officer holding the register is the subject of that
  // screen, not its audience — and the endpoints behind both refuse them.
  { prefix: "/attendance/officers", roles: [] },
  { prefix: "/attendance/monitoring", roles: [] },
  { prefix: "/attendance", roles: [AO] },
  { prefix: "/student-cases", roles: [AO] },

  // --- People --------------------------------------------------------------
  { prefix: "/students", roles: [RO, LIB] },
  { prefix: "/parents", roles: [RO] },
  // Assignments are academic planning; shifts are the attendance clock.
  { prefix: "/teachers/assignments", roles: [AM] },
  { prefix: "/teachers/shifts", roles: [AO] },
  { prefix: "/teachers", roles: [AM, RO] },
  // Printing cards is a front-desk and exam-hall job; the librarian was shown
  // this only because it rode along with a student-list grant.
  { prefix: "/id-cards", roles: [AM, EM, RO] },

  // --- Money ---------------------------------------------------------------
  { prefix: "/finance", roles: [FO] },
  { prefix: "/expenses", roles: [FO] },
  // Additional income sits in the expenses menu and shares its endpoint, but
  // had no entry of its own — so a finance officer was never shown it.
  { prefix: "/other-income", roles: [FO] },
  { prefix: "/salary", roles: [FO] },

  // --- Examinations --------------------------------------------------------
  // The exam manager runs the exam. An academic manager gets the one screen
  // the server answers for it — the school-wide summary — and not the class
  // result sheets, which are still exam-desk only.
  { prefix: "/examinations/reports", roles: [EM, AM] },
  { prefix: "/examinations", roles: [EM] },

  // --- Quiz ----------------------------------------------------------------
  // Monitoring is a read of how quizzes are going, which the server allows an
  // academic manager. The quiz report sheets themselves it does not.
  { prefix: "/quiz/monitoring", roles: [EM, AM] },
  { prefix: "/quiz", roles: [EM] },

  // --- Academic office -----------------------------------------------------
  { prefix: "/promotions", roles: [AM] },
  { prefix: "/academics", roles: [AM] },
  { prefix: "/timetable", roles: [] },

  // --- Everything else -----------------------------------------------------
  { prefix: "/library", roles: [LIB] },
  // Buying credit spends the school's money, so it stops with finance even
  // though three roles may send a message.
  { prefix: "/sms/packages", roles: [FO] },
  { prefix: "/sms", roles: [FO, EM, AM] },
  { prefix: "/copilot", roles: [FO, AM] },
  { prefix: "/reports", roles: [AM, FO, AO, EM, RO, LIB] },
  { prefix: "/users", roles: [] },
  { prefix: "/settings", roles: [] },
];

/**
 * Who may open each report category, mirroring the `@Roles` on the endpoints
 * that serve them (apps/api/src/reports/reports.controller.ts).
 *
 * `/reports` itself is open to every staff role — it is a hub, and each role
 * has at least one category in it. The categories are not derived from the
 * table above because the two genuinely differ: a finance officer is allowed
 * attendance reports without holding the attendance pages, and an exam
 * manager is allowed student reports without holding the student register.
 */
export const REPORT_CATEGORY_ROLES: Record<string, StaffRole[]> = {
  students: [FO, EM, RO, LIB],
  teachers: [FO, EM, AM],
  attendance: [FO, EM, AO, AM],
  fees: [FO],
  examinations: [FO, EM, AM],
  promotions: [FO, EM, AM],
  salary: [FO],
  expenses: [FO],
  financial: [FO],
  quiz: [FO, EM],
};

/** Match a rule prefix against a path: exact, or a segment boundary. */
function matches(prefix: string, pathname: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/**
 * Whether a non-admin staff role may open a page.
 *
 * Unknown pages are refused rather than allowed: a page nobody has placed in
 * the table is one nobody has decided about, and the safe answer to that is
 * the administrator's own screen.
 */
export function staffCanOpen(role: string, pathname: string): boolean {
  if (pathname.startsWith("/reports/")) {
    const category = pathname.split("/")[2] ?? "";
    const allowed = REPORT_CATEGORY_ROLES[category];
    // A category nobody has listed stays with the hub's own rule.
    if (allowed) return allowed.includes(role as StaffRole);
  }
  const rule = STAFF_ROUTE_RULES.find((r) => matches(r.prefix, pathname));
  if (!rule) return false;
  return rule.roles.includes(role as StaffRole);
}

/** Every prefix a role may open — what the menu is filtered against. */
export function staffRoutePrefixes(role: string): string[] {
  return STAFF_ROUTE_RULES.filter((r) => r.roles.includes(role as StaffRole)).map(
    (r) => r.prefix,
  );
}
