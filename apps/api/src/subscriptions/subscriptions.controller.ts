import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  assignSchoolSubscriptionSchema,
  createSubscriptionPlanSchema,
  updateSubscriptionPlanSchema,
  UserRole,
} from "@ekulmis/shared";
import { SubscriptionsService } from "./subscriptions.service";
import { PlatformGuard } from "../platform/platform.guard";
import { Public } from "../auth/public.decorator";
import { Roles } from "../auth/roles.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/auth.types";

/** Super Admin: subscription plan catalog + per-school assignment. */
@Public() // bypass the school JwtAuthGuard; PlatformGuard enforces platform auth
@UseGuards(PlatformGuard)
@Controller("platform/subscriptions")
export class PlatformSubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Get("plans")
  listPlans() {
    return this.subscriptions.listPlans();
  }

  @Post("plans")
  createPlan(@Body() body: unknown) {
    const parsed = createSubscriptionPlanSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.subscriptions.createPlan(parsed.data);
  }

  @Patch("plans/:id")
  updatePlan(@Param("id") id: string, @Body() body: unknown) {
    const parsed = updateSubscriptionPlanSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.subscriptions.updatePlan(id, parsed.data);
  }

  @Delete("plans/:id")
  deletePlan(@Param("id") id: string) {
    return this.subscriptions.deletePlan(id);
  }

  @Get("schools")
  listSchoolSubscriptions() {
    return this.subscriptions.listSchoolSubscriptions();
  }

  @Post("schools/:schoolId/assign")
  assign(@Param("schoolId") schoolId: string, @Body() body: unknown) {
    const parsed = assignSchoolSubscriptionSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.subscriptions.assignSubscription(schoolId, parsed.data);
  }

  @Post("schools/:schoolId/cancel")
  cancel(@Param("schoolId") schoolId: string) {
    return this.subscriptions.cancelSubscription(schoolId);
  }
}

/** School Administrator: read-only view of the school's own subscription. */
@Controller("subscriptions")
export class SubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Roles(UserRole.ADMINISTRATOR)
  @Get("me")
  getMine(@CurrentUser() me: AuthUser) {
    return this.subscriptions.getMySubscription(me.schoolId);
  }
}
