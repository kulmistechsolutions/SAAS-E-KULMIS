"use client";

/** Routes inside the dedicated teacher portal shell. */
export const TEACHER_PORTAL_NAV = [
  { href: "/teacher-portal", label: "Dashboard", exact: true },
  { href: "/teacher-portal/profile", label: "My Profile" },
  { href: "/teacher-portal/assignments", label: "My Assignments" },
  { href: "/teacher-portal/students", label: "My Students", requiresStudents: true },
  { href: "/teacher-portal/attendance", label: "Attendance" },
  { href: "/teacher-portal/exams", label: "Official Exams" },
  { href: "/teacher-portal/quizzes", label: "My Quizzes" },
  { href: "/teacher-portal/results", label: "Results", requiresStudents: true },
  { href: "/teacher-portal/announcements", label: "Announcements" },
  { href: "/teacher-portal/notifications", label: "Notifications" },
] as const;

export function isTeacherPortalRoute(pathname: string): boolean {
  return (
    pathname === "/teacher-portal" ||
    pathname.startsWith("/teacher-portal/")
  );
}

export function teacherPortalLanding(): string {
  return "/teacher-portal";
}
