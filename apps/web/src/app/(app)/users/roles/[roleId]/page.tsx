"use client";


import { useT } from "@/lib/i18n/provider";
import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PermissionMatrix } from "@/components/users/permission-matrix";
import { getRole } from "@/lib/users/store";
import { normalizePermissions } from "@/lib/users/format";
import {
  apiCustomRoles,
  apiDeleteCustomRole,
  apiResetRolePermissions,
  apiRolePermissions,
  apiSaveRolePermissions,
  type CustomRole,
} from "@/lib/permissions/api";
import { refreshPermissions } from "@/lib/permissions/store";
import type { Grants } from "@/lib/permissions/store";
import { OWNER_ONLY_ROLES } from "@/lib/users/format";
import { isPortalRole } from "@/lib/rbac/routes";
import { useIsSuperAdministrator } from "@/lib/users/super-admin";
import type { PermissionMap } from "@/lib/users/types";
import { toast } from "@/lib/toast";

export default function RolePermissionsPage({
  params,
}: {
  params: Promise<{ roleId: string }>;
}) {
  const t = useT();
  const { roleId } = use(params);
  const router = useRouter();
  // Strict: only the real owner account, not every Administrator (see
  // useIsSuperAdministrator).
  const isOwner = useIsSuperAdministrator();
  const builtInRole = useMemo(() => getRole(roleId), [roleId]);
  /** Set when this page is a role the school made rather than a built-in one. */
  const [customRole, setCustomRole] = useState<CustomRole | null>(null);

  useEffect(() => {
    let alive = true;
    apiCustomRoles()
      .then((rows) => alive && setCustomRole(rows.find((r) => r.id === roleId) ?? null))
      .catch(() => alive && setCustomRole(null));
    return () => {
      alive = false;
    };
  }, [roleId]);

  const role = useMemo(
    () =>
      customRole
        ? {
            id: customRole.id,
            name: customRole.id,
            label: customRole.name,
            description: customRole.description ?? "",
            builtIn: false,
          }
        : builtInRole,
    [customRole, builtInRole],
  );
  const [permissions, setPermissions] = useState<PermissionMap | null>(null);
  const [server, setServer] = useState<PermissionMap | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  /**
   * The school's own effective permissions, from the server.
   *
   * This screen used to read and write the browser's localStorage, so a change
   * reached nobody: not the server, not the school's other machines, and
   * nothing that enforces anything. It now reads what the school actually has
   * and writes back to the same place every guard reads from.
   */
  useEffect(() => {
    let alive = true;
    setLoading(true);
    apiRolePermissions()
      .then((all) => {
        if (!alive) return;
        setServer(normalizePermissions(toMatrix(all[roleId])));
      })
      .catch(() => alive && setServer(null))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [roleId]);

  const perms =
    permissions ?? server ?? (customRole ? null : builtInRole?.permissions);
  const readOnly = role?.name === "SUPER_ADMINISTRATOR";

  // The owner's own role is not part of what a school manages — reaching this
  // page by URL should look the same as a role that isn't there.
  const hidden =
    !!role && !isOwner && OWNER_ONLY_ROLES.includes(role.name as never);

  const handleSave = useCallback(async () => {
    if (!role || !perms) return;
    setSaving(true);
    try {
      const res = await apiSaveRolePermissions(role.name, toGrants(perms));
      setServer(normalizePermissions(toMatrix(res.permissions)));
      setPermissions(null);
      setDirty(false);
      // Whoever is signed in may have just changed their own access; the
      // menu and the route guard read this and must not lag behind the save.
      await refreshPermissions();
      const n = res.changed.granted.length + res.changed.revoked.length;
      toast(
        n === 0
          ? t("usersRoles.nothingChanged")
          : `${res.changed.granted.length} granted · ${res.changed.revoked.length} revoked`,
        "success",
      );
    } catch (e) {
      toast(e instanceof Error ? e.message : "Save failed", "error");
    } finally {
      setSaving(false);
    }
  }, [role, perms, t]);

  const handleDelete = useCallback(async () => {
    if (!customRole) return;
    if (!window.confirm(t("usersRoles.deleteRoleConfirm"))) return;
    setSaving(true);
    try {
      const res = await apiDeleteCustomRole(customRole.id);
      toast(
        t("usersRoles.roleDeleted").replace("{n}", String(res.usersMovedBack)),
        "success",
      );
      router.push("/users/roles");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Delete failed", "error");
    } finally {
      setSaving(false);
    }
  }, [customRole, t, router]);

  const handleReset = useCallback(async () => {
    if (!role) return;
    setSaving(true);
    try {
      const res = await apiResetRolePermissions(role.name);
      setServer(normalizePermissions(toMatrix(res.permissions)));
      setPermissions(null);
      setDirty(false);
      await refreshPermissions();
      toast(t("usersRoles.resetToDefault"), "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Reset failed", "error");
    } finally {
      setSaving(false);
    }
  }, [role, t]);

  if (!role || hidden) {
    return <p className="text-muted-foreground">{t("usersRoles.roleNotFound")}</p>;
  }
  if (loading || !perms) {
    return <p className="text-muted-foreground">{t("usersRoles.loading")}</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href="/users/roles"
            className="inline-flex items-center gap-2 text-sm text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("usersRoles.roles")}
          </Link>
          <h1 className="mt-2 text-2xl font-bold">{role.label}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {role.description}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge tone={role.builtIn ? "info" : "default"}>
              {role.builtIn ? "Built-in Role" : "Custom Role"}
            </Badge>
            {isPortalRole(role.name) && (
              <Badge tone="warning">{t("usersRoles.portalRole")}</Badge>
            )}
          </div>
        </div>
        {!readOnly && (
          <div className="flex gap-2">
            {customRole ? (
              // A role the school made can be removed; a built-in one can only
              // be put back to what the product ships.
              <Button
                variant="outline"
                className="h-9 text-destructive"
                onClick={handleDelete}
                disabled={saving}
              >
                {t("usersRoles.deleteRole")}
              </Button>
            ) : (
              <Button
                variant="outline"
                className="h-9"
                onClick={handleReset}
                disabled={saving}
              >
                {t("usersRoles.resetToDefault")}
              </Button>
            )}
            {dirty && (
              <Button className="h-9" onClick={handleSave} disabled={saving}>
                {t("usersRoles.savePermissions")}
              </Button>
            )}
          </div>
        )}
      </div>

      {isPortalRole(role.name) && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          {t("usersRoles.portalRoleNotice")}
        </div>
      )}

      <PermissionMatrix
        permissions={perms}
        readOnly={readOnly}
        onChange={(next) => {
          setPermissions(next);
          setDirty(true);
        }}
      />
    </div>
  );
}

/** `{ fees: ["view"] }` from the server -> the matrix the table renders. */
function toMatrix(grants?: Grants): Partial<PermissionMap> {
  const out: Record<string, Record<string, boolean>> = {};
  for (const [module, actions] of Object.entries(grants ?? {})) {
    out[module] = Object.fromEntries((actions ?? []).map((a) => [a, true]));
  }
  return out as Partial<PermissionMap>;
}

/** The matrix back to `{ fees: ["view"] }`, ticked actions only. */
function toGrants(map: PermissionMap): Grants {
  const out: Grants = {};
  for (const [module, actions] of Object.entries(map)) {
    out[module] = Object.entries(actions)
      .filter(([, on]) => on)
      .map(([a]) => a);
  }
  return out;
}
