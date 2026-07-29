"use client";

import { useEffect } from "react";
import { applyBrandingToDocument } from "@/lib/settings/branding";
import { useSettingsState } from "@/lib/settings/store";

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_APP_ROOT_DOMAIN ?? "";

/**
 * The bare root domain (ekulmis.com) is the product's own site, not a school.
 * Tenant resolution falls back to a default subdomain there, so without this
 * guard that fallback school's name, colours, and favicon would be painted
 * onto the public marketing page.
 */
function isBareRootDomain(): boolean {
  if (typeof window === "undefined" || !ROOT_DOMAIN) return false;
  const host = window.location.hostname.toLowerCase();
  return host === ROOT_DOMAIN || host === `www.${ROOT_DOMAIN}`;
}

/** Applies school branding (colors, favicon, title) when settings change. */
export function SettingsBrandingEffect() {
  const settings = useSettingsState();

  useEffect(() => {
    if (isBareRootDomain()) return;
    applyBrandingToDocument(settings);
  }, [settings]);

  return null;
}
