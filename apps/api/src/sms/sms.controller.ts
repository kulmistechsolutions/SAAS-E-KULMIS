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
  createSmsCampaignSchema,
  createSmsTemplateSchema,
  previewAudienceSchema,
  sendAudienceSmsSchema,
  sendSmsSchema,
  updateSchoolSmsSettingsSchema,
  updateSmsTemplateSchema,
  UserRole,
} from "@ekulmis/shared";
import { Roles } from "../auth/roles.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/auth.types";
import { SmsService } from "./sms.service";

@Roles(
  UserRole.ADMINISTRATOR,
  UserRole.SUPER_ADMINISTRATOR,
  UserRole.FINANCE_OFFICER,
  UserRole.EXAM_MANAGER,
  UserRole.ACADEMIC_MANAGER,
)
@Controller("sms")
export class SmsController {
  constructor(private readonly sms: SmsService) {}

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

  @Post("fee-reminders")
  feeReminders(
    @CurrentUser() me: AuthUser,
    @Body() body: { message?: string } = {},
  ) {
    return this.sms.runFeeReminders(me.schoolId, me.userId, body.message);
  }
}
