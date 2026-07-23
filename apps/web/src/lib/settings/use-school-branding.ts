"use client";

import { useEffect, useState } from "react";
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
  headerLayout: "LEFT" as "LEFT" | "CENTERED",
};

/**
 * Set once, on the first mount anywhere in the session. The static snapshot is
 * only needed to keep the very first client paint equal to the server paint
 * (hydration safety). Every client-side navigation after that remounts the
 * component with the branding store already populated — gating on per-component
 * `mounted` state made the logo blink out for one frame on each page change.
 * A module-level flag survives those remounts, so the logo stays put.
 */
let sessionHydrated = false;

/** Reactive school name/branding from System Settings (SSR-safe, flicker-free). */
export function useSchoolBranding() {
  const settings = useSettingsState();
  const [hydrated, setHydrated] = useState(sessionHydrated);

  useEffect(() => {
    if (!sessionHydrated) sessionHydrated = true;
    if (!hydrated) setHydrated(true);
  }, [hydrated]);

  void settings; // re-render when branding changes in the store
  return hydrated ? schoolBranding() : STATIC_BRANDING;
}
