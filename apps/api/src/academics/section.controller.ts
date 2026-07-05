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
  createSectionSchema,
  updateSectionSchema,
  UserRole,
} from "@ekulmis/shared";
import { SectionService } from "./section.service";
import { Roles } from "../auth/roles.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/auth.types";

@Controller("sections")
export class SectionController {
  constructor(private readonly service: SectionService) {}

  @Get()
  findAll(@CurrentUser() me: AuthUser, @Query("classId") classId?: string) {
    return this.service.findAll(me.schoolId, classId);
  }

  @Get(":id")
  findOne(@CurrentUser() me: AuthUser, @Param("id") id: string) {
    return this.service.findOne(me.schoolId, id);
  }

  @Roles(UserRole.ADMINISTRATOR)
  @Post()
  create(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    const parsed = createSectionSchema.safeParse(body);
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
    const parsed = updateSectionSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.service.update(me.schoolId, id, parsed.data);
  }

  @Roles(UserRole.ADMINISTRATOR)
  @Delete(":id")
  remove(@CurrentUser() me: AuthUser, @Param("id") id: string) {
    return this.service.remove(me.schoolId, id);
  }
}
