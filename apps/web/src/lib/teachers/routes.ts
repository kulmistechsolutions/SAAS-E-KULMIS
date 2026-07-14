"use client";

/**
 * Routes teachers may access. Everything else under (app) is blocked.
 * Prefix match: `/students` allows `/students/xyz`.
 */
export const TEACHER_ALLOWED_PREFIXES = [
  "/dashboard",
  "/profile",
  "/my-students",
  "/my-schedule",
  "/my-assignments",
  "/students",
  "/attendance/students",
  "/examinations/teacher",
  "/quiz",
  "/announcements",
  "/reports",
] as const;

export const TEACHER_BLOCKED_EXACT = new Set([
  "/examinations/create",
  "/examinations/groups",
  "/examinations/blocked",
  "/examinations/monitoring",
  "/examinations/marks",
  "/quiz/question-bank",
  "/quiz/portal",
]);

export function isTeacherRouteAllowed(pathname: string): boolean {
  if (TEACHER_BLOCKED_EXACT.has(pathname)) return false;
  return TEACHER_ALLOWED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

/** Default landing page when a teacher hits a blocked route. */
export function teacherLandingRoute(): string {
  return "/dashboard";
}
