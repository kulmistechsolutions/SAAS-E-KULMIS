"use client";

import { TeacherDashboard } from "@/components/dashboard/teacher-dashboard";
import { useTeacherPortal } from "@/components/teacher-portal/portal-context";

export default function TeacherPortalDashboardPage() {
  const { canViewStudents } = useTeacherPortal();
  return <TeacherDashboard portalMode canViewStudents={canViewStudents} />;
}
