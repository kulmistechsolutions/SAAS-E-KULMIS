import { Controller, Get, Query } from "@nestjs/common";
import { UserRole } from "@ekulmis/shared";
import { AuditService } from "./audit.service";
import { Roles } from "../auth/roles.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/auth.types";

/** Audit log viewer (Module 18). Administrator-only, tenant-scoped. */
@Roles(UserRole.ADMINISTRATOR)
@Controller("audit")
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  list(
    @CurrentUser() me: AuthUser,
    @Query("skip") skip?: string,
    @Query("take") take?: string,
  ) {
    return this.audit.list(me.schoolId, {
      skip: skip ? Number(skip) : undefined,
      take: take ? Number(take) : undefined,
    });
  }
}
