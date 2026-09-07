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
  createEmployeeSchema,
  updateEmployeeSchema,
  UserRole,
} from "@ekulmis/shared";
import { EmployeesService } from "./employees.service";
import { Roles } from "../auth/roles.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/auth.types";
import { RequirePermission } from "../auth/require-permission.decorator";

@Roles(UserRole.ADMINISTRATOR, UserRole.FINANCE_OFFICER)
@Controller("employees")
export class EmployeesController {
  constructor(private readonly employees: EmployeesService) {}

  @RequirePermission("salaries.create")
  @Post()
  create(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    const parsed = createEmployeeSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.employees.create(me.schoolId, parsed.data);
  }

  @RequirePermission("salaries.view")
  @Get()
  findAll(@CurrentUser() me: AuthUser) {
    return this.employees.findAll(me.schoolId);
  }

  @RequirePermission("salaries.update")
  @Patch(":id")
  update(
    @CurrentUser() me: AuthUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const parsed = updateEmployeeSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.employees.update(me.schoolId, id, parsed.data);
  }

  @RequirePermission("salaries.delete")
  @Delete(":id")
  remove(@CurrentUser() me: AuthUser, @Param("id") id: string) {
    return this.employees.remove(me.schoolId, id);
  }
}
