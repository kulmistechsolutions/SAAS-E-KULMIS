"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Plus, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { createCustomRole, useUsersState } from "@/lib/users/store";
import { OWNER_ONLY_ROLES } from "@/lib/users/format";
import { useIsSuperAdministrator } from "@/lib/users/super-admin";
import { toast } from "@/lib/toast";

export default function RolesPage() {
  const state = useUsersState();
  // Strict: only the school's real owner (SUPER_ADMINISTRATOR), not every
  // Administrator — otherwise every staff Administrator account they create
  // sees the owner's own role card too.
  const isOwner = useIsSuperAdministrator();
  const [name, setName] = useState("");

  // The school manages its own roles; Super Administrator is the owner's own
  // account and is not one of them, so it only shows to the real owner.
  const visibleRoles = state.roles.filter(
    (r) => isOwner || !OWNER_ONLY_ROLES.includes(r.name as never),
  );

  function handleCreate() {
    const res = createCustomRole(name);
    if (!res.ok) {
      toast(res.error ?? "Failed", "error");
      return;
    }
    toast(`Role "${name}" created`, "success");
    setName("");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Roles & Permissions</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Built-in and custom roles with configurable module permissions.
        </p>
      </div>

      <div className="flex max-w-md gap-2">
        <Input
          placeholder="Custom role name (e.g. Library Officer)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-10"
        />
        <Button className="h-10 shrink-0" onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Add Role
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visibleRoles.map((role) => (
          <Link
            key={role.id}
            href={`/users/roles/${role.id}`}
            className="group rounded-xl border bg-card p-5 shadow-sm transition hover:border-primary/30 hover:shadow-md"
          >
            <div className="flex items-start justify-between">
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Shield className="h-5 w-5" />
              </span>
              <ChevronRight className="h-5 w-5 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
            </div>
            <p className="mt-3 font-semibold">{role.label}</p>
            <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
              {role.description}
            </p>
            <div className="mt-3">
              <Badge tone={role.builtIn ? "info" : "default"}>
                {role.builtIn ? "Built-in" : "Custom"}
              </Badge>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
