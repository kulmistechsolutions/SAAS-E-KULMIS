/** Platform (Super Admin) access-token payload. Carries NO schoolId — the
 * platform layer operates above all tenants. */
export type PlatformAdminRole = "SUPER_ADMIN" | "OPERATOR";

export interface PlatformJwtPayload {
  sub: string; // platformAdminId
  platform: true;
  username: string;
  role: PlatformAdminRole;
}

/** The authenticated platform admin attached to `req.platformAdmin`. */
export interface PlatformAdminCtx {
  adminId: string;
  username: string;
  role: PlatformAdminRole;
  name?: string;
}
