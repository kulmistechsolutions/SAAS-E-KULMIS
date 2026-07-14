import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import { updateParentSchema, UserRole } from "@ekulmis/shared";
import { ParentsService } from "./parents.service";
import { Roles } from "../auth/roles.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/auth.types";

/**
 * Parent Management (Module 2). Parents are auto-created; details are editable.
 * Reception manages student guardians at the front desk (matrix: parents
 * view/create/update), so RECEPTION_OFFICER is permitted alongside admins.
 */
@Roles(UserRole.ADMINISTRATOR, UserRole.RECEPTION_OFFICER)
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

  @Patch(":id")
  update(
    @CurrentUser() me: AuthUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const parsed = updateParentSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.parents.update(me.schoolId, id, parsed.data);
  }

  /** Reset the parent's portal password (persisted) — returns the new one once. */
  @Post(":id/reset-password")
  resetPassword(@CurrentUser() me: AuthUser, @Param("id") id: string) {
    return this.parents.resetPassword(me.schoolId, id);
  }
}
