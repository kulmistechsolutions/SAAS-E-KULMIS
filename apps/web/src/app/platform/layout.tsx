"use client";

import { usePathname } from "next/navigation";
import { PlatformAuthProvider } from "@/lib/platform/auth";
import { PlatformGuard } from "@/components/platform/platform-shell";

export default function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isLogin = pathname === "/platform/login";

  return (
    <PlatformAuthProvider>
      {isLogin ? children : <PlatformGuard>{children}</PlatformGuard>}
    </PlatformAuthProvider>
  );
}
