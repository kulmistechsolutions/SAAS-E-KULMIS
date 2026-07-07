/** Platform (Super Admin) access-token payload. Carries NO schoolId — the
 * platform layer operates above all tenants. */
export interface PlatformJwtPayload {
  sub: string; // platformAdminId
  platform: true;
  username: string;
}

/** The authenticated platform admin attached to `req.platformAdmin`. */
export interface PlatformAdminCtx {
  adminId: string;
  username: string;
}
