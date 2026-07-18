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
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  adjustSmsCreditsSchema,
  assignSmsPackageSchema,
  createSmsPackageSchema,
  grantSmsGatewayLicenseSchema,
  testSmsConnectionSchema,
  testWaafiConnectionSchema,
  updateSmsGlobalConfigSchema,
  updateSmsPackageSchema,
  updateWaafiConfigSchema,
} from "@ekulmis/shared";
import { Public } from "../auth/public.decorator";
import { PlatformGuard } from "../platform/platform.guard";
import type { PlatformAdminCtx } from "../platform/platform.types";
import { SmsService } from "./sms.service";
import { SmsPaymentService } from "./sms-payment.service";

@Public()
@UseGuards(PlatformGuard)
@Controller("platform/sms")
export class PlatformSmsController {
  constructor(
    private readonly sms: SmsService,
    private readonly payments: SmsPaymentService,
  ) {}

  @Get("overview")
  overview() {
    return this.sms.platformOverview();
  }

  // ── SMS Settings / Hormuud connection ────────────────────────────────────

  @Get("config")
  getConfig() {
    return this.sms.getGlobalConfig();
  }

  @Get("connection-logs")
  connectionLogs(@Query("take") take?: string) {
    return this.sms.listConnectionLogs(take ? Number(take) : 50);
  }

  /**
   * Test Hormuud credentials. Prefer this over PATCH /config for saving
   * username/password — packages stay locked until verification succeeds.
   */
  @Post("test-connection")
  testConnection(
    @Body() body: unknown,
    @Req() req: { platformAdmin?: PlatformAdminCtx },
  ) {
    const parsed = testSmsConnectionSchema.safeParse(body ?? {});
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.sms.testConnection(parsed.data, req.platformAdmin?.adminId);
  }

  /** Toggle enable / default sender only — credentials via test-connection. */
  @Patch("config")
  updateConfig(
    @Body() body: unknown,
    @Req() req: { platformAdmin?: PlatformAdminCtx },
  ) {
    const parsed = updateSmsGlobalConfigSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.sms.updateGlobalConfig(parsed.data, req.platformAdmin?.adminId);
  }

  // ── Packages (locked until connection verified) ──────────────────────────

  @Get("packages")
  packages() {
    return this.sms.listPackages();
  }

  @Post("packages")
  createPackage(@Body() body: unknown) {
    const parsed = createSmsPackageSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.sms.createPackage(parsed.data);
  }

  @Patch("packages/:id")
  updatePackage(@Param("id") id: string, @Body() body: unknown) {
    const parsed = updateSmsPackageSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.sms.updatePackage(id, parsed.data);
  }

  @Post("packages/:id/activate")
  activate(@Param("id") id: string) {
    return this.sms.setPackageActive(id, true);
  }

  @Post("packages/:id/deactivate")
  deactivate(@Param("id") id: string) {
    return this.sms.setPackageActive(id, false);
  }

  @Delete("packages/:id")
  deletePackage(@Param("id") id: string) {
    return this.sms.deletePackage(id);
  }

  // ── WaafiPay gateway ─────────────────────────────────────────────────────

  @Get("waafi/config")
  waafiConfig() {
    return this.payments.getWaafiConfig();
  }

  @Post("waafi/test-connection")
  testWaafi(
    @Body() body: unknown,
    @Req() req: { platformAdmin?: PlatformAdminCtx },
  ) {
    const parsed = testWaafiConnectionSchema.safeParse(body ?? {});
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.payments.testWaafiConnection(
      parsed.data,
      req.platformAdmin?.adminId,
    );
  }

  @Patch("waafi/config")
  updateWaafi(@Body() body: unknown) {
    const parsed = updateWaafiConfigSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.payments.updateWaafiConfig(parsed.data);
  }

  @Get("payments")
  paymentOverview() {
    return this.payments.platformPaymentOverview();
  }

  @Post("payments/expire-stale")
  expireStale() {
    return this.payments.expireStaleOrders();
  }

  @Post("assign")
  assign(
    @Body() body: unknown,
    @Req() req: { platformAdmin?: PlatformAdminCtx },
  ) {
    const parsed = assignSmsPackageSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.sms.assignPackage(parsed.data, req.platformAdmin?.adminId);
  }

  // ── Own-gateway licences (paid add-on sold to schools) ──
  @Get("gateway-licenses")
  listGatewayLicenses() {
    return this.sms.listGatewayLicenses();
  }

  @Post("gateway-licenses")
  grantGatewayLicense(
    @Body() body: unknown,
    @Req() req: { platformAdmin?: PlatformAdminCtx },
  ) {
    const parsed = grantSmsGatewayLicenseSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.sms.grantGatewayLicense(parsed.data, req.platformAdmin?.adminId);
  }

  @Delete("gateway-licenses/:id")
  revokeGatewayLicense(@Param("id") id: string) {
    return this.sms.revokeGatewayLicense(id);
  }

  @Post("adjust")
  adjust(@Body() body: unknown) {
    const parsed = adjustSmsCreditsSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.sms.adjustCredits(
      parsed.data.schoolId,
      parsed.data.credits,
      parsed.data.description,
      parsed.data.purchaseId,
    );
  }

  @Get("messages")
  messages(
    @Query("schoolId") schoolId?: string,
    @Query("status") status?: string,
    @Query("q") q?: string,
  ) {
    return this.sms.platformMessages({ schoolId, status, q, take: 200 });
  }

  @Post("process-scheduled")
  processScheduled() {
    return this.sms.processScheduled();
  }
}
