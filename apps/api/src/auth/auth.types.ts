import type { UserRole } from "@ekulmis/shared";

/** Access-token payload. Carries tenant (`sid`) + role for RBAC. */
export interface JwtPayload {
  sub: string; // userId
  sid: string; // schoolId (tenant)
  role: UserRole;
  username: string;
}

/** The authenticated principal attached to `req.user` by JwtAuthGuard. */
export interface AuthUser {
  userId: string;
  schoolId: string;
  role: UserRole;
  username: string;
}
