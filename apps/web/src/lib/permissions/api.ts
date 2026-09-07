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
