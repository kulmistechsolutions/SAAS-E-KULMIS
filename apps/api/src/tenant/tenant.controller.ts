import { Controller, Get } from "@nestjs/common";
import type { TenantContext } from "@ekulmis/shared";
import { CurrentTenant } from "./current-tenant.decorator";
import { Roles } from "../auth/roles.decorator";
import { STAFF_ROLES } from "../auth/role-groups";

@Controller("tenant")
export class TenantController {
  /**
   * Which school the request resolved to.
   *
   * This was a development probe — public, and returning the school's internal
   * id together with a count of its user accounts to anyone who knew the
   * subdomain. Nothing in the system ever called it. Knowing a school has
   * sixty-five accounts is not a way in, but it is a fact about a school that
   * an anonymous visitor has no business being told, and an account count is
   * the sort of thing somebody sizing up a target asks for first.
   *
   * What is left answers only the question the route's name asks, and only for
   * someone already signed in to that school.
   */
  @Roles(...STAFF_ROLES)
  @Get("me")
  me(@CurrentTenant() tenant: TenantContext) {
    return { tenant };
  }
}
