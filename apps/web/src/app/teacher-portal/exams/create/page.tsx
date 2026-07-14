"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Teachers cannot create official school examinations — redirect to mark entry. */
export default function TeacherPortalCreateExamPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/teacher-portal/exams/marks");
  }, [router]);
  return (
    <p className="text-muted-foreground">
      Official examinations are created by school administrators. Redirecting to mark entry…
    </p>
  );
}
