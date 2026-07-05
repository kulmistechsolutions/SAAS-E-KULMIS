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
  createAcademicYearSchema,
  updateAcademicYearSchema,
  UserRole,
} from "@ekulmis/shared";
import { AcademicYearService } from "./academic-year.service";
import { Roles } from "../auth/roles.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/auth.types";

@Controller("academic-years")
export class AcademicYearController {
  constructor(private readonly service: AcademicYearService) {}

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
    const parsed = createAcademicYearSchema.safeParse(body);
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
    const parsed = updateAcademicYearSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.service.update(me.schoolId, id, parsed.data);
  }

  @Roles(UserRole.ADMINISTRATOR)
  @Post(":id/activate")
  activate(@CurrentUser() me: AuthUser, @Param("id") id: string) {
    return this.service.activate(me.schoolId, id);
  }

  @Roles(UserRole.ADMINISTRATOR)
  @Delete(":id")
  remove(@CurrentUser() me: AuthUser, @Param("id") id: string) {
    return this.service.remove(me.schoolId, id);
  }
}
