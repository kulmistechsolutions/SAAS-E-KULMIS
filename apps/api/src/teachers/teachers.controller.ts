import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import {
  registerTeacherSchema,
  resetTeacherPasswordSchema,
  updateTeacherSchema,
  UserRole,
} from "@ekulmis/shared";
import { z } from "zod";
import { TeachersService } from "./teachers.service";
import { Roles } from "../auth/roles.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/auth.types";
import { RequirePermission } from "../auth/require-permission.decorator";

const updateSelfSchema = z
  .object({
    phone: z.string().nullable().optional(),
    email: z.string().email().nullable().optional(),
    address: z.string().nullable().optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: "Nothing to update" });

@Controller("teachers")
export class TeachersController {
  constructor(private readonly teachers: TeachersService) {}

  @Roles(UserRole.ADMINISTRATOR)
  @RequirePermission("teachers.create")
  @Post()
  register(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    const parsed = registerTeacherSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.teachers.register(me.schoolId, parsed.data);
  }

  /** Logged-in teacher's own profile + assignments. */
  @Roles(UserRole.TEACHER, UserRole.ADMINISTRATOR)
  @RequirePermission("teachers.view")
  @Get("me")
  me(@CurrentUser() me: AuthUser) {
    if (me.role === "TEACHER") {
      return this.teachers.findByUserId(me.schoolId, me.userId);
    }
    throw new ForbiddenException(
      "Use GET /teachers/:id for administrator lookups",
    );
  }

  @Roles(UserRole.TEACHER)
  @RequirePermission("teachers.update")
  @Patch("me")
  updateMe(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    const parsed = updateSelfSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.teachers.updateSelf(me.schoolId, me.userId, parsed.data);
  }

  @Roles(UserRole.TEACHER)
  @RequirePermission("teachers.view")
  @Get("me/students")
  myStudents(@CurrentUser() me: AuthUser) {
    return this.teachers.myStudents(me.schoolId, me.userId);
  }

  // Reception (front-desk staff) and Academic Manager both manage the teacher
  // directory per the permission matrix, so they may list teachers too.
  @Roles(
    UserRole.ADMINISTRATOR,
    UserRole.RECEPTION_OFFICER,
    UserRole.ACADEMIC_MANAGER,
  )
  @RequirePermission("teachers.view")
  @Get()
  findAll(@CurrentUser() me: AuthUser, @Query("shift") shift?: string) {
    return this.teachers.findAll(me.schoolId, shift);
  }

  // Matches findAll above: only whoever manages the teacher directory can
  // look one up by id. (STAFF_ROLES was too broad here — Finance/Attendance
  // officers have no reason to read another staff member's profile.)
  @Roles(
    UserRole.ADMINISTRATOR,
    UserRole.RECEPTION_OFFICER,
    UserRole.ACADEMIC_MANAGER,
  )
  @RequirePermission("teachers.view")
  @Get(":id")
  findOne(@CurrentUser() me: AuthUser, @Param("id") id: string) {
    if (me.role === "TEACHER") {
      throw new ForbiddenException("Teachers may only access their own profile");
    }
    return this.teachers.findOne(me.schoolId, id);
  }

  @Roles(UserRole.ADMINISTRATOR)
  @RequirePermission("teachers.update")
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
  @RequirePermission("teachers.update")
  @Post(":id/reset-password")
  resetPassword(
    @CurrentUser() me: AuthUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const parsed = resetTeacherPasswordSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.teachers.resetPassword(me.schoolId, id, parsed.data.newPassword);
  }

  @Roles(UserRole.ADMINISTRATOR)
  @RequirePermission("teachers.delete")
  @Delete(":id")
  remove(@CurrentUser() me: AuthUser, @Param("id") id: string) {
    return this.teachers.remove(me.schoolId, id);
  }
}
