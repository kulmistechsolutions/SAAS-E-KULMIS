import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  createSchoolSchema,
  resetPasswordSchema,
  updateSchoolSchema,
} from "@ekulmis/shared";
import { SchoolsService } from "./schools.service";
import { PlatformGuard } from "./platform.guard";
import { Public } from "../auth/public.decorator";

/** School (tenant) management — Super Admin only. */
@Public() // bypass the school JwtAuthGuard; PlatformGuard enforces platform auth
@UseGuards(PlatformGuard)
@Controller("platform/schools")
export class SchoolsController {
  constructor(private readonly schools: SchoolsService) {}

  @Get()
  findAll() {
    return this.schools.findAll();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.schools.findOne(id);
  }

  @Post()
  create(@Body() body: unknown) {
    const parsed = createSchoolSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.schools.create(parsed.data);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() body: unknown) {
    const parsed = updateSchoolSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.schools.update(id, parsed.data);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.schools.remove(id);
  }

  /** The school's staff logins — used to pick who to reset. */
  @Get(":id/users")
  listUsers(@Param("id") id: string) {
    return this.schools.listSchoolUsers(id);
  }

  /** Recover a locked-out school admin. Touches only the password. */
  @Post(":id/users/:userId/reset-password")
  resetUserPassword(
    @Param("id") id: string,
    @Param("userId") userId: string,
    @Body() body: unknown,
  ) {
    const parsed = resetPasswordSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.schools.resetSchoolUserPassword(id, userId, parsed.data.newPassword);
  }
}
