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
  UseGuards,
} from "@nestjs/common";
import {
  assignSchoolSubscriptionSchema,
  createSubscriptionPlanSchema,
  purchaseSubscriptionPlanSchema,
  updateSubscriptionPlanSchema,
  UserRole,
} from "@ekulmis/shared";
import { SubscriptionsService } from "./subscriptions.service";
import { PlatformGuard } from "../platform/platform.guard";
import {
  PlatformRolesGuard,
  RequirePlatformRoles,
} from "../platform/platform-roles.guard";
import { Public } from "../auth/public.decorator";
import { Roles } from "../auth/roles.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import { CurrentPlatformAdmin } from "../platform/current-platform-admin.decorator";
import type { AuthUser } from "../auth/auth.types";
import type { PlatformAdminCtx } from "../platform/platform.types";

/**
 * Platform subscriptions.
 * Read: any authenticated platform admin (SUPER_ADMIN or OPERATOR).
 * Mutate: SUPER_ADMIN only.
 */
@Public()
@UseGuards(PlatformGuard, PlatformRolesGuard)
@Controller("platform/subscriptions")
export class PlatformSubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Get("dashboard")
  dashboard() {
    return this.subscriptions.getDashboard();
  }

  @Get("alerts")
  alerts() {
    return this.subscriptions.listExpiringAlerts();
  }

  @Get("history")
  history(
    @Query("search") search?: string,
    @Query("status") status?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    return this.subscriptions.listHistory({
      search,
      status,
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
    });
  }

  @Get("plans")
  listPlans() {
    return this.subscriptions.listPlans();
  }

  @RequirePlatformRoles("SUPER_ADMIN")
  @Post("plans")
  createPlan(
    @CurrentPlatformAdmin() admin: PlatformAdminCtx,
    @Body() body: unknown,
  ) {
    const parsed = createSubscriptionPlanSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.subscriptions.createPlan(parsed.data, {
      adminId: admin.adminId,
      username: admin.username,
    });
  }

  @RequirePlatformRoles("SUPER_ADMIN")
  @Patch("plans/:id")
  updatePlan(
    @CurrentPlatformAdmin() admin: PlatformAdminCtx,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const parsed = updateSubscriptionPlanSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.subscriptions.updatePlan(id, parsed.data, {
      adminId: admin.adminId,
      username: admin.username,
    });
  }

  @RequirePlatformRoles("SUPER_ADMIN")
  @Delete("plans/:id")
  deletePlan(
    @CurrentPlatformAdmin() admin: PlatformAdminCtx,
    @Param("id") id: string,
  ) {
    return this.subscriptions.deletePlan(id, {
      adminId: admin.adminId,
      username: admin.username,
    });
  }

  @Get("schools")
  listSchoolSubscriptions() {
    return this.subscriptions.listSchoolSubscriptions();
  }

  @Get("schools/:schoolId")
  schoolDetail(@Param("schoolId") schoolId: string) {
    return this.subscriptions.getSchoolSubscriptionDetail(schoolId);
  }

  @RequirePlatformRoles("SUPER_ADMIN")
  @Post("schools/:schoolId/assign")
  assign(
    @CurrentPlatformAdmin() admin: PlatformAdminCtx,
    @Param("schoolId") schoolId: string,
    @Body() body: unknown,
  ) {
    const parsed = assignSchoolSubscriptionSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.subscriptions.assignSubscription(schoolId, parsed.data, {
      adminId: admin.adminId,
      username: admin.username,
    });
  }

  @RequirePlatformRoles("SUPER_ADMIN")
  @Post("schools/:schoolId/cancel")
  cancel(
    @CurrentPlatformAdmin() admin: PlatformAdminCtx,
    @Param("schoolId") schoolId: string,
  ) {
    return this.subscriptions.cancelSubscription(schoolId, {
      adminId: admin.adminId,
      username: admin.username,
    });
  }

  @RequirePlatformRoles("SUPER_ADMIN")
  @Post("jobs/expire")
  runExpire() {
    return this.subscriptions.expireDueSubscriptions().then((expired) => ({
      expired,
    }));
  }

  @RequirePlatformRoles("SUPER_ADMIN")
  @Post("jobs/notify")
  runNotify() {
    return this.subscriptions.sendExpiryNotices().then((notices) => ({
      notices,
    }));
  }
}

/**
 * School Administrator: view the school's own subscription, browse plans,
 * and self-purchase/renew via WaafiPay (mirrors the SMS package flow).
 */
@Controller("subscriptions")
export class SubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Roles(UserRole.ADMINISTRATOR)
  @Get("me")
  getMine(@CurrentUser() me: AuthUser) {
    return this.subscriptions.getMySubscription(me.schoolId);
  }

  @Roles(UserRole.ADMINISTRATOR)
  @Get("plans")
  listPlans() {
    return this.subscriptions.listAvailablePlans();
  }

  @Roles(UserRole.ADMINISTRATOR)
  @Post("purchase")
  purchase(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    const parsed = purchaseSubscriptionPlanSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.subscriptions.initiateSubscriptionPurchase(
      me.schoolId,
      me.userId,
      parsed.data,
    );
  }

  @Roles(UserRole.ADMINISTRATOR)
  @Get("payments")
  listPayments(@CurrentUser() me: AuthUser) {
    return this.subscriptions.listSchoolSubscriptionOrders(me.schoolId);
  }

  @Roles(UserRole.ADMINISTRATOR)
  @Get("payments/:id")
  paymentReceipt(@CurrentUser() me: AuthUser, @Param("id") id: string) {
    return this.subscriptions.getSubscriptionOrderReceipt(me.schoolId, id);
  }

  @Roles(UserRole.ADMINISTRATOR)
  @Post("payments/:id/verify")
  verifyPayment(@CurrentUser() me: AuthUser, @Param("id") id: string) {
    return this.subscriptions.verifyAndActivateSubscriptionPayment(id, me.schoolId);
  }

  /** Waafi callbacks — public; activation still verifies with Waafi inquiry. */
  @Public()
  @Post("payments/waafi/callback/success")
  successCallback(@Body() body: Record<string, unknown>) {
    return this.subscriptions.handleSubscriptionCallback("success", body ?? {});
  }

  @Public()
  @Get("payments/waafi/callback/success")
  successCallbackGet(@Query() query: Record<string, unknown>) {
    return this.subscriptions.handleSubscriptionCallback("success", query ?? {});
  }

  @Public()
  @Post("payments/waafi/callback/failure")
  failureCallback(@Body() body: Record<string, unknown>) {
    return this.subscriptions.handleSubscriptionCallback("failure", body ?? {});
  }

  @Public()
  @Get("payments/waafi/callback/failure")
  failureCallbackGet(@Query() query: Record<string, unknown>) {
    return this.subscriptions.handleSubscriptionCallback("failure", query ?? {});
  }
}
