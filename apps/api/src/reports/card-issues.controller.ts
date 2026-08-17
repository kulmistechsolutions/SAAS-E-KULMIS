import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import { UserRole } from "@ekulmis/shared";
import { Roles } from "../auth/roles.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/auth.types";
import {
  CardIssuesService,
  clearanceQuerySchema,
  recordCardIssuesSchema,
  voidCardIssueSchema,
} from "./card-issues.service";

/**
 * ID card generation history and reprints.
 *
 * Recording is deliberately open to the same roles that can generate cards —
 * if an exam officer can print exam cards, the history has to show that they
 * did, otherwise the log quietly under-reports what the school handed out.
 */
@Roles(
  UserRole.ADMINISTRATOR,
  UserRole.SUPER_ADMINISTRATOR,
  UserRole.EXAM_MANAGER,
  UserRole.ACADEMIC_MANAGER,
  UserRole.RECEPTION_OFFICER,
  UserRole.RECEPTION,
)
@Controller("card-issues")
export class CardIssuesController {
  constructor(private readonly issues: CardIssuesService) {}

  @Get()
  list(
    @CurrentUser() me: AuthUser,
    @Query("search") search?: string,
    @Query("cardType") cardType?: string,
    @Query("status") status?: string,
    @Query("limit") limit?: string,
  ) {
    return this.issues.list(me.schoolId, {
      search,
      cardType,
      status,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get("report")
  report(@CurrentUser() me: AuthUser) {
    return this.issues.report(me.schoolId);
  }

  @Get("summary")
  summary(@CurrentUser() me: AuthUser) {
    return this.issues.summary(me.schoolId);
  }

  @Post()
  record(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    const parsed = recordCardIssuesSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.issues.record(me.schoolId, me.userId, parsed.data);
  }

  /** Real clearance status for a batch of students (PRD §23). */
  @Post("clearance")
  clearance(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    const parsed = clearanceQuerySchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.issues.clearance(me.schoolId, parsed.data.studentIds);
  }

  /**
   * Void one record. Restricted to admins: cancelling an audit entry is a
   * heavier act than printing a card, so it is not open to every role that can
   * generate one.
   */
  @Roles(UserRole.ADMINISTRATOR, UserRole.SUPER_ADMINISTRATOR)
  @Post(":id/void")
  voidIssue(
    @CurrentUser() me: AuthUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const parsed = voidCardIssueSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.issues.voidIssue(me.schoolId, id, parsed.data.reason);
  }

  @Post(":batchId/printed")
  markPrinted(@CurrentUser() me: AuthUser, @Param("batchId") batchId: string) {
    return this.issues.markPrinted(me.schoolId, batchId);
  }
}
