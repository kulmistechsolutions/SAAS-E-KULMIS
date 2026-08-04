import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import {
  ASSIGNABLE_STAFF_ROLES,
  createUserSchema,
  resetPasswordSchema,
  updateUserSchema,
  UserRole,
} from "@ekulmis/shared";
import { UsersService } from "./users.service";
import { Roles } from "../auth/roles.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/auth.types";

/** User Management (Module 15). Administrator-only, tenant-scoped. */
@Roles(UserRole.ADMINISTRATOR)
@Controller("users")
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Post()
  create(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    const parsed = createUserSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    if (!ASSIGNABLE_STAFF_ROLES.includes(parsed.data.role)) {
      throw new BadRequestException(
        "This role cannot be assigned through User Management.",
      );
    }
    return this.users.create(me.schoolId, parsed.data);
  }

  @Get()
  findAll(@CurrentUser() me: AuthUser) {
    return this.users.findAll(me.schoolId);
  }

  @Get(":id")
  findOne(@CurrentUser() me: AuthUser, @Param("id") id: string) {
    return this.users.findOne(me.schoolId, id);
  }

  @Patch(":id")
  update(
    @CurrentUser() me: AuthUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const parsed = updateUserSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    if (
      parsed.data.role !== undefined &&
      !ASSIGNABLE_STAFF_ROLES.includes(parsed.data.role)
    ) {
      throw new BadRequestException(
        "This role cannot be assigned through User Management.",
      );
    }
    return this.users.update(me.schoolId, id, parsed.data);
  }

  @Post(":id/reset-password")
  resetPassword(
    @CurrentUser() me: AuthUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const parsed = resetPasswordSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.users.resetPassword(me.schoolId, id, parsed.data.newPassword);
  }

  @Delete(":id")
  remove(@CurrentUser() me: AuthUser, @Param("id") id: string) {
    if (id === me.userId) {
      throw new BadRequestException("You cannot delete your own account");
    }
    return this.users.remove(me.schoolId, id);
  }
}
