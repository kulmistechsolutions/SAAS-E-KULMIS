import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Post,
  Query,
  Res,
} from "@nestjs/common";
import type { Response } from "express";
import {
  marksTemplateSchema,
  UserRole,
  validateMarksSchema,
} from "@ekulmis/shared";
import { MarksImportService } from "./marks-import.service";
import { Roles } from "../auth/roles.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/auth.types";

/** Bulk exam-marks import. Administrators and exam managers. */
@Roles(UserRole.ADMINISTRATOR, UserRole.EXAM_MANAGER)
@Controller("marks-import")
export class MarksImportController {
  constructor(private readonly marks: MarksImportService) {}

  /** Exams that can be turned into a template, so the UI can offer a picker. */
  @Get("exams")
  exams(@CurrentUser() me: AuthUser, @Query("academicYearId") yearId: string) {
    if (!yearId) throw new BadRequestException("academicYearId is required");
    return this.marks.listImportableExams(me.schoolId, yearId);
  }

  /**
   * POST rather than GET because the exam list can be long, and a download is
   * driven from an authenticated fetch anyway.
   */
  @Post("template")
  @Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
  async template(
    @CurrentUser() me: AuthUser,
    @Body() body: unknown,
    @Res() res: Response,
  ) {
    const parsed = marksTemplateSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const { buffer, filename } = await this.marks.buildTemplate(
      me.schoolId,
      parsed.data.examIds,
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  /**
   * Read a filled-in workbook and report what would happen. Writes nothing —
   * the school sees every problem before anything touches a student's result.
   */
  @Post("validate")
  validate(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    const parsed = validateMarksSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    let file: Buffer;
    try {
      file = Buffer.from(parsed.data.file, "base64");
    } catch {
      throw new BadRequestException("The uploaded file could not be read.");
    }
    return this.marks.validate(me.schoolId, parsed.data.examIds, file);
  }
}
