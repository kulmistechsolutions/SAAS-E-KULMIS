import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import { purchaseSmsPackageSchema, UserRole } from "@ekulmis/shared";
import { Roles } from "../auth/roles.decorator";
import { Public } from "../auth/public.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/auth.types";
import { SmsPaymentService } from "./sms-payment.service";

@Controller("sms/payments")
export class SmsPaymentController {
  constructor(private readonly payments: SmsPaymentService) {}

  /** Waafi HPP callbacks — public; activation still verifies with Waafi inquiry. */
  @Public()
  @Post("waafi/callback/success")
  successCallback(@Body() body: Record<string, unknown>) {
    return this.payments.handleCallback("success", body ?? {});
  }

  @Public()
  @Get("waafi/callback/success")
  successCallbackGet(@Query() query: Record<string, unknown>) {
    return this.payments.handleCallback("success", query ?? {});
  }

  @Public()
  @Post("waafi/callback/failure")
  failureCallback(@Body() body: Record<string, unknown>) {
    return this.payments.handleCallback("failure", body ?? {});
  }

  @Public()
  @Get("waafi/callback/failure")
  failureCallbackGet(@Query() query: Record<string, unknown>) {
    return this.payments.handleCallback("failure", query ?? {});
  }

  @Roles(UserRole.ADMINISTRATOR, UserRole.SUPER_ADMINISTRATOR, UserRole.FINANCE_OFFICER)
  @Post("purchase")
  purchase(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    const parsed = purchaseSmsPackageSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.payments.initiatePurchase(me.schoolId, me.userId, parsed.data);
  }

  @Roles(UserRole.ADMINISTRATOR, UserRole.SUPER_ADMINISTRATOR, UserRole.FINANCE_OFFICER)
  @Get()
  list(@CurrentUser() me: AuthUser) {
    return this.payments.listSchoolOrders(me.schoolId);
  }

  @Roles(UserRole.ADMINISTRATOR, UserRole.SUPER_ADMINISTRATOR, UserRole.FINANCE_OFFICER)
  @Post(":id/verify")
  verify(@CurrentUser() me: AuthUser, @Param("id") id: string) {
    return this.payments.verifyAndActivate(id, me.schoolId);
  }

  @Roles(UserRole.ADMINISTRATOR, UserRole.SUPER_ADMINISTRATOR, UserRole.FINANCE_OFFICER)
  @Get(":id")
  receipt(@CurrentUser() me: AuthUser, @Param("id") id: string) {
    return this.payments.getOrderReceipt(me.schoolId, id);
  }
}
