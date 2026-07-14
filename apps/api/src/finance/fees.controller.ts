import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import { chargeMonthSchema, payFeeSchema, setupAcademicYearFeesSchema, UserRole } from "@ekulmis/shared";
import { FeesService } from "./fees.service";
import { Roles } from "../auth/roles.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/auth.types";

@Roles(UserRole.ADMINISTRATOR, UserRole.FINANCE_OFFICER)
@Controller("fees")
export class FeesController {
  constructor(private readonly fees: FeesService) {}

  @Get("settings")
  settings(@CurrentUser() me: AuthUser) {
    return this.fees.getSettings(me.schoolId);
  }

  @Post("setup-academic-year")
  setupAcademicYear(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    const parsed = setupAcademicYearFeesSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.fees.setupAcademicYear(me.schoolId, parsed.data);
  }

  @Post("charge")
  charge(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    const parsed = chargeMonthSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.fees.chargeMonth(me.schoolId, parsed.data);
  }

  @Post("pay")
  pay(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    const parsed = payFeeSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.fees.pay(me.schoolId, parsed.data, me.userId);
  }

  @Get("ledger/:studentId")
  ledger(@CurrentUser() me: AuthUser, @Param("studentId") studentId: string) {
    return this.fees.ledger(me.schoolId, studentId);
  }

  @Get("outstanding")
  outstanding(
    @CurrentUser() me: AuthUser,
    @Query("classId") classId?: string,
    @Query("sectionId") sectionId?: string,
  ) {
    return this.fees.outstanding(me.schoolId, classId, sectionId);
  }

  @Get("payments")
  payments(@CurrentUser() me: AuthUser, @Query("limit") limit?: string) {
    return this.fees.listPayments(me.schoolId, limit ? Number(limit) : 100);
  }

  @Get("charges")
  charges(
    @CurrentUser() me: AuthUser,
    @Query("year") year?: string,
    @Query("month") month?: string,
  ) {
    return this.fees.listCharges(
      me.schoolId,
      year ? Number(year) : undefined,
      month ? Number(month) : undefined,
    );
  }
}
