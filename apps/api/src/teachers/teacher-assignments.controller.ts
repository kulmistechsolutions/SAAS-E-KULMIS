import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import {
  bulkCreateAssignmentsSchema,
  createAssignmentSchema,
  UserRole,
} from "@ekulmis/shared";
import { TeacherAssignmentsService } from "./teacher-assignments.service";
import { TeachersService } from "./teachers.service";
import { Roles } from "../auth/roles.decorator";
import { STAFF_ROLES } from "../auth/role-groups";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/auth.types";

// Staff-only reads by default; mutation handlers override with ADMINISTRATOR.
@Roles(...STAFF_ROLES)
@Controller("teacher-assignments")
export class TeacherAssignmentsController {
  constructor(
    private readonly assignments: TeacherAssignmentsService,
    private readonly teachers: TeachersService,
  ) {}

  @Roles(UserRole.ADMINISTRATOR)
  @Post()
  create(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    const parsed = createAssignmentSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.assignments.create(me.schoolId, parsed.data);
  }

  @Roles(UserRole.ADMINISTRATOR)
  @Post("bulk")
  createBulk(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    const parsed = bulkCreateAssignmentsSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.assignments.createBulk(me.schoolId, parsed.data);
  }

  @Get()
  async findAll(
    @CurrentUser() me: AuthUser,
    @Query("teacherId") teacherId?: string,
    @Query("classId") classId?: string,
    @Query("academicYearId") academicYearId?: string,
  ) {
    if (me.role === "TEACHER") {
      const teacher = await this.teachers.findByUserId(me.schoolId, me.userId);
      if (teacherId && teacherId !== teacher.id) {
        throw new ForbiddenException(
          "Teachers may only view their own assignments",
        );
      }
      return this.assignments.findAll(me.schoolId, {
        teacherId: teacher.id,
        classId,
        academicYearId,
      });
    }
    return this.assignments.findAll(me.schoolId, {
      teacherId,
      classId,
      academicYearId,
    });
  }

  @Get(":id")
  async findOne(@CurrentUser() me: AuthUser, @Param("id") id: string) {
    const row = await this.assignments.findOne(me.schoolId, id);
    if (me.role === "TEACHER") {
      const teacher = await this.teachers.findByUserId(me.schoolId, me.userId);
      if (row.teacherId !== teacher.id) {
        throw new ForbiddenException(
          "Teachers may only view their own assignments",
        );
      }
    }
    return row;
  }

  @Roles(UserRole.ADMINISTRATOR)
  @Delete(":id")
  remove(@CurrentUser() me: AuthUser, @Param("id") id: string) {
    return this.assignments.remove(me.schoolId, id);
  }
}
