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
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const userRoleSchema = z.nativeEnum(UserRole);

export const ALL_ROLES = Object.values(UserRole);
