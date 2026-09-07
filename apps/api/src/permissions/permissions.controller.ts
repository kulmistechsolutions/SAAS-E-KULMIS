import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Put,
} from "@nestjs/common";
import { UserRole } from "@ekulmis/shared";
import { PermissionsService, type PermissionGrants } from "./permissions.service";
import { AuditService } from "../audit/audit.service";
import { Roles } from "../auth/roles.decorator";
import { STAFF_ROLES } from "../auth/role-groups";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/auth.types";

/**
 * What roles may do, read and written from the server.
 *
 * The Roles & Permissions screen used to keep this in the browser. Anything
 * the server does not hold, the server cannot enforce — so an override was
 * never more than a picture of one.
 */
@Controller("permissions")
export class PermissionsController {
  constructor(
    private readonly permissions: PermissionsService,
    private readonly audit: AuditService,
  ) {}

  /**
   * The signed-in user's own effective permissions.
   *
   * Every staff role may read this — it is the answer to "what may I do",
   * which is not a secret from the person it describes, and every screen
   * needs it before it can decide what to draw.
   */
  @Roles(...STAFF_ROLES)
  @Get("me")
  async me(@CurrentUser() me: AuthUser) {
    return {
      role: me.role,
      permissions: await this.permissions.effectiveFor(me.schoolId, me.role),
    };
  }

  /** Every role's effective permissions — the Roles & Permissions screen. */
  @Roles(UserRole.ADMINISTRATOR)
  @Get("roles")
  async roles(@CurrentUser() me: AuthUser) {
    return this.permissions.allEffective(me.schoolId);
  }

  /** What the product grants a role before this school changed anything. */
  @Roles(UserRole.ADMINISTRATOR)
  @Get("roles/:role/defaults")
  defaults(@Param("role") role: string) {
    return this.permissions.defaultsFor(role);
  }

  @Roles(UserRole.ADMINISTRATOR)
  @Put("roles/:role")
  async update(
    @CurrentUser() me: AuthUser,
    @Param("role") role: string,
    @Body() body: unknown,
  ) {
    const grants = (body as { permissions?: PermissionGrants })?.permissions;
    if (!grants || typeof grants !== "object") {
      throw new BadRequestException("permissions is required");
    }

    const before = await this.permissions.effectiveFor(me.schoolId, role);
    const after = await this.permissions.setOverride(
      me.schoolId,
      role,
      grants,
      me.userId,
    );

    // Which permissions actually moved, so the log answers "who took this
    // away" rather than only "somebody saved this page".
    const changed = diffGrants(before, after);
    await this.audit.record({
      schoolId: me.schoolId,
      userId: me.userId,
      username: me.username,
      role: me.role,
      module: "permissions",
      action: "ROLE_PERMISSIONS_CHANGED",
      metadata: { role, granted: changed.granted, revoked: changed.revoked },
    });
    return { role, permissions: after, changed };
  }

  /** Put a role back to the product default. */
  @Roles(UserRole.ADMINISTRATOR)
  @Delete("roles/:role")
  async reset(@CurrentUser() me: AuthUser, @Param("role") role: string) {
    const before = await this.permissions.effectiveFor(me.schoolId, role);
    const after = await this.permissions.clearOverride(me.schoolId, role);
    await this.audit.record({
      schoolId: me.schoolId,
      userId: me.userId,
      username: me.username,
      role: me.role,
      module: "permissions",
      action: "ROLE_PERMISSIONS_RESET",
      metadata: { role, ...diffGrants(before, after) },
    });
    return { role, permissions: after };
  }
}

/** The permissions added and removed between two grant sets, as "fees.update". */
export function diffGrants(
  before: PermissionGrants,
  after: PermissionGrants,
): { granted: string[]; revoked: string[] } {
  const flat = (g: PermissionGrants) =>
    new Set(
      Object.entries(g).flatMap(([m, actions]) =>
        (actions ?? []).map((a) => `${m}.${a}`),
      ),
    );
  const b = flat(before);
  const a = flat(after);
  return {
    granted: [...a].filter((p) => !b.has(p)).sort(),
    revoked: [...b].filter((p) => !a.has(p)).sort(),
  };
}
