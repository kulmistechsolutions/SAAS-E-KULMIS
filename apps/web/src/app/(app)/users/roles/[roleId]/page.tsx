"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PermissionMatrix } from "@/components/users/permission-matrix";
import { getRole, updateRolePermissions } from "@/lib/users/store";
import { OWNER_ONLY_ROLES } from "@/lib/users/format";
import { useIsSchoolSuperAdmin } from "@/lib/users/super-admin";
import type { PermissionMap } from "@/lib/users/types";
import { toast } from "@/lib/toast";

export default function RolePermissionsPage({
  params,
}: {
  params: Promise<{ roleId: string }>;
}) {
  const { roleId } = use(params);
  const isSuper = useIsSchoolSuperAdmin();
  const role = useMemo(() => getRole(roleId), [roleId]);
  const [permissions, setPermissions] = useState<PermissionMap | null>(null);
  const [dirty, setDirty] = useState(false);

  const perms = permissions ?? role?.permissions;
  const readOnly = role?.name === "SUPER_ADMINISTRATOR";

  // The owner's own role is not part of what a school manages — reaching this
  // page by URL should look the same as a role that isn't there.
  const hidden =
    !!role && !isSuper && OWNER_ONLY_ROLES.includes(role.name as never);

  if (!role || !perms || hidden) {
    return <p className="text-muted-foreground">Role not found.</p>;
  }

  function handleSave() {
    if (!role || !perms) return;
    const res = updateRolePermissions(role.id, perms);
    if (!res.ok) {
      toast(res.error ?? "Save failed", "error");
      return;
    }
    toast("Permissions updated", "success");
    setDirty(false);
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
            Roles
          </Link>
          <h1 className="mt-2 text-2xl font-bold">{role.label}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {role.description}
          </p>
          <Badge className="mt-2" tone={role.builtIn ? "info" : "default"}>
            {role.builtIn ? "Built-in Role" : "Custom Role"}
          </Badge>
        </div>
        {!readOnly && dirty && (
          <Button className="h-9" onClick={handleSave}>
            Save Permissions
          </Button>
        )}
      </div>

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
