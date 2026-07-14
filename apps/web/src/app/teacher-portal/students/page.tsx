"use client";

import Link from "next/link";
import { useTeacherPortal } from "@/components/teacher-portal/portal-context";
import TeacherPortalStudentsList from "./students-list";

export default function TeacherPortalStudentsPage() {
  const { canViewStudents } = useTeacherPortal();

  if (!canViewStudents) {
    return (
      <div className="mx-auto max-w-lg space-y-4 rounded-xl border bg-card p-8 text-center">
        <h1 className="text-xl font-bold">Student access not enabled</h1>
        <p className="text-sm text-muted-foreground">
          Your administrator has not granted the &quot;View Students&quot; permission
          for your account. Contact the school office if you need access to student
          records in your assigned classes.
        </p>
        <Link
          href="/teacher-portal"
          className="inline-block text-sm font-medium text-primary hover:underline"
        >
          Back to dashboard
        </Link>
      </div>
    );
  }

  return <TeacherPortalStudentsList />;
}
