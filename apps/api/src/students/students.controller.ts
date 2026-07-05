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
  registerStudentSchema,
  updateStudentSchema,
  UserRole,
} from "@ekulmis/shared";
import { StudentsService } from "./students.service";
import { Roles } from "../auth/roles.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/auth.types";

@Controller("students")
export class StudentsController {
  constructor(private readonly students: StudentsService) {}

  @Roles(UserRole.ADMINISTRATOR)
  @Post()
  register(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    const parsed = registerStudentSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.students.register(me.schoolId, parsed.data);
  }

  @Get()
  findAll(
    @CurrentUser() me: AuthUser,
    @Query("classId") classId?: string,
    @Query("sectionId") sectionId?: string,
    @Query("status") status?: string,
    @Query("gender") gender?: string,
  ) {
    return this.students.findAll(me.schoolId, {
      classId,
      sectionId,
      status,
      gender,
    });
  }

  @Get(":id")
  findOne(@CurrentUser() me: AuthUser, @Param("id") id: string) {
    return this.students.findOne(me.schoolId, id);
  }

  @Roles(UserRole.ADMINISTRATOR)
  @Patch(":id")
  update(
    @CurrentUser() me: AuthUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const parsed = updateStudentSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.students.update(me.schoolId, id, parsed.data);
  }

  @Roles(UserRole.ADMINISTRATOR)
  @Delete(":id")
  remove(@CurrentUser() me: AuthUser, @Param("id") id: string) {
    return this.students.remove(me.schoolId, id);
  }
}
