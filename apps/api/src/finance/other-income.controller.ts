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
  createIncomeCategorySchema,
  createOtherIncomeSchema,
  updateOtherIncomeSchema,
  UserRole,
} from "@ekulmis/shared";
import { OtherIncomeService } from "./other-income.service";
import { Roles } from "../auth/roles.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/auth.types";

@Roles(UserRole.ADMINISTRATOR, UserRole.FINANCE_OFFICER)
@Controller("other-income")
export class OtherIncomeController {
  constructor(private readonly income: OtherIncomeService) {}

  @Post("categories")
  createCategory(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    const parsed = createIncomeCategorySchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.income.createCategory(me.schoolId, parsed.data);
  }

  @Get("categories")
  listCategories(@CurrentUser() me: AuthUser) {
    return this.income.listCategories(me.schoolId);
  }

  @Delete("categories/:id")
  removeCategory(@CurrentUser() me: AuthUser, @Param("id") id: string) {
    return this.income.removeCategory(me.schoolId, id);
  }

  @Get("summary")
  summary(@CurrentUser() me: AuthUser, @Query("month") month?: string) {
    return this.income.summary(me.schoolId, month);
  }

  @Post()
  create(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    const parsed = createOtherIncomeSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.income.create(me.schoolId, parsed.data, me.userId);
  }

  @Get()
  findAll(@CurrentUser() me: AuthUser, @Query("categoryId") categoryId?: string) {
    return this.income.findAll(me.schoolId, categoryId);
  }

  @Patch(":id")
  update(
    @CurrentUser() me: AuthUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const parsed = updateOtherIncomeSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.income.update(me.schoolId, id, parsed.data);
  }

  @Delete(":id")
  remove(@CurrentUser() me: AuthUser, @Param("id") id: string) {
    return this.income.remove(me.schoolId, id);
  }
}
