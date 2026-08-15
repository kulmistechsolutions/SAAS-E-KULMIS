"use client";

import { usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useStudentPortalAuth } from "@/lib/student-portal/use-student-portal-auth";
import { StudentPortalShell } from "@/components/student-portal/portal-shell";

export default function StudentPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isLogin = pathname === "/student-portal/login";

  if (isLogin) return <>{children}</>;

  return <Guarded>{children}</Guarded>;
}

function Guarded({ children }: { children: React.ReactNode }) {
  const { me, loading } = useStudentPortalAuth();

  if (loading || !me) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }

  return <StudentPortalShell me={me}>{children}</StudentPortalShell>;
}
