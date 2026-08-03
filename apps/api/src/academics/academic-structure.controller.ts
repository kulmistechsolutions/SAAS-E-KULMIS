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
  academicStructureSettingsSchema,
  cloneAcademicStructureSchema,
  createAcademicLevelSchema,
  createAcademicStageSchema,
  reorderSchema,
  updateAcademicLevelSchema,
  updateAcademicStageSchema,
  UserRole,
} from "@ekulmis/shared";
import { AcademicStructureService } from "./academic-structure.service";
import { Roles } from "../auth/roles.decorator";
import { STAFF_ROLES } from "../auth/role-groups";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/auth.types";

/**
 * The school-defined academic ladder. Reads are open to any signed-in staff
 * member because every class picker needs the grouping; writes are
 * administrator-only, like the rest of the academics module.
 */
@Controller("academic-structure")
export class AcademicStructureController {
  constructor(private readonly service: AcademicStructureService) {}

  @Roles(...STAFF_ROLES)
  @Get("settings")
  getSettings(@CurrentUser() me: AuthUser) {
    return this.service.getSettings(me.schoolId);
  }

  @Roles(UserRole.ADMINISTRATOR)
  @Patch("settings")
  updateSettings(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    const parsed = academicStructureSettingsSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.service.updateSettings(me.schoolId, parsed.data);
  }

  @Roles(...STAFF_ROLES)
  @Get("tree")
  tree(
    @CurrentUser() me: AuthUser,
    @Query("academicYearId") academicYearId?: string,
  ) {
    if (!academicYearId) {
      throw new BadRequestException("academicYearId is required");
    }
    return this.service.findTree(me.schoolId, academicYearId);
  }

  // ── Levels ──
  @Roles(UserRole.ADMINISTRATOR)
  @Post("levels")
  createLevel(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    const parsed = createAcademicLevelSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.service.createLevel(me.schoolId, parsed.data);
  }

  @Roles(UserRole.ADMINISTRATOR)
  @Patch("levels/:id")
  updateLevel(
    @CurrentUser() me: AuthUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const parsed = updateAcademicLevelSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.service.updateLevel(me.schoolId, id, parsed.data);
  }

  @Roles(UserRole.ADMINISTRATOR)
  @Delete("levels/:id")
  removeLevel(@CurrentUser() me: AuthUser, @Param("id") id: string) {
    return this.service.removeLevel(me.schoolId, id);
  }

  // ── Stages ──
  @Roles(UserRole.ADMINISTRATOR)
  @Post("stages")
  createStage(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    const parsed = createAcademicStageSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.service.createStage(me.schoolId, parsed.data);
  }

  @Roles(UserRole.ADMINISTRATOR)
  @Patch("stages/:id")
  updateStage(
    @CurrentUser() me: AuthUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const parsed = updateAcademicStageSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.service.updateStage(me.schoolId, id, parsed.data);
  }

  @Roles(UserRole.ADMINISTRATOR)
  @Delete("stages/:id")
  removeStage(@CurrentUser() me: AuthUser, @Param("id") id: string) {
    return this.service.removeStage(me.schoolId, id);
  }

  /// Position in `ids` becomes orderIndex, which is what promotion walks.
  @Roles(UserRole.ADMINISTRATOR)
  @Post("reorder/:entity")
  reorder(
    @CurrentUser() me: AuthUser,
    @Param("entity") entity: string,
    @Body() body: unknown,
  ) {
    if (entity !== "level" && entity !== "stage" && entity !== "class") {
      throw new BadRequestException("Reorder level, stage or class");
    }
    const parsed = reorderSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.service.reorder(me.schoolId, entity, parsed.data);
  }

  @Roles(UserRole.ADMINISTRATOR)
  @Post("clone")
  clone(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    const parsed = cloneAcademicStructureSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.service.clone(me.schoolId, parsed.data);
  }
}
