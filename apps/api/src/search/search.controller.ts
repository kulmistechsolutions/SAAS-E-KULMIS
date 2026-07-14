import { Controller, Get, Query } from "@nestjs/common";
import { SearchService } from "./search.service";
import { Roles } from "../auth/roles.decorator";
import { STAFF_ROLES } from "../auth/role-groups";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/auth.types";

// Global search spans students/teachers/parents — staff only (no portal roles).
@Roles(...STAFF_ROLES)
@Controller("search")
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get()
  searchAll(
    @CurrentUser() me: AuthUser,
    @Query("q") q = "",
    @Query("type") type?: string,
    @Query("limit") limit?: string,
  ) {
    return this.search.search(me.schoolId, q, {
      types: type ? [type] : undefined,
      limit: limit ? Number(limit) : 20,
    });
  }
}
