import { BadRequestException, Body, Controller, Get, Post, Query } from "@nestjs/common";
import { promoteClassSchema, promoteSchoolWideSchema, promoteStudentSchema, UserRole } from "@ekulmis/shared";
import { PromotionsService } from "./promotions.service";
import { Roles } from "../auth/roles.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/auth.types";

// Promotions are staff-only (admin + academic manager). Portal roles
// (PARENT/STUDENT) must not see the graduated/history lists.
@Roles(UserRole.ADMINISTRATOR, UserRole.ACADEMIC_MANAGER)
@Controller("promotions")
export class PromotionsController {
  constructor(private readonly promotions: PromotionsService) {}

  @Get("history")
  history(
    @CurrentUser() me: AuthUser,
    @Query("academicYearId") academicYearId?: string,
  ) {
    return this.promotions.history(me.schoolId, academicYearId);
  }

  @Get("graduated")
  graduated(@CurrentUser() me: AuthUser) {
    return this.promotions.graduated(me.schoolId);
  }

  @Roles(UserRole.ADMINISTRATOR, UserRole.ACADEMIC_MANAGER)
  @Post("student")
  promoteStudent(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    const parsed = promoteStudentSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.promotions.promoteStudent(me.schoolId, parsed.data, me.userId);
  }

  @Roles(UserRole.ADMINISTRATOR, UserRole.ACADEMIC_MANAGER)
  @Post("class")
  promoteClass(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    const parsed = promoteClassSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.promotions.promoteClass(me.schoolId, parsed.data, me.userId);
  }

  @Roles(UserRole.ADMINISTRATOR)
  @Post("school-wide")
  promoteSchoolWide(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    const parsed = promoteSchoolWideSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.promotions.promoteSchoolWide(me.schoolId, parsed.data, me.userId);
  }
}
