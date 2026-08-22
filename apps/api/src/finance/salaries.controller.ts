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
  paySalarySchema,
  reverseSalaryPaymentSchema,
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

  /** What deleting this payroll month would destroy — shown before confirming. */
  @Get("month/preview")
  monthPreview(
    @CurrentUser() me: AuthUser,
    @Query("year") year: string,
    @Query("month") month: string,
  ) {
    const { y, m } = parseYearMonth(year, month);
    return this.salaries.monthDeletionPreview(me.schoolId, y, m);
  }

  /** Danger Zone: delete a whole payroll month. `includePaid=true` is required
   *  to remove rows that already have money against them. */
  @Roles(UserRole.ADMINISTRATOR, UserRole.SUPER_ADMINISTRATOR)
  @Delete("month")
  removeMonth(
    @CurrentUser() me: AuthUser,
    @Query("year") year: string,
    @Query("month") month: string,
    @Query("includePaid") includePaid?: string,
  ) {
    const { y, m } = parseYearMonth(year, month);
    return this.salaries.removeMonth(me.schoolId, y, m, {
      includePaid: includePaid === "true",
    });
  }

  @Delete(":id")
  remove(@CurrentUser() me: AuthUser, @Param("id") id: string) {
    return this.salaries.remove(me.schoolId, id);
  }

  @Post(":id/pay")
  pay(
    @CurrentUser() me: AuthUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const parsed = paySalarySchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.salaries.pay(me.schoolId, id, parsed.data, me.userId);
  }

  @Get(":id/payments")
  payments(@CurrentUser() me: AuthUser, @Param("id") id: string) {
    return this.salaries.paymentsFor(me.schoolId, id);
  }

  @Post("payments/:paymentId/reverse")
  reversePayment(
    @CurrentUser() me: AuthUser,
    @Param("paymentId") paymentId: string,
    @Body() body: unknown,
  ) {
    const parsed = reverseSalaryPaymentSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.salaries.reversePayment(me.schoolId, paymentId, parsed.data.reason, {
      userId: me.userId,
      username: me.username,
      role: me.role,
    });
  }
}

/** Year/month come off the query string, so validate before they reach SQL. */
function parseYearMonth(year: string, month: string): { y: number; m: number } {
  const y = Number(year);
  const m = Number(month);
  if (!Number.isInteger(y) || y < 2000 || y > 2100) {
    throw new BadRequestException("year must be a 4-digit year");
  }
  if (!Number.isInteger(m) || m < 1 || m > 12) {
    throw new BadRequestException("month must be 1-12");
  }
  return { y, m };
}
