"use client";

import type { ReactNode } from "react";
import { usePermissions } from "@/lib/permissions/store";

/**
 * Show something only if the signed-in user may actually do it.
 *
 * A button that opens a dialog the server will refuse is not a small
 * cosmetic problem: somebody fills the form, presses Save, and is told no —
 * having been invited to try. Wrapping the control in what it needs keeps the
 * screen honest about what this person can do.
 *
 * This is not the security boundary. The API is (see `@RequirePermission`);
 * this only stops the app offering what it knows will be refused.
 */
export function Can({
  perform,
  children,
  fallback = null,
}: {
  /** One permission, or several where any one is enough. */
  perform: string | string[];
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const allowed = useCan(perform);
  return <>{allowed ? children : fallback}</>;
}

/** The same question in a hook, for disabling rather than hiding. */
export function useCan(perform: string | string[]): boolean {
  const { grants, loaded } = usePermissions();
  // Nothing is offered before the answer arrives: flashing a control and then
  // taking it away is worse than showing it a moment late.
  if (!loaded) return false;
  const wanted = Array.isArray(perform) ? perform : [perform];
  return wanted.some((p) => {
    const [module, action] = p.split(".");
    return (grants[module ?? ""] ?? []).includes(action ?? "");
  });
}
