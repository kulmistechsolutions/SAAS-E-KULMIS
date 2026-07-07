"use client";

import { canAccess } from "@/lib/users/store";
import type { PermissionAction, PermissionModule } from "@/lib/users/types";
import { useAuth } from "@/lib/auth";

export function usePermission(module: PermissionModule, action: PermissionAction): boolean {
  const { user } = useAuth();
  if (!user) return false;
  const role =
    user.role === "ADMINISTRATOR"
      ? "SUPER_ADMINISTRATOR"
      : user.role === "RECEPTION"
        ? "RECEPTION_OFFICER"
        : user.role;
  return canAccess(role, module, action);
}
