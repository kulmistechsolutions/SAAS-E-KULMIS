import { api } from "@/lib/api";
import type { Grants } from "./store";

/** Every role's effective permissions at this school. */
export const apiRolePermissions = () =>
  api<Record<string, Grants>>("/permissions/roles");

/** What the product grants a role before this school changed anything. */
export const apiRoleDefaults = (role: string) =>
  api<Grants>(`/permissions/roles/${encodeURIComponent(role)}/defaults`);

export const apiSaveRolePermissions = (role: string, permissions: Grants) =>
  api<{
    role: string;
    permissions: Grants;
    changed: { granted: string[]; revoked: string[] };
  }>(`/permissions/roles/${encodeURIComponent(role)}`, {
    method: "PUT",
    body: { permissions },
  });

/** Put a role back to the product default. */
export const apiResetRolePermissions = (role: string) =>
  api<{ role: string; permissions: Grants }>(
    `/permissions/roles/${encodeURIComponent(role)}`,
    { method: "DELETE" },
  );

/** A role a school made for itself. */
export interface CustomRole {
  id: string;
  name: string;
  description: string | null;
}

export const apiCustomRoles = () =>
  api<CustomRole[]>("/permissions/custom-roles");

export const apiCreateCustomRole = (name: string, description?: string) =>
  api<CustomRole>("/permissions/custom-roles", {
    method: "POST",
    body: { name, description },
  });

export const apiRenameCustomRole = (
  id: string,
  name: string,
  description?: string,
) =>
  api<CustomRole>(`/permissions/custom-roles/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: { name, description },
  });

/** Anyone on it falls back to the built-in role their account still carries. */
export const apiDeleteCustomRole = (id: string) =>
  api<{ success: boolean; usersMovedBack: number }>(
    `/permissions/custom-roles/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
