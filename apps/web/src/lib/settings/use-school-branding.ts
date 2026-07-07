"use client";

import { useMemo } from "react";
import { schoolBranding, useSettingsState } from "@/lib/settings/store";
import { BRAND } from "@/lib/brand";

/** Reactive school name/branding from System Settings (falls back to static BRAND on SSR). */
export function useSchoolBranding() {
  const settings = useSettingsState();
  return useMemo(() => {
    if (typeof window === "undefined") {
      return {
        name: BRAND.name,
        tagline: BRAND.tagline,
        loginTitle: BRAND.name,
        footerText: BRAND.tagline,
        logoUrl: null as string | null,
        loginBackgroundUrl: null as string | null,
        primaryColor: "#3b82f6",
      };
    }
    return schoolBranding();
  }, [settings]);
}
