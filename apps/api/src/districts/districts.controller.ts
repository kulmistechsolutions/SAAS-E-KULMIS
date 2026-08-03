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
  createDistrictSchema,
  updateDistrictSchema,
  UserRole,
} from "@ekulmis/shared";
import { DistrictsService } from "./districts.service";
import { Roles } from "../auth/roles.decorator";
import { STAFF_ROLES } from "../auth/role-groups";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/auth.types";

/** Reads open to any signed-in staff member — the student form needs the list; writes are administrator-only, like the rest of the academics module. */
@Roles(...STAFF_ROLES)
@Controller("districts")
export class DistrictsController {
  constructor(private readonly service: DistrictsService) {}

  @Get()
  findAll(
    @CurrentUser() me: AuthUser,
    @Query("includeInactive") includeInactive?: string,
  ) {
    return this.service.findAll(me.schoolId, {
      includeInactive: includeInactive === "true",
    });
  }

  @Roles(UserRole.ADMINISTRATOR)
  @Post()
  create(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    const parsed = createDistrictSchema.safeParse(body);
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
    const parsed = updateDistrictSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.service.update(me.schoolId, id, parsed.data);
  }

  @Roles(UserRole.ADMINISTRATOR)
  @Delete(":id")
  remove(@CurrentUser() me: AuthUser, @Param("id") id: string) {
    return this.service.remove(me.schoolId, id);
  }
}
