"use client";


import { useT } from "@/lib/i18n/provider";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Teachers cannot create official school examinations — redirect to mark entry. */
export default function TeacherPortalCreateExamPage() {
  const t = useT();
  const router = useRouter();
  useEffect(() => {
    router.replace("/teacher-portal/exams/marks");
  }, [router]);
  return (
    <p className="text-muted-foreground">
      {t("teacherPortalExamsCreate.officialExaminationsAreCreatedBySchool")}
    </p>
  );
}
