"use client";

import { usePathname } from "next/navigation";
import { StudentPortalProvider, useStudentPortal } from "@/components/student-portal/portal-context";
import { StudentPortalShell } from "@/components/student-portal/portal-shell";

export default function StudentPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isLogin = pathname === "/student-portal/login";

  if (isLogin) return <>{children}</>;

  return (
    <StudentPortalProvider>
      <ShellWithMe>{children}</ShellWithMe>
    </StudentPortalProvider>
  );
}

function ShellWithMe({ children }: { children: React.ReactNode }) {
  const { me } = useStudentPortal();
  return <StudentPortalShell me={me}>{children}</StudentPortalShell>;
}
