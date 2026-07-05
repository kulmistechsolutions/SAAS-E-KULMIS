import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import {
  createSubjectSchema,
  updateSubjectSchema,
  UserRole,
} from "@ekulmis/shared";
import { SubjectService } from "./subject.service";
import { Roles } from "../auth/roles.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/auth.types";

@Controller("subjects")
export class SubjectController {
  constructor(private readonly service: SubjectService) {}

  @Get()
  findAll(@CurrentUser() me: AuthUser) {
    return this.service.findAll(me.schoolId);
  }

  @Get(":id")
  findOne(@CurrentUser() me: AuthUser, @Param("id") id: string) {
    return this.service.findOne(me.schoolId, id);
  }

  @Roles(UserRole.ADMINISTRATOR)
  @Post()
  create(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    const parsed = createSubjectSchema.safeParse(body);
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
    const parsed = updateSubjectSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.service.update(me.schoolId, id, parsed.data);
  }

  @Roles(UserRole.ADMINISTRATOR)
  @Delete(":id")
  remove(@CurrentUser() me: AuthUser, @Param("id") id: string) {
    return this.service.remove(me.schoolId, id);
  }
}
