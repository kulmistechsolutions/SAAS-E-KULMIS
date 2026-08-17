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

  @Get("balance")
  balance(@CurrentUser() me: AuthUser) {
    return this.sms.schoolBalance(me.schoolId);
  }

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
  @Get("sender-id")
  async senderId(@CurrentUser() me: AuthUser) {
    if (!senderIdFeatureEnabled()) return { available: false };
    return { available: true, ...(await this.senderIds.mySenderId(me.schoolId)) };
  }

  /** Apply for a sending name. Granting it is the platform owner's call. */
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

  @Get("packages")
  packages() {
    return this.sms.listPackages(true);
  }

  @Get("templates")
  templates(@CurrentUser() me: AuthUser) {
    return this.sms.listTemplates(me.schoolId);
  }

  @Post("templates/seed")
  seedTemplates(@CurrentUser() me: AuthUser) {
    return this.sms.ensureDefaultTemplates(me.schoolId);
  }

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
  @Get("gateway")
  @Roles(UserRole.ADMINISTRATOR, UserRole.SUPER_ADMINISTRATOR)
  gateway(@CurrentUser() me: AuthUser) {
    return this.sms.getSchoolGateway(me.schoolId);
  }

  @Post("templates")
  createTemplate(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    const parsed = createSmsTemplateSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.sms.createTemplate(me.schoolId, parsed.data);
  }

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

  @Delete("templates/:id")
  deleteTemplate(@CurrentUser() me: AuthUser, @Param("id") id: string) {
    return this.sms.deleteTemplate(me.schoolId, id);
  }

  @Get("messages")
  messages(
    @CurrentUser() me: AuthUser,
    @Query("status") status?: string,
    @Query("category") category?: string,
    @Query("q") q?: string,
  ) {
    return this.sms.listMessages(me.schoolId, { status, category, q });
  }

  @Roles(UserRole.ADMINISTRATOR, UserRole.SUPER_ADMINISTRATOR)
  @Delete("messages")
  clearMessages(
    @CurrentUser() me: AuthUser,
    @Query("status") status?: string,
  ) {
    return this.sms.clearMessages(me.schoolId, status);
  }

  @Get("transactions")
  transactions(@CurrentUser() me: AuthUser) {
    return this.sms.listTransactions(me.schoolId);
  }

  @Get("campaigns")
  campaigns(@CurrentUser() me: AuthUser) {
    return this.sms.listCampaigns(me.schoolId);
  }

  @Post("campaigns")
  createCampaign(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    const parsed = createSmsCampaignSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.sms.createCampaign(me.schoolId, me.userId, parsed.data);
  }

  @Post("send")
  send(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    const parsed = sendSmsSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.sms.sendDirect(me.schoolId, me.userId, parsed.data);
  }

  @Post("preview-audience")
  previewAudience(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    const parsed = previewAudienceSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.sms.previewAudience(me.schoolId, parsed.data);
  }

  @Post("send-audience")
  sendAudience(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    const parsed = sendAudienceSmsSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.sms.sendToAudience(me.schoolId, me.userId, parsed.data);
  }

  // ── Custom SMS contacts & groups ──
  @Get("contact-groups")
  contactGroups(@CurrentUser() me: AuthUser) {
    return this.sms.listContactGroups(me.schoolId);
  }

  @Post("contact-groups")
  @Roles(UserRole.ADMINISTRATOR, UserRole.SUPER_ADMINISTRATOR)
  createContactGroup(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    const parsed = saveSmsContactGroupSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.sms.createContactGroup(me.schoolId, parsed.data.name);
  }

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

  @Delete("contact-groups/:id")
  @Roles(UserRole.ADMINISTRATOR, UserRole.SUPER_ADMINISTRATOR)
  deleteContactGroup(@CurrentUser() me: AuthUser, @Param("id") id: string) {
    return this.sms.deleteContactGroup(me.schoolId, id);
  }

  @Get("contacts")
  contacts(@CurrentUser() me: AuthUser, @Query("groupId") groupId?: string) {
    return this.sms.listContacts(me.schoolId, groupId);
  }

  @Post("contacts")
  @Roles(UserRole.ADMINISTRATOR, UserRole.SUPER_ADMINISTRATOR)
  createContact(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    const parsed = saveSmsContactSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.sms.createContact(me.schoolId, parsed.data);
  }

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

  @Delete("contacts/:id")
  @Roles(UserRole.ADMINISTRATOR, UserRole.SUPER_ADMINISTRATOR)
  deleteContact(@CurrentUser() me: AuthUser, @Param("id") id: string) {
    return this.sms.deleteContact(me.schoolId, id);
  }

  @Post("fee-reminders")
  feeReminders(
    @CurrentUser() me: AuthUser,
    @Body() body: { message?: string } = {},
  ) {
    return this.sms.runFeeReminders(me.schoolId, me.userId, body.message);
  }
}
