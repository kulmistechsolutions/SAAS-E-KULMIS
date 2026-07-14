"use client";

import { usePathname } from "next/navigation";
import { TeacherPortalProvider } from "@/components/teacher-portal/portal-context";
import { TeacherPortalShell } from "@/components/teacher-portal/portal-shell";

export default function TeacherPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isLogin = pathname === "/teacher-portal/login";

  if (isLogin) return <>{children}</>;

  return (
    <TeacherPortalProvider>
      <TeacherPortalShell>{children}</TeacherPortalShell>
    </TeacherPortalProvider>
  );
}
