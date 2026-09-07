import { Injectable } from "@nestjs/common";
import {
  ALL_ACTIONS,
  ALL_MODULES,
  PERMISSIONS_BY_ROLE,
  type PermissionAction,
  type PermissionModule,
} from "@ekulmis/shared";
import { PrismaService } from "../prisma/prisma.service";

/** `{ students: ["view","export"], fees: [] }` — the shape stored and sent. */
export type PermissionGrants = Partial<Record<PermissionModule, PermissionAction[]>>;

/**
 * What a role may actually do at one school.
 *
 * Two things decide it: the product's default for that role, and the school's
 * own override. Until now only the first existed, and the screen that appeared
 * to edit the second was writing to the browser's localStorage — so a school
 * that turned a permission off saw it turn off, on that machine, until the
 * browser was cleared, while the server never heard about it at all.
 *
 * The merge is per module, not per role: a module the school has said nothing
 * about keeps the default, and a module it has set to an empty list is a
 * deliberate revoke. Those are different answers and must not collapse into
 * one, or "I removed every action" would read as "I said nothing".
 */
@Injectable()
export class PermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  /** The product default for a role, before any school has touched it. */
  defaultsFor(role: string): PermissionGrants {
    return { ...(PERMISSIONS_BY_ROLE[role] ?? {}) };
  }

  /** Only the modules/actions this school has deliberately changed. */
  async overridesFor(schoolId: string, role: string): Promise<PermissionGrants | null> {
    const row = await this.prisma.forTenant(schoolId, (tx) =>
      tx.rolePermission.findFirst({ where: { role } }),
    );
    return (row?.permissions as PermissionGrants | undefined) ?? null;
  }

  /** Default ⊕ override — the answer every guard and every screen must use. */
  async effectiveFor(schoolId: string, role: string): Promise<PermissionGrants> {
    const overrides = await this.overridesFor(schoolId, role);
    return mergeGrants(this.defaultsFor(role), overrides);
  }

  /** Every role's effective permissions, for the Roles & Permissions screen. */
  async allEffective(schoolId: string): Promise<Record<string, PermissionGrants>> {
    const rows = await this.prisma.forTenant(schoolId, (tx) =>
      tx.rolePermission.findMany(),
    );
    const byRole = new Map(
      rows.map((r) => [r.role, r.permissions as PermissionGrants]),
    );
    const out: Record<string, PermissionGrants> = {};
    for (const role of Object.keys(PERMISSIONS_BY_ROLE)) {
      out[role] = mergeGrants(this.defaultsFor(role), byRole.get(role) ?? null);
    }
    // A school's own custom role has no default to fall back on: what it holds
    // is exactly what was stored for it.
    for (const [role, grants] of byRole) {
      if (!out[role]) out[role] = sanitise(grants);
    }
    return out;
  }

  /**
   * Whether a role may do one thing — "fees.update", "students.view".
   *
   * Deny by default, in the strong sense: an unknown role, an unknown module
   * and an action nobody listed all answer no. A permission system whose
   * unknown case is "allow" is not a permission system.
   */
  async can(schoolId: string, role: string, permission: string): Promise<boolean> {
    const [module, action] = permission.split(".");
    if (!module || !action) return false;
    const grants = await this.effectiveFor(schoolId, role);
    return (grants[module as PermissionModule] ?? []).includes(
      action as PermissionAction,
    );
  }

  /** Replace one role's override. Returns what the role now effectively holds. */
  async setOverride(
    schoolId: string,
    role: string,
    grants: PermissionGrants,
    updatedById?: string,
  ): Promise<PermissionGrants> {
    const clean = sanitise(grants);
    await this.prisma.forTenant(schoolId, (tx) =>
      tx.rolePermission.upsert({
        where: { schoolId_role: { schoolId, role } },
        create: { schoolId, role, permissions: clean, updatedById: updatedById ?? null },
        update: { permissions: clean, updatedById: updatedById ?? null },
      }),
    );
    return mergeGrants(this.defaultsFor(role), clean);
  }

  // ── A school's own roles ──────────────────────────────────────────────

  /** Every role this school made for itself. */
  listCustomRoles(schoolId: string) {
    return this.prisma.forTenant(schoolId, (tx) =>
      tx.customRole.findMany({ orderBy: { name: "asc" } }),
    );
  }

  createCustomRole(schoolId: string, name: string, description?: string) {
    return this.prisma.forTenant(schoolId, (tx) =>
      tx.customRole.create({
        data: { schoolId, name: name.trim(), description: description?.trim() || null },
      }),
    );
  }

  renameCustomRole(schoolId: string, id: string, name: string, description?: string) {
    return this.prisma.forTenant(schoolId, (tx) =>
      tx.customRole.update({
        where: { id },
        data: {
          name: name.trim(),
          ...(description === undefined ? {} : { description: description?.trim() || null }),
        },
      }),
    );
  }

  /**
   * Remove a role the school made.
   *
   * Anyone on it falls back to the built-in role their account still carries,
   * which is why that column was never replaced: deleting a role must leave
   * people able to sign in, not stranded on an id that no longer resolves.
   */
  async deleteCustomRole(schoolId: string, id: string) {
    return this.prisma.forTenant(schoolId, async (tx) => {
      const affected = await tx.user.count({ where: { customRoleId: id } });
      await tx.user.updateMany({
        where: { customRoleId: id },
        data: { customRoleId: null },
      });
      await tx.rolePermission.deleteMany({ where: { role: id } });
      await tx.customRole.delete({ where: { id } });
      return { success: true, usersMovedBack: affected };
    });
  }

  /** Drop the override so the role returns to the product default. */
  async clearOverride(schoolId: string, role: string): Promise<PermissionGrants> {
    await this.prisma.forTenant(schoolId, (tx) =>
      tx.rolePermission.deleteMany({ where: { role } }),
    );
    return this.defaultsFor(role);
  }
}

/** Keep only modules and actions the product actually has. */
function sanitise(grants: PermissionGrants): PermissionGrants {
  const out: PermissionGrants = {};
  for (const [module, actions] of Object.entries(grants ?? {})) {
    if (!ALL_MODULES.includes(module as PermissionModule)) continue;
    out[module as PermissionModule] = (actions ?? []).filter((a): a is PermissionAction =>
      ALL_ACTIONS.includes(a as PermissionAction),
    );
  }
  return out;
}

/**
 * Per module: the school's list when it has one, the default otherwise.
 *
 * Deliberately not a union. A school removing an action means it is gone —
 * merging the default back in would make "remove" impossible, which is the
 * "fallback access" the PRD names as the fault to avoid.
 */
export function mergeGrants(
  defaults: PermissionGrants,
  overrides: PermissionGrants | null,
): PermissionGrants {
  if (!overrides) return sanitise(defaults);
  const out: PermissionGrants = sanitise(defaults);
  for (const [module, actions] of Object.entries(sanitise(overrides))) {
    out[module as PermissionModule] = actions ?? [];
  }
  // An empty list is a revoke and is kept as one; the module simply grants
  // nothing, which every reader already treats as "not held".
  return out;
}
