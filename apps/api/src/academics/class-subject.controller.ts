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
import { createClassSubjectSchema, UserRole } from "@ekulmis/shared";
import { ClassSubjectService } from "./class-subject.service";
import { Roles } from "../auth/roles.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/auth.types";

@Controller("class-subjects")
export class ClassSubjectController {
  constructor(private readonly service: ClassSubjectService) {}

  @Get()
  findAll(
    @CurrentUser() me: AuthUser,
    @Query("academicYearId") academicYearId?: string,
    @Query("classId") classId?: string,
  ) {
    return this.service.findAll(me.schoolId, { academicYearId, classId });
  }

  @Roles(UserRole.ADMINISTRATOR)
  @Post()
  create(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    const parsed = createClassSubjectSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.service.create(me.schoolId, parsed.data);
  }

  /** Exams and marks that already use this subject for the class. */
  @Roles(UserRole.ADMINISTRATOR)
  @Get("usage")
  usage(
    @CurrentUser() me: AuthUser,
    @Query("classId") classId: string,
    @Query("subjectId") subjectId: string,
  ) {
    if (!classId || !subjectId) throw new BadRequestException("classId and subjectId are required");
    return this.service.usage(me.schoolId, classId, subjectId);
  }

  @Roles(UserRole.ADMINISTRATOR)
  @Delete(":id")
  remove(
    @CurrentUser() me: AuthUser,
    @Param("id") id: string,
    @Query("alsoFromExams") alsoFromExams?: string,
  ) {
    return this.service.remove(me.schoolId, id, {
      alsoFromExams: alsoFromExams === "true",
      actor: { userId: me.userId, username: me.username, role: me.role },
    });
  }
}
