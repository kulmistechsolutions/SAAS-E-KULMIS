import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import {
  createSmsCampaignSchema,
  createSmsTemplateSchema,
  previewAudienceSchema,
  sendAudienceSmsSchema,
  sendSmsSchema,
  requestSmsSenderIdSchema,
  saveSmsContactGroupSchema,
  saveSmsContactSchema,
  updateSchoolSmsSettingsSchema,
  updateSmsTemplateSchema,
  UserRole,
} from "@ekulmis/shared";
import { Roles } from "../auth/roles.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/auth.types";
import { SmsService } from "./sms.service";
import { SmsSenderIdService } from "./sms-sender-id.service";
import { senderIdFeatureEnabled } from "./sender-id-feature";
import { RequirePermission } from "../auth/require-permission.decorator";

@Roles(
  UserRole.ADMINISTRATOR,
  UserRole.SUPER_ADMINISTRATOR,
  UserRole.FINANCE_OFFICER,
  UserRole.EXAM_MANAGER,
  UserRole.ACADEMIC_MANAGER,
)
@Controller("sms")
export class SmsController {
  constructor(
    private readonly sms: SmsService,
    private readonly senderIds: SmsSenderIdService,
  ) {}

  @RequirePermission("sms.view")
  @Get("balance")
  balance(@CurrentUser() me: AuthUser) {
    return this.sms.schoolBalance(me.schoolId);
  }

  /** Credits used today, this month and per day — the dashboard's figures. */
  @RequirePermission("sms.view")
  @Get("usage")
  usage(@CurrentUser() me: AuthUser, @Query("days") days?: string) {
    return this.sms.usage(me.schoolId, days ? Number(days) : undefined);
  }

  @RequirePermission("sms.update")
  @Patch("settings")
  @Roles(UserRole.ADMINISTRATOR, UserRole.SUPER_ADMINISTRATOR)
  settings(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    const parsed = updateSchoolSmsSettingsSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.sms.updateSchoolSettings(me.schoolId, parsed.data);
  }

  /**
   * The school's sending name and any application in flight.
   *
   * `available: false` tells the UI the whole feature is switched off, so it
   * shows nothing rather than an application a school cannot use.
   */
  @RequirePermission("sms.view")
  @Get("sender-id")
  async senderId(@CurrentUser() me: AuthUser) {
    if (!senderIdFeatureEnabled()) return { available: false };
    return { available: true, ...(await this.senderIds.mySenderId(me.schoolId)) };
  }

  /** Apply for a sending name. Granting it is the platform owner's call. */
  @RequirePermission("sms.update")
  @Post("sender-id/request")
  @Roles(UserRole.ADMINISTRATOR, UserRole.SUPER_ADMINISTRATOR)
  requestSenderId(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    // Hidden in the UI, and refused here too — a hidden control is not a
    // closed door.
    if (!senderIdFeatureEnabled()) {
      throw new ForbiddenException(
        "Sender ID applications are closed. Messages are sent under the name configured for the gateway.",
      );
    }
    const parsed = requestSmsSenderIdSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.senderIds.request(me.schoolId, parsed.data);
  }

  @RequirePermission("sms.view")
  @Get("packages")
  packages() {
    return this.sms.listPackages(true);
  }

  @RequirePermission("sms.view")
  @Get("templates")
  templates(@CurrentUser() me: AuthUser) {
    return this.sms.listTemplates(me.schoolId);
  }

  @RequirePermission("sms.create")
  @Post("templates/seed")
  seedTemplates(@CurrentUser() me: AuthUser) {
    return this.sms.ensureDefaultTemplates(me.schoolId);
  }

  @RequirePermission("sms.update")
  @Post("templates/reset")
  @Roles(UserRole.ADMINISTRATOR, UserRole.SUPER_ADMINISTRATOR)
  resetTemplates(@CurrentUser() me: AuthUser) {
    return this.sms.resetTemplatesToDefaults(me.schoolId);
  }

  // ── School's own SMS gateway (paid add-on) ──
  // Read-only for the school. Entering and testing the Hormuud credentials
  // for a school's own account, and switching it on/off, is a Platform Super
  // Admin action now (see platform/sms/gateway-licenses/:schoolId/gateway) —
  // a school has no path to set or change its own sending credentials.
  @RequirePermission("sms.view")
  @Get("gateway")
  @Roles(UserRole.ADMINISTRATOR, UserRole.SUPER_ADMINISTRATOR)
  gateway(@CurrentUser() me: AuthUser) {
    return this.sms.getSchoolGateway(me.schoolId);
  }

  @RequirePermission("sms.create")
  @Post("templates")
  createTemplate(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    const parsed = createSmsTemplateSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.sms.createTemplate(me.schoolId, parsed.data);
  }

  @RequirePermission("sms.update")
  @Patch("templates/:id")
  updateTemplate(
    @CurrentUser() me: AuthUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const parsed = updateSmsTemplateSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.sms.updateTemplate(me.schoolId, id, parsed.data);
  }

