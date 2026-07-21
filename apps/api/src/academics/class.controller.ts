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
  createClassSchema,
  updateClassSchema,
  UserRole,
} from "@ekulmis/shared";
import { ClassService } from "./class.service";
import { ClassPurgeService } from "./class-purge.service";
import { Roles } from "../auth/roles.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/auth.types";

@Controller("classes")
export class ClassController {
  constructor(
    private readonly service: ClassService,
    private readonly purgeService: ClassPurgeService,
  ) {}

  @Get()
  findAll(
    @CurrentUser() me: AuthUser,
    @Query("academicYearId") academicYearId?: string,
  ) {
    return this.service.findAll(me.schoolId, academicYearId);
  }

  @Roles(UserRole.ADMINISTRATOR)
  @Post("structure/repair")
  repairStructure(
    @CurrentUser() me: AuthUser,
    @Query("academicYearId") academicYearId?: string,
  ) {
    return this.service.repairStructure(me.schoolId, academicYearId);
  }

  @Get(":id")
  findOne(@CurrentUser() me: AuthUser, @Param("id") id: string) {
    return this.service.findOne(me.schoolId, id);
  }

  @Roles(UserRole.ADMINISTRATOR)
  @Post()
  create(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    const parsed = createClassSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.service.create(me.schoolId, parsed.data);
  }

  @Roles(UserRole.ADMINISTRATOR)
  @Patch(":id")
  update(
    @CurrentUser() me: AuthUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const parsed = updateClassSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.service.update(me.schoolId, id, parsed.data);
  }

  @Roles(UserRole.ADMINISTRATOR)
  @Delete(":id")
  remove(@CurrentUser() me: AuthUser, @Param("id") id: string) {
    return this.service.remove(me.schoolId, id);
  }

  /** What a full purge would destroy — shown before the admin confirms. */
  @Roles(UserRole.ADMINISTRATOR)
  @Get(":id/purge-preview")
  purgePreview(@CurrentUser() me: AuthUser, @Param("id") id: string) {
    return this.purgeService.preview(me.schoolId, id);
  }

  /** Erase the class, its students, and everything hanging off them. */
  @Roles(UserRole.ADMINISTRATOR)
  @Post(":id/purge")
  purge(
    @CurrentUser() me: AuthUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const confirm = (body as { confirmName?: unknown } | null)?.confirmName;
    if (typeof confirm !== "string" || !confirm.trim()) {
      throw new BadRequestException(
        "confirmName is required — type the class name to confirm",
      );
    }
    return this.purgeService.purge(me.schoolId, id, confirm);
  }
}
