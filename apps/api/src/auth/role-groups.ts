import { UserRole } from "@ekulmis/shared";

/**
 * Every internal staff role. Explicitly EXCLUDES the portal roles
 * (`PARENT`, `STUDENT`), which must only ever reach `/parent-portal/*` and the
 * public exam/quiz-by-code routes — never the operational listing endpoints.
 *
 * `SUPER_ADMINISTRATOR` is intentionally omitted here because `RolesGuard`
 * already treats it as a superset of `ADMINISTRATOR` wherever ADMINISTRATOR is
 * permitted, so it is granted implicitly.
 */
export const STAFF_ROLES: UserRole[] = [
  UserRole.ADMINISTRATOR,
  UserRole.ACADEMIC_MANAGER,
  UserRole.TEACHER,
  UserRole.FINANCE_OFFICER,
  UserRole.ATTENDANCE_OFFICER,
  UserRole.EXAM_MANAGER,
  UserRole.RECEPTION_OFFICER,
  UserRole.RECEPTION,
  UserRole.LIBRARIAN,
];
