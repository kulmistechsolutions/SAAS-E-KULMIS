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
  createExpenseCategorySchema,
  createExpenseSchema,
  updateExpenseSchema,
  UserRole,
} from "@ekulmis/shared";
import { ExpensesService } from "./expenses.service";
import { Roles } from "../auth/roles.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/auth.types";
import { RequirePermission } from "../auth/require-permission.decorator";

@Roles(UserRole.ADMINISTRATOR, UserRole.FINANCE_OFFICER)
@Controller("expenses")
export class ExpensesController {
  constructor(private readonly expenses: ExpensesService) {}

  @RequirePermission("expenses.create")
  @Post("categories")
  createCategory(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    const parsed = createExpenseCategorySchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.expenses.createCategory(me.schoolId, parsed.data);
  }

  @RequirePermission("expenses.view")
  @Get("categories")
  listCategories(@CurrentUser() me: AuthUser) {
    return this.expenses.listCategories(me.schoolId);
  }

  @RequirePermission("expenses.delete")
  @Delete("categories/:id")
  removeCategory(@CurrentUser() me: AuthUser, @Param("id") id: string) {
    return this.expenses.removeCategory(me.schoolId, id);
  }

  @RequirePermission("expenses.create")
  @Post()
  create(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    const parsed = createExpenseSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.expenses.create(me.schoolId, parsed.data, me.userId);
  }

  @RequirePermission("expenses.view")
  @Get()
  findAll(@CurrentUser() me: AuthUser, @Query("categoryId") categoryId?: string) {
    return this.expenses.findAll(me.schoolId, categoryId);
  }

  @RequirePermission("expenses.update")
  @Patch(":id")
  update(
    @CurrentUser() me: AuthUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const parsed = updateExpenseSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.expenses.update(me.schoolId, id, parsed.data);
  }

  @RequirePermission("expenses.delete")
  @Delete(":id")
  remove(@CurrentUser() me: AuthUser, @Param("id") id: string) {
    return this.expenses.remove(me.schoolId, id);
  }
}
