import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
} from "@nestjs/common";
import { UserRole } from "@ekulmis/shared";
import { SchoolResetService } from "./school-reset.service";
import { Roles } from "../auth/roles.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/auth.types";

/**
 * Danger Zone — deliberate resets, administrator only. Kept off the normal
 * student/class routes so it can never be reached by accident.
 */
@Roles(UserRole.ADMINISTRATOR)
@Controller("admin/reset")
export class SchoolResetController {
  constructor(private readonly reset: SchoolResetService) {}

  @Get("school/preview")
  previewSchool(@CurrentUser() me: AuthUser) {
    return this.reset.previewSchool(me.schoolId);
  }

  @Get("class/:classId/preview")
  previewClass(@CurrentUser() me: AuthUser, @Param("classId") classId: string) {
    return this.reset.previewClass(me.schoolId, classId);
  }

  @Post("school")
  resetSchool(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    const confirm = (body as { confirmName?: unknown } | null)?.confirmName;
    if (typeof confirm !== "string" || !confirm.trim()) {
      throw new BadRequestException(
        "confirmName is required — type the school name to confirm",
      );
    }
    return this.reset.resetSchool(me.schoolId, confirm);
  }

  @Post("class/:classId")
  resetClass(
    @CurrentUser() me: AuthUser,
    @Param("classId") classId: string,
    @Body() body: unknown,
  ) {
    const confirm = (body as { confirmName?: unknown } | null)?.confirmName;
    if (typeof confirm !== "string" || !confirm.trim()) {
      throw new BadRequestException(
        "confirmName is required — type the class name to confirm",
      );
    }
    return this.reset.resetClass(me.schoolId, classId, confirm);
  }
}
