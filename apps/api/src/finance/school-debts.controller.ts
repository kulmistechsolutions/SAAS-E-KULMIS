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
  createDebtRepaymentSchema,
  createSchoolDebtSchema,
  updateSchoolDebtSchema,
  UserRole,
} from "@ekulmis/shared";
import { SchoolDebtsService } from "./school-debts.service";
import { AuditService } from "../audit/audit.service";
import { Roles } from "../auth/roles.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/auth.types";

/**
 * The school's own borrowing.
 *
 * Restricted to the two roles that carry the school's money. A debt and its
 * repayments are the school's obligations, not a student's, so this sits
 * beside expenses and salaries rather than anywhere near fee collection.
 */
@Roles(UserRole.ADMINISTRATOR, UserRole.FINANCE_OFFICER)
@Controller("school-debts")
export class SchoolDebtsController {
  constructor(
    private readonly debts: SchoolDebtsService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  list(@CurrentUser() me: AuthUser, @Query("status") status?: string) {
    return this.debts.list(me.schoolId, status);
  }

  /** Totals for the cards: borrowed, repaid, still owed. */
  @Get("summary")
  summary(@CurrentUser() me: AuthUser) {
    return this.debts.summary(me.schoolId);
  }

  @Get(":id")
  get(@CurrentUser() me: AuthUser, @Param("id") id: string) {
    return this.debts.get(me.schoolId, id);
  }

  @Post()
  async create(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    const parsed = createSchoolDebtSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const debt = await this.debts.create(me.schoolId, parsed.data, me.userId);
    await this.audit.record({
      schoolId: me.schoolId,
      userId: me.userId,
      username: me.username,
      role: me.role,
      module: "school-debts",
      action: "DEBT_RECORDED",
      metadata: {
        debtId: debt.id,
        lender: debt.lender,
        principal: debt.principal,
      },
    });
    return debt;
  }

  @Patch(":id")
  async update(
    @CurrentUser() me: AuthUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const parsed = updateSchoolDebtSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const debt = await this.debts.update(me.schoolId, id, parsed.data);
    await this.audit.record({
      schoolId: me.schoolId,
      userId: me.userId,
      username: me.username,
      role: me.role,
      module: "school-debts",
      action: "DEBT_UPDATED",
      metadata: { debtId: id, ...parsed.data },
    });
    return debt;
  }

  @Post(":id/repayments")
  async repay(
    @CurrentUser() me: AuthUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const parsed = createDebtRepaymentSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const repayment = await this.debts.repay(
      me.schoolId,
      id,
      parsed.data,
      me.userId,
    );
    await this.audit.record({
      schoolId: me.schoolId,
      userId: me.userId,
      username: me.username,
      role: me.role,
      module: "school-debts",
      action: "DEBT_REPAID",
      metadata: { debtId: id, repaymentId: repayment.id, amount: repayment.amount },
    });
    return repayment;
  }

  /** Remove a repayment that should not have been recorded. */
  @Roles(UserRole.ADMINISTRATOR)
  @Delete("repayments/:repaymentId")
  async removeRepayment(
    @CurrentUser() me: AuthUser,
    @Param("repaymentId") repaymentId: string,
  ) {
    const result = await this.debts.deleteRepayment(me.schoolId, repaymentId);
    await this.audit.record({
      schoolId: me.schoolId,
      userId: me.userId,
      username: me.username,
      role: me.role,
      module: "school-debts",
      action: "DEBT_REPAYMENT_DELETED",
      metadata: { repaymentId, debtId: result.debtId, amount: result.amount },
    });
    return result;
  }
}
