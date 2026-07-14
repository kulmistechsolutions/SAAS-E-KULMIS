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
  Res,
} from "@nestjs/common";
import type { Response } from "express";
import {
  registerStudentSchema,
  updateStudentSchema,
  uploadStudentPhotoSchema,
  UserRole,
} from "@ekulmis/shared";
import { StudentsService } from "./students.service";
import { TeachersService } from "../teachers/teachers.service";
import { Roles } from "../auth/roles.decorator";
import { STAFF_ROLES } from "../auth/role-groups";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/auth.types";

// Staff-only by default (excludes PARENT/STUDENT). Mutation handlers below
// override this with the stricter @Roles(ADMINISTRATOR).
@Roles(...STAFF_ROLES)
@Controller("students")
export class StudentsController {
  constructor(
    private readonly students: StudentsService,
    private readonly teachers: TeachersService,
  ) {}

  private async assertTeacherCanAccessStudent(me: AuthUser, studentId: string) {
    if (me.role !== "TEACHER") return;
    const mine = await this.teachers.myStudents(me.schoolId, me.userId);
    if (!mine.some((s) => s.id === studentId)) {
      throw new ForbiddenException(
        "You can only access students in your assigned classes",
      );
    }
  }

  // Reception registers students at the front desk (matrix: students create).
  @Roles(UserRole.ADMINISTRATOR, UserRole.RECEPTION_OFFICER)
  @Post()
  register(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    const parsed = registerStudentSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.students.register(me.schoolId, parsed.data);
  }

  @Get()
  async findAll(
    @CurrentUser() me: AuthUser,
    @Query("classId") classId?: string,
    @Query("sectionId") sectionId?: string,
    @Query("status") status?: string,
    @Query("gender") gender?: string,
    @Query("lite") lite?: string,
  ) {
    if (me.role === "TEACHER") {
      let mine = await this.teachers.myStudents(me.schoolId, me.userId);
      if (classId) mine = mine.filter((s) => s.classId === classId);
      if (sectionId) mine = mine.filter((s) => s.sectionId === sectionId);
      if (status) mine = mine.filter((s) => s.status === status);
      if (gender) mine = mine.filter((s) => s.gender === gender);
      return mine;
    }
    return this.students.findAll(
      me.schoolId,
      {
        classId,
        sectionId,
        status,
        gender,
      },
      { includePhotoUrls: lite !== "1" },
    );
  }

  @Get(":id/attendance")
  async attendance(
    @CurrentUser() me: AuthUser,
    @Param("id") id: string,
    @Query("limit") limit?: string,
  ) {
    await this.assertTeacherCanAccessStudent(me, id);
    return this.students.attendanceHistory(
      me.schoolId,
      id,
      limit ? Number(limit) : 60,
    );
  }

  @Roles(UserRole.ADMINISTRATOR)
  @Post(":id/photo")
  async uploadPhoto(
    @CurrentUser() me: AuthUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const parsed = uploadStudentPhotoSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const buffer = Buffer.from(parsed.data.file, "base64");
    return this.students.uploadPhoto(
      me.schoolId,
      id,
      buffer,
      parsed.data.mimeType,
    );
  }

  @Get(":id/photo")
  async getPhoto(
    @CurrentUser() me: AuthUser,
    @Param("id") id: string,
    @Res() res: Response,
  ) {
    await this.assertTeacherCanAccessStudent(me, id);
    const { buffer, contentType } = await this.students.getPhoto(
      me.schoolId,
      id,
    );
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "private, max-age=300");
    res.send(buffer);
  }

  @Roles(UserRole.ADMINISTRATOR)
  @Delete(":id/photo")
  removePhoto(@CurrentUser() me: AuthUser, @Param("id") id: string) {
    return this.students.deletePhoto(me.schoolId, id);
  }

  @Get(":id")
  async findOne(@CurrentUser() me: AuthUser, @Param("id") id: string) {
    await this.assertTeacherCanAccessStudent(me, id);
    return this.students.findOne(me.schoolId, id);
  }

  // Reception updates student records (matrix: students update).
  @Roles(UserRole.ADMINISTRATOR, UserRole.RECEPTION_OFFICER)
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
