"use client";

import { toast } from "@/lib/toast";

/**
 * The sign-in link a school sends to a teacher or a guardian.
 *
 * Built from the address the school itself is on, so it is that school's
 * subdomain and not a link into someone else's. A hard-coded domain here would
 * be the one way this could hand a family the wrong school.
 *
 * The link and nothing else. It goes straight into a message the school is
 * already writing, and anything else pasted with it — an ID, a label — is
 * something they then have to delete.
 */
export type Portal = "teacher" | "parent" | "student";

export function portalLoginUrl(portal: Portal): string {
  if (typeof window === "undefined") return `/${portal}-portal/login`;
  return `${window.location.origin}/${portal}-portal/login`;
}

/** Copy the sign-in link. */
export async function copyPortalLink(portal: Portal): Promise<void> {
  const url = portalLoginUrl(portal);
  try {
    await navigator.clipboard.writeText(url);
    toast("Link copied", "success");
  } catch {
    // Clipboard access is refused in plain-HTTP contexts and some locked-down
    // browsers. Showing the link beats a button that silently does nothing.
    toast(url, "info");
  }
}
