"use client";

import { useAuth } from "@/lib/auth";

/** True when the signed-in user is a school-level Super Administrator. */
export function useIsSchoolSuperAdmin(): boolean {
  const { user } = useAuth();
  if (!user) return false;
  return user.role === "ADMINISTRATOR" || isSchoolSuperAdminRole(user.role);
}

export function isSchoolSuperAdminRole(role: string): boolean {
  return role === "SUPER_ADMINISTRATOR";
}
