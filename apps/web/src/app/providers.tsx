"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { AuthProvider } from "@/lib/auth";
import { SettingsBrandingEffect } from "@/components/settings/branding-effect";

/** Global client-side providers (TanStack Query + auth session). */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, refetchOnWindowFocus: false },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SettingsBrandingEffect />
        {children}
      </AuthProvider>
    </QueryClientProvider>
  );
}
