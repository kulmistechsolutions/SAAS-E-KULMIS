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
  createSalarySchema,
  updateSalarySchema,
  UserRole,
} from "@ekulmis/shared";
import { SalariesService } from "./salaries.service";
import { Roles } from "../auth/roles.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/auth.types";

@Roles(UserRole.ADMINISTRATOR, UserRole.FINANCE_OFFICER)
@Controller("salaries")
export class SalariesController {
  constructor(private readonly salaries: SalariesService) {}

  @Post()
  create(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    const parsed = createSalarySchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.salaries.create(me.schoolId, parsed.data);
  }

  @Get()
  findAll(
    @CurrentUser() me: AuthUser,
    @Query("year") year?: string,
    @Query("month") month?: string,
  ) {
    return this.salaries.findAll(
      me.schoolId,
      year ? Number(year) : undefined,
      month ? Number(month) : undefined,
    );
  }

  @Patch(":id")
  update(
    @CurrentUser() me: AuthUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const parsed = updateSalarySchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.salaries.update(me.schoolId, id, parsed.data);
  }

  @Delete(":id")
  remove(@CurrentUser() me: AuthUser, @Param("id") id: string) {
    return this.salaries.remove(me.schoolId, id);
  }
}
