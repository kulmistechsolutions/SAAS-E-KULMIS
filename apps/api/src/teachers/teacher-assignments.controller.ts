import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import { createAssignmentSchema, UserRole } from "@ekulmis/shared";
import { TeacherAssignmentsService } from "./teacher-assignments.service";
import { Roles } from "../auth/roles.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/auth.types";

@Controller("teacher-assignments")
export class TeacherAssignmentsController {
  constructor(private readonly assignments: TeacherAssignmentsService) {}

  @Roles(UserRole.ADMINISTRATOR)
  @Post()
  create(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    const parsed = createAssignmentSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.assignments.create(me.schoolId, parsed.data);
  }

  @Get()
  findAll(
    @CurrentUser() me: AuthUser,
    @Query("teacherId") teacherId?: string,
    @Query("classId") classId?: string,
    @Query("academicYearId") academicYearId?: string,
  ) {
    return this.assignments.findAll(me.schoolId, {
      teacherId,
      classId,
      academicYearId,
    });
  }

  @Get(":id")
  findOne(@CurrentUser() me: AuthUser, @Param("id") id: string) {
    return this.assignments.findOne(me.schoolId, id);
  }

  @Roles(UserRole.ADMINISTRATOR)
  @Delete(":id")
  remove(@CurrentUser() me: AuthUser, @Param("id") id: string) {
    return this.assignments.remove(me.schoolId, id);
  }
}
