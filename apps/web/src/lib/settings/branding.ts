"use client";

import { hexToHslChannels } from "./format";
import { getSettings } from "./store";
import type { SettingsState } from "./types";

export function applyBrandingToDocument(settings?: SettingsState) {
  if (typeof document === "undefined") return;
  const s = settings ?? getSettings();
  const root = document.documentElement;

  const primary = hexToHslChannels(s.branding.primaryColor);
  const secondary = hexToHslChannels(s.branding.secondaryColor);

  if (primary) {
    root.style.setProperty("--primary", primary);
    root.style.setProperty("--ring", primary);
  }
  if (secondary) root.style.setProperty("--secondary", secondary);

  if (s.branding.faviconDataUrl) {
    let link = document.querySelector<HTMLLinkElement>("link[data-settings-favicon]");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      link.setAttribute("data-settings-favicon", "true");
      document.head.appendChild(link);
    }
    link.href = s.branding.faviconDataUrl;
  }

  document.title = `${s.school.name} — School Management ERP`;
}
