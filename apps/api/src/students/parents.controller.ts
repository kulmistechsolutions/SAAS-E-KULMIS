import { Controller, Get, Param } from "@nestjs/common";
import { UserRole } from "@ekulmis/shared";
import { ParentsService } from "./parents.service";
import { Roles } from "../auth/roles.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/auth.types";

/** Parent Management (Module 2). Read-only here — parents are auto-created. */
@Roles(UserRole.ADMINISTRATOR)
@Controller("parents")
export class ParentsController {
  constructor(private readonly parents: ParentsService) {}

  @Get()
  findAll(@CurrentUser() me: AuthUser) {
    return this.parents.findAll(me.schoolId);
  }

  @Get(":id")
  findOne(@CurrentUser() me: AuthUser, @Param("id") id: string) {
    return this.parents.findOne(me.schoolId, id);
  }
}
