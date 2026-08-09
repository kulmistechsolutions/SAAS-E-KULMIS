"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { AuthProvider } from "@/lib/auth";
import { I18nProvider } from "@/lib/i18n/provider";
import type { Lang } from "@/lib/i18n/config";
import { SettingsBrandingEffect } from "@/components/settings/branding-effect";
import { ChunkErrorReloader } from "@/components/layout/chunk-error-reloader";

/** Global client-side providers (language + TanStack Query + auth session). */
export function Providers({
  lang,
  children,
}: {
  lang: Lang;
  children: ReactNode;
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, refetchOnWindowFocus: false },
        },
      }),
  );

  return (
    <I18nProvider initialLang={lang}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <SettingsBrandingEffect />
          <ChunkErrorReloader />
          {children}
        </AuthProvider>
      </QueryClientProvider>
    </I18nProvider>
  );
}
