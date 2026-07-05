import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import {
  registerTeacherSchema,
  updateTeacherSchema,
  UserRole,
} from "@ekulmis/shared";
import { TeachersService } from "./teachers.service";
import { Roles } from "../auth/roles.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/auth.types";

@Controller("teachers")
export class TeachersController {
  constructor(private readonly teachers: TeachersService) {}

  @Roles(UserRole.ADMINISTRATOR)
  @Post()
  register(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    const parsed = registerTeacherSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.teachers.register(me.schoolId, parsed.data);
  }

  @Get()
  findAll(@CurrentUser() me: AuthUser, @Query("shift") shift?: string) {
    return this.teachers.findAll(me.schoolId, shift);
  }

  @Get(":id")
  findOne(@CurrentUser() me: AuthUser, @Param("id") id: string) {
    return this.teachers.findOne(me.schoolId, id);
  }

  @Roles(UserRole.ADMINISTRATOR)
  @Patch(":id")
  update(
    @CurrentUser() me: AuthUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const parsed = updateTeacherSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.teachers.update(me.schoolId, id, parsed.data);
  }

  @Roles(UserRole.ADMINISTRATOR)
  @Delete(":id")
  remove(@CurrentUser() me: AuthUser, @Param("id") id: string) {
    return this.teachers.remove(me.schoolId, id);
  }
}
