"use client";

import { useEffect } from "react";
import { applyBrandingToDocument } from "@/lib/settings/branding";
import { useSettingsState } from "@/lib/settings/store";

/** Applies school branding (colors, favicon, title) when settings change. */
export function SettingsBrandingEffect() {
  const settings = useSettingsState();

  useEffect(() => {
    applyBrandingToDocument(settings);
  }, [settings]);

  return null;
}
