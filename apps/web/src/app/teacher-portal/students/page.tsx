"use client";


import { useT } from "@/lib/i18n/provider";
import Link from "next/link";
import { useTeacherPortal } from "@/components/teacher-portal/portal-context";
import TeacherPortalStudentsList from "./students-list";

export default function TeacherPortalStudentsPage() {
  const t = useT();
  const { canViewStudents } = useTeacherPortal();

  if (!canViewStudents) {
    return (
      <div className="mx-auto max-w-lg space-y-4 rounded-xl border bg-card p-8 text-center">
        <h1 className="text-xl font-bold">{t("teacherPortalStudents.studentAccessNotEnabled")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("teacherPortalStudents.yourAdministratorHasNotGrantedThe")}
        </p>
        <Link
          href="/teacher-portal"
          className="inline-block text-sm font-medium text-primary hover:underline"
        >
          {t("teacherPortalStudents.backToDashboard")}
        </Link>
      </div>
    );
  }

  return <TeacherPortalStudentsList />;
}
