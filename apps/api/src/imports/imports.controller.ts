import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Req,
} from "@nestjs/common";
import type { Request } from "express";
import { UserRole } from "@ekulmis/shared";
import { ImportsService } from "./imports.service";
import { Roles } from "../auth/roles.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/auth.types";

@Roles(UserRole.ADMINISTRATOR, UserRole.RECEPTION_OFFICER)
@Controller("imports")
export class ImportsController {
  constructor(private readonly imports: ImportsService) {}

  @Get()
  list(@CurrentUser() me: AuthUser) {
    return this.imports.listJobs(me.schoolId);
  }

  @Post("students")
  async importStudents(@CurrentUser() me: AuthUser, @Req() req: Request) {
    const body = req.body as { file?: string; classId?: string; sectionId?: string };
    if (!body?.file || !body.classId) {
      throw new BadRequestException("file (base64) and classId required");
    }
    const buf = Buffer.from(body.file, "base64");
    return this.imports.importStudents(
      me.schoolId,
      buf,
      body.classId,
      body.sectionId ?? null,
    );
  }
}
