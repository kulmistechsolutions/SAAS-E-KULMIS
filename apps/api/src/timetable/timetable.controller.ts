import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from "@nestjs/common";
import type { Response } from "express";
import {
  applyConstraintsSchema,
  assignShiftSchema,
  generateTimetableSchema,
  interpretConstraintSchema,
  saveShiftSchema,
  saveSubjectLoadsSchema,
  saveTeacherUnavailabilitySchema,
  UserRole,
} from "@ekulmis/shared";
import { TimetableSetupService } from "./timetable-setup.service";
import { TimetableGeneratorService } from "./timetable-generator.service";
import { TimetablePdfService } from "./timetable-pdf.service";
import { TimetableAiService } from "./timetable-ai.service";
import { Roles } from "../auth/roles.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/auth.types";

/** Timetable setup — the wizard behind the generator. Administrators only. */
@Roles(UserRole.ADMINISTRATOR)
@Controller("timetable")
export class TimetableController {
  constructor(
    private readonly setup: TimetableSetupService,
    private readonly generator: TimetableGeneratorService,
    private readonly pdf: TimetablePdfService,
    private readonly aiRules: TimetableAiService,
  ) {}

  // ── Shifts ───────────────────────────────────────────────────────────────

  @Get("shifts")
  listShifts(@CurrentUser() me: AuthUser, @Query("academicYearId") yearId: string) {
    if (!yearId) throw new BadRequestException("academicYearId is required");
    return this.setup.listShifts(me.schoolId, yearId);
  }

  @Post("shifts")
  createShift(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    const parsed = saveShiftSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.setup.saveShift(me.schoolId, parsed.data);
  }

  @Patch("shifts/:id")
  updateShift(
    @CurrentUser() me: AuthUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const parsed = saveShiftSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.setup.saveShift(me.schoolId, parsed.data, id);
  }

  @Delete("shifts/:id")
  deleteShift(@CurrentUser() me: AuthUser, @Param("id") id: string) {
    return this.setup.deleteShift(me.schoolId, id);
  }

  @Get("shifts/:id")
  describeShift(@CurrentUser() me: AuthUser, @Param("id") id: string) {
    return this.setup.describeShift(me.schoolId, id);
  }

  @Post("assign-shift")
  assignShift(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    const parsed = assignShiftSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.setup.assignShift(me.schoolId, parsed.data);
  }

  // ── Lesson allocation ────────────────────────────────────────────────────

  @Get("allocation")
  allocation(@CurrentUser() me: AuthUser, @Query("academicYearId") yearId: string) {
    if (!yearId) throw new BadRequestException("academicYearId is required");
    return this.setup.getAllocationGrid(me.schoolId, yearId);
  }

  @Patch("allocation")
  saveAllocation(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    const parsed = saveSubjectLoadsSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.setup.saveSubjectLoads(me.schoolId, parsed.data);
  }

  // ── Teacher unavailability ───────────────────────────────────────────────

  @Get("unavailability")
  listUnavailability(@CurrentUser() me: AuthUser) {
    return this.setup.listUnavailability(me.schoolId);
  }

  @Patch("unavailability")
  saveUnavailability(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    const parsed = saveTeacherUnavailabilitySchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.setup.saveUnavailability(me.schoolId, parsed.data);
  }

  // ── Feasibility ──────────────────────────────────────────────────────────

  @Get("feasibility")
  feasibility(@CurrentUser() me: AuthUser, @Query("academicYearId") yearId: string) {
    if (!yearId) throw new BadRequestException("academicYearId is required");
    return this.setup.checkFeasibility(me.schoolId, yearId);
  }

  // ── Typed rules ("Cali cannot teach on Monday") ──────────────────────────

  /**
   * Read-only: turns a sentence into proposed rules and shows them back. It
   * writes nothing, so a misunderstood sentence costs a click, not a week.
   */
  @Post("rules/interpret")
  interpretRule(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    const parsed = interpretConstraintSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.aiRules.interpret(me.schoolId, parsed.data);
  }

  /** Saves proposals the admin confirmed — structured, never the raw sentence. */
  @Post("rules/apply")
  applyRules(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    const parsed = applyConstraintsSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.aiRules.apply(me.schoolId, parsed.data);
  }

  @Get("rules")
  listRules(@CurrentUser() me: AuthUser, @Query("academicYearId") yearId: string) {
    if (!yearId) throw new BadRequestException("academicYearId is required");
    return this.aiRules.listRules(me.schoolId, yearId);
  }

  @Delete("rules/preferences/:id")
  deletePreference(@CurrentUser() me: AuthUser, @Param("id") id: string) {
    return this.aiRules.deletePreference(me.schoolId, id);
  }

  // ── Generated timetables ─────────────────────────────────────────────────

  @Get("generated")
  listGenerated(
    @CurrentUser() me: AuthUser,
    @Query("academicYearId") yearId: string,
  ) {
    if (!yearId) throw new BadRequestException("academicYearId is required");
    return this.generator.list(me.schoolId, yearId);
  }

  @Get("generated/:id")
  getGenerated(@CurrentUser() me: AuthUser, @Param("id") id: string) {
    return this.generator.get(me.schoolId, id);
  }

  @Post("generate")
  generate(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    const parsed = generateTimetableSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.generator.generate(
      me.schoolId,
      parsed.data.academicYearId,
      parsed.data.shiftId,
    );
  }

  @Post("generated/:id/publish")
  publish(@CurrentUser() me: AuthUser, @Param("id") id: string) {
    return this.generator.publish(me.schoolId, id);
  }

  @Delete("generated/:id")
  removeGenerated(@CurrentUser() me: AuthUser, @Param("id") id: string) {
    return this.generator.remove(me.schoolId, id);
  }

  /** Printable timetable: summary sheet, class grids, then teacher grids. */
  @Get("generated/:id/pdf")
  @Header("Content-Type", "application/pdf")
  async exportPdf(
    @CurrentUser() me: AuthUser,
    @Param("id") id: string,
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.pdf.build(me.schoolId, id);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
  }
}