  // Every other destructive SMS route — settings, reset, messages, contacts,
  // contact groups — is administrator-only. This one was the odd one out: a
  // template is shared by everyone who sends, so removing it is not a job for
  // whoever happens to be composing today.
  @Roles(UserRole.ADMINISTRATOR, UserRole.SUPER_ADMINISTRATOR)
  @RequirePermission("sms.delete")
  @Delete("templates/:id")
  deleteTemplate(@CurrentUser() me: AuthUser, @Param("id") id: string) {
    return this.sms.deleteTemplate(me.schoolId, id);
  }

  @RequirePermission("sms.view")
  @Get("messages")
  messages(
    @CurrentUser() me: AuthUser,
    @Query("status") status?: string,
    @Query("category") category?: string,
    @Query("q") q?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("take") take?: string,
    @Query("skip") skip?: string,
  ) {
    return this.sms.listMessages(me.schoolId, {
      status,
      category,
      q,
      from,
      to,
      take: take ? Number(take) : undefined,
      skip: skip ? Number(skip) : undefined,
    });
  }

  @Roles(UserRole.ADMINISTRATOR, UserRole.SUPER_ADMINISTRATOR)
  @RequirePermission("sms.delete")
  @Delete("messages")
  clearMessages(
    @CurrentUser() me: AuthUser,
    @Query("status") status?: string,
  ) {
    return this.sms.clearMessages(me.schoolId, status);
  }

  @RequirePermission("sms.view")
  @Get("transactions")
  transactions(@CurrentUser() me: AuthUser) {
    return this.sms.listTransactions(me.schoolId);
  }

  @RequirePermission("sms.view")
  @Get("campaigns")
  campaigns(@CurrentUser() me: AuthUser) {
    return this.sms.listCampaigns(me.schoolId);
  }

  @RequirePermission("sms.create")
  @Post("campaigns")
  createCampaign(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    const parsed = createSmsCampaignSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.sms.createCampaign(me.schoolId, me.userId, parsed.data);
  }

  @RequirePermission("sms.create")
  @Post("send")
  send(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    const parsed = sendSmsSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.sms.sendDirect(me.schoolId, me.userId, parsed.data);
  }

  @RequirePermission("sms.view")
  @Post("preview-audience")
  previewAudience(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    const parsed = previewAudienceSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.sms.previewAudience(me.schoolId, parsed.data);
  }

  @RequirePermission("sms.create")
  @Post("send-audience")
  sendAudience(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    const parsed = sendAudienceSmsSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.sms.sendToAudience(me.schoolId, me.userId, parsed.data);
  }

  // ── Custom SMS contacts & groups ──
  @RequirePermission("sms.view")
  @Get("contact-groups")
  contactGroups(@CurrentUser() me: AuthUser) {
    return this.sms.listContactGroups(me.schoolId);
  }

  @RequirePermission("sms.create")
  @Post("contact-groups")
  @Roles(UserRole.ADMINISTRATOR, UserRole.SUPER_ADMINISTRATOR)
  createContactGroup(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    const parsed = saveSmsContactGroupSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.sms.createContactGroup(me.schoolId, parsed.data.name);
  }

  @RequirePermission("sms.update")
  @Patch("contact-groups/:id")
  @Roles(UserRole.ADMINISTRATOR, UserRole.SUPER_ADMINISTRATOR)
  renameContactGroup(
    @CurrentUser() me: AuthUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const parsed = saveSmsContactGroupSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.sms.renameContactGroup(me.schoolId, id, parsed.data.name);
  }

  @RequirePermission("sms.delete")
  @Delete("contact-groups/:id")
  @Roles(UserRole.ADMINISTRATOR, UserRole.SUPER_ADMINISTRATOR)
  deleteContactGroup(@CurrentUser() me: AuthUser, @Param("id") id: string) {
    return this.sms.deleteContactGroup(me.schoolId, id);
  }

  @RequirePermission("sms.view")
  @Get("contacts")
  contacts(@CurrentUser() me: AuthUser, @Query("groupId") groupId?: string) {
    return this.sms.listContacts(me.schoolId, groupId);
  }

  @RequirePermission("sms.create")
  @Post("contacts")
  @Roles(UserRole.ADMINISTRATOR, UserRole.SUPER_ADMINISTRATOR)
  createContact(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    const parsed = saveSmsContactSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.sms.createContact(me.schoolId, parsed.data);
  }

  @RequirePermission("sms.update")
  @Patch("contacts/:id")
  @Roles(UserRole.ADMINISTRATOR, UserRole.SUPER_ADMINISTRATOR)
  updateContact(
    @CurrentUser() me: AuthUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const parsed = saveSmsContactSchema.partial().safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.sms.updateContact(me.schoolId, id, parsed.data);
  }

  @RequirePermission("sms.delete")
  @Delete("contacts/:id")
  @Roles(UserRole.ADMINISTRATOR, UserRole.SUPER_ADMINISTRATOR)
  deleteContact(@CurrentUser() me: AuthUser, @Param("id") id: string) {
    return this.sms.deleteContact(me.schoolId, id);
  }

  @RequirePermission("sms.create")
  @Post("fee-reminders")
  feeReminders(
    @CurrentUser() me: AuthUser,
    @Body() body: { message?: string } = {},
  ) {
    return this.sms.runFeeReminders(me.schoolId, me.userId, body.message);
  }
}
