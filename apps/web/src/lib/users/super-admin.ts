"use client";

import { useAuth } from "@/lib/auth";

/**
 * True for ADMINISTRATOR or the real SUPER_ADMINISTRATOR — owner-tier access
 * to settings that predate the school having its own Super Administrator
 * account (License, Subscription, Danger Zone, User management). Kept broad
 * so existing schools, whose owner account is still ADMINISTRATOR, don't lose
 * access to features they already use.
 */
export function useIsSchoolSuperAdmin(): boolean {
  const { user } = useAuth();
  if (!user) return false;
  return user.role === "ADMINISTRATOR" || isSchoolSuperAdminRole(user.role);
}

/**
 * True ONLY for the school's actual owner account (role SUPER_ADMINISTRATOR).
 * Every school gets exactly one of these — created when the school itself was
 * provisioned — and no one, including that owner, can ever hand the role out
 * via Create User (see ASSIGNABLE_ROLES). Use this, not the broader check
 * above, anywhere the owner's own role must stay invisible to the staff
 * Administrator accounts they create.
 */
export function useIsSuperAdministrator(): boolean {
  const { user } = useAuth();
  return !!user && isSchoolSuperAdminRole(user.role);
}

export function isSchoolSuperAdminRole(role: string): boolean {
  return role === "SUPER_ADMINISTRATOR";
}
