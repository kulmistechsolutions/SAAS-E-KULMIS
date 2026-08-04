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
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";
import {
  adjustSmsCreditsSchema,
  assignSmsPackageSchema,
  createSmsPackageSchema,
  grantSmsGatewayLicenseSchema,
  reviewSmsSenderIdSchema,
  schoolSmsGatewaySchema,
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
import { SmsSenderIdService } from "./sms-sender-id.service";
import { senderIdFeatureEnabled } from "./sender-id-feature";

@Public()
@UseGuards(PlatformGuard)
@Controller("platform/sms")
export class PlatformSmsController {
  constructor(
    private readonly sms: SmsService,
    private readonly payments: SmsPaymentService,
    private readonly senderIds: SmsSenderIdService,
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
    return this.sms.grantGatewayLicense(
      parsed.data,
      req.platformAdmin?.adminId,
    );
  }

  @Delete("gateway-licenses/:id")
  revokeGatewayLicense(@Param("id") id: string) {
    return this.sms.revokeGatewayLicense(id);
  }

  // ── A school's own gateway credentials ──
  // A school can only view its own gateway status (GET /sms/gateway on the
  // tenant side) — entering, testing and switching on the actual Hormuud
  // account is done here, by whoever holds the platform login, on the
  // school's behalf.
  @Get("gateway-licenses/:schoolId/gateway")
  schoolGateway(@Param("schoolId") schoolId: string) {
    return this.sms.getSchoolGateway(schoolId);
  }

  @Post("gateway-licenses/:schoolId/gateway/test")
  testSchoolGateway(@Param("schoolId") schoolId: string, @Body() body: unknown) {
    const parsed = schoolSmsGatewaySchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.sms.testSchoolGateway(schoolId, parsed.data);
  }

  @Patch("gateway-licenses/:schoolId/gateway")
  toggleSchoolGateway(
    @Param("schoolId") schoolId: string,
    @Body() body: { enabled?: boolean },
  ) {
    if (typeof body?.enabled !== "boolean") {
      throw new BadRequestException("enabled must be true or false");
    }
    return this.sms.setSchoolGatewayEnabled(schoolId, body.enabled);
  }

  // ── Sender ID applications ──
  // A school applies for the name recipients see; only the platform owner,
  // who registers it with the operator, can grant it.

  @Get("sender-id-requests")
  async listSenderIdRequests(@Query("status") status?: string) {
    // `featureEnabled: false` warns the reviewer that granting a name will
    // not change what recipients see — the sending path is ignoring school
    // names entirely. Approving into that silently is how the wrong name went
    // live in the first place.
    return {
      featureEnabled: senderIdFeatureEnabled(),
      requests: await this.senderIds.listRequests(status),
    };
  }

  /** The school's licence document, for the reviewer to read. */
  @Get("sender-id-requests/:id/document")
  async senderIdDocument(@Param("id") id: string, @Res() res: Response) {
    const doc = await this.senderIds.requestDocument(id);
    res.setHeader("Content-Type", doc.contentType);
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${doc.filename.replace(/"/g, "")}"`,
    );
    res.send(doc.buffer);
  }

  @Post("sender-id-requests/:id/approve")
  approveSenderId(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() req: { platformAdmin?: PlatformAdminCtx },
  ) {
    const parsed = reviewSmsSenderIdSchema.safeParse(body ?? {});
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.senderIds.approve(
      id,
      parsed.data,
      req.platformAdmin?.username ?? "platform",
    );
  }

  @Post("sender-id-requests/:id/reject")
  rejectSenderId(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() req: { platformAdmin?: PlatformAdminCtx },
  ) {
    const parsed = reviewSmsSenderIdSchema.safeParse(body ?? {});
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.senderIds.reject(
      id,
      parsed.data,
      req.platformAdmin?.username ?? "platform",
    );
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
