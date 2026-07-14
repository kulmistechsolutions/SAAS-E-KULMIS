"use client";

import { useEffect, useMemo, useState } from "react";
import { schoolBranding, useSettingsState } from "@/lib/settings/store";
import { BRAND } from "@/lib/brand";

const STATIC_BRANDING = {
  name: BRAND.name,
  tagline: BRAND.tagline,
  loginTitle: BRAND.name,
  footerText: BRAND.tagline,
  logoUrl: null as string | null,
  loginBackgroundUrl: null as string | null,
  primaryColor: "#3b82f6",
};

/** Reactive school name/branding from System Settings (SSR-safe). */
export function useSchoolBranding() {
  const settings = useSettingsState();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  return useMemo(() => {
    if (!mounted) return STATIC_BRANDING;
    return schoolBranding();
  }, [settings, mounted]);
}
