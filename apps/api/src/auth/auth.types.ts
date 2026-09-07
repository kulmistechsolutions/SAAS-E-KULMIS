import type { UserRole } from "@ekulmis/shared";

/** Access-token payload. Carries tenant (`sid`) + role for RBAC. */
export interface JwtPayload {
  sub: string; // userId
  sid: string; // schoolId (tenant)
  role: UserRole;
  username: string;
  /**
   * The school's own role for this person, when it has put them on one.
   *
   * `role` stays as the nearest built-in so portal routing and the legacy
   * `@Roles` lists keep working; this is what the permission table is read
   * under. Absent for everybody on a built-in role, which is everybody today.
   */
  crid?: string;
}

/** The authenticated principal attached to `req.user` by JwtAuthGuard. */
export interface AuthUser {
  userId: string;
  schoolId: string;
  role: UserRole;
  username: string;
  /** The school's own role id, when they are on one. */
  customRoleId?: string;
  /**
   * Which key the permission table is read under — the custom role when there
   * is one, the built-in role otherwise. Every permission and scope lookup
   * uses this; nothing should reach for `role` to answer "may they".
   */
  permissionRole: string;
}
