import {
  BadRequestException,
  Body,
  Controller,
  Post,
} from "@nestjs/common";
import { z } from "zod";
import { UserRole } from "@ekulmis/shared";
import { ExamResultSmsService } from "./exam-result-sms.service";
import { Roles } from "../auth/roles.decorator";
import { STAFF_ROLES } from "../auth/role-groups";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/auth.types";
import { RequirePermission } from "../auth/require-permission.decorator";

const optionsSchema = z.object({
  examId: z.string().min(1),
  sectionId: z.string().nullish(),
  studentIds: z.array(z.string()).optional(),
  templateId: z.string().optional(),
  body: z.string().optional(),
  subjects: z.array(z.string()).optional(),
  separator: z.string().max(4).optional(),
  joiner: z.string().max(4).optional(),
});

const sendSchema = optionsSchema.extend({
  /** Overriding the duplicate guard, asked for explicitly. */
  resend: z.boolean().optional(),
});

/**
 * Exam results to parents.
 *
 * Two routes, and the first is not optional: nothing may be sent that has not
 * been previewed, because the preview is the only place a school sees the
 * message its parents will read, who is being left out and why, and what the
 * batch costs in credits. An SMS to four hundred parents cannot be recalled.
 */
@Roles(...STAFF_ROLES)
@Controller("sms/exam-results")
export class ExamResultSmsController {
  constructor(private readonly service: ExamResultSmsService) {}

  @RequirePermission("sms.view")
  @Post("preview")
  preview(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    const parsed = optionsSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.service.preview(me.schoolId, parsed.data);
  }

  @Roles(UserRole.ADMINISTRATOR, UserRole.EXAM_MANAGER)
  @RequirePermission("sms.create")
  @Post("send")
  send(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    const parsed = sendSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.service.send(me.schoolId, me.userId, parsed.data);
  }

  /**
   * Send again only to the parents this exam's messages failed to reach.
   *
   * Nine dropped messages out of four hundred should cost a school nine
   * credits to put right, and the parents who already have the result should
   * not get it twice because of somebody else's failure.
   */
  @Roles(UserRole.ADMINISTRATOR, UserRole.EXAM_MANAGER)
  @RequirePermission("sms.create")
  @Post("retry")
  retry(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    const parsed = optionsSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const { examId, ...rest } = parsed.data;
    return this.service.retryFailed(me.schoolId, me.userId, examId, rest);
  }

  /** How this exam's send went, per parent. */
  @RequirePermission("sms.view")
  @Post("history")
  history(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    const parsed = z.object({ examId: z.string().min(1) }).safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.service.history(me.schoolId, parsed.data.examId);
  }
}
