"use client";

import { usePathname } from "next/navigation";
import { PortalProvider } from "@/components/parent-portal/portal-context";
import { PortalShell } from "@/components/parent-portal/portal-shell";

export default function ParentPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isLogin = pathname === "/parent-portal/login";

  if (isLogin) return <>{children}</>;

  return (
    <PortalProvider>
      <PortalShell>{children}</PortalShell>
    </PortalProvider>
  );
}
