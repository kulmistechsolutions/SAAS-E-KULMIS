"use client";

import { toast } from "@/lib/toast";

/**
 * The sign-in link a school sends to a teacher or a guardian.
 *
 * Built from the address the school itself is on, so it is that school's
 * subdomain and not a link into someone else's. A hard-coded domain here would
 * be the one way this could hand a family the wrong school.
 *
 * The login ID travels with it. A bare link leaves the person at a form asking
 * for an ID they do not have, which turns one message into two — and the ID is
 * already printed on their own paperwork, so sending it reveals nothing. The
 * password never goes in: it is reset from the row beside this one, shown once,
 * and belongs in a message the school composes deliberately.
 */
export type Portal = "teacher" | "parent" | "student";

const LABEL: Record<Portal, string> = {
  teacher: "Teacher ID",
  parent: "Parent ID",
  student: "Student ID",
};

export function portalLoginUrl(portal: Portal): string {
  if (typeof window === "undefined") return `/${portal}-portal/login`;
  return `${window.location.origin}/${portal}-portal/login`;
}

/** Copy the link and the login ID as one message. */
export async function copyPortalLink(
  portal: Portal,
  code: string,
): Promise<void> {
  const text = `${portalLoginUrl(portal)}\n${LABEL[portal]}: ${code}`;
  try {
    await navigator.clipboard.writeText(text);
    toast(`Link copied for ${code}`, "success");
  } catch {
    // Clipboard access is refused in plain-HTTP contexts and some locked-down
    // browsers. Showing the link beats a button that silently does nothing.
    toast(portalLoginUrl(portal), "info");
  }
}
