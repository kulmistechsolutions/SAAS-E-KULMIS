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
  /**
   * Present only on a token issued to renew a lapsed subscription.
   *
   * A school whose plan has expired cannot sign in — which also meant it
   * could not reach the screen that sells it a new one, and the only way back
   * was to telephone the platform owner. This token exists so it can pay, and
   * for nothing else: JwtAuthGuard refuses it on every route that has not
   * explicitly opted in with @BillingScope(). Deny by default, because the
   * alternative is a credential that quietly works somewhere nobody checked.
   */
  scope?: "BILLING";
  /**
   * The platform administrator who signed in to this school for support.
   *
   * Their username, so the school's screens can say whose session this is and
   * any future rule can refuse one. A support session is not a secret kept
   * from the customer.
   */
  imp?: string;
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
  /** Set when this request carries a renewal-only token. */
  scope?: "BILLING";
  /** The platform administrator signed in as this school, when one did. */
  impersonatedBy?: string;
}
