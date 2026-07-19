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
  assignShiftSchema,
  generateTimetableSchema,
  saveShiftSchema,
  saveSubjectLoadsSchema,
  saveTeacherUnavailabilitySchema,
  UserRole,
} from "@ekulmis/shared";
import { TimetableSetupService } from "./timetable-setup.service";
import { TimetableGeneratorService } from "./timetable-generator.service";
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
}
