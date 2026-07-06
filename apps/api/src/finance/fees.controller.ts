import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import { chargeMonthSchema, payFeeSchema, UserRole } from "@ekulmis/shared";
import { FeesService } from "./fees.service";
import { Roles } from "../auth/roles.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/auth.types";

@Roles(UserRole.ADMINISTRATOR, UserRole.FINANCE_OFFICER)
@Controller("fees")
export class FeesController {
  constructor(private readonly fees: FeesService) {}

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
}
