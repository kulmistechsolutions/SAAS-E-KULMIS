import { z } from "zod";

/**
 * The 8 system roles (MASTER_PRD §8 / Module 15).
 * RBAC menus and route guards are derived from these.
 */
export const UserRole = {
  ADMINISTRATOR: "ADMINISTRATOR",
  TEACHER: "TEACHER",
  PARENT: "PARENT",
  STUDENT: "STUDENT",
  ATTENDANCE_OFFICER: "ATTENDANCE_OFFICER",
  FINANCE_OFFICER: "FINANCE_OFFICER",
  EXAM_MANAGER: "EXAM_MANAGER",
  RECEPTION: "RECEPTION",
  // Extended roles surfaced in the admin UI (Module 15).
  SUPER_ADMINISTRATOR: "SUPER_ADMINISTRATOR",
  ACADEMIC_MANAGER: "ACADEMIC_MANAGER",
  RECEPTION_OFFICER: "RECEPTION_OFFICER",
  LIBRARIAN: "LIBRARIAN",
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const userRoleSchema = z.nativeEnum(UserRole);

export const ALL_ROLES = Object.values(UserRole);
