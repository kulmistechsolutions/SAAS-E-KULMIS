import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import { attendanceAssignmentsSchema, UserRole } from "@ekulmis/shared";
import { AttendanceScopeService } from "./attendance-scope.service";
import { AuditService } from "../audit/audit.service";
import { Roles } from "../auth/roles.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/auth.types";

/**
 * The administrator's side of attendance officers: who they are and where
 * each of them may work.
 *
 * Deliberately admin-only. An officer changing their own assignments would
 * make the grant meaningless, so the one role this module restricts is the one
 * role that cannot edit it.
 */
@Roles(UserRole.ADMINISTRATOR, UserRole.SUPER_ADMINISTRATOR)
@Controller("attendance-officers")
export class AttendanceOfficersController {
  constructor(
    private readonly scope: AttendanceScopeService,
    private readonly audit: AuditService,
  ) {}

  /** Every attendance officer with the classes, sections and shifts they hold. */
  @Get()
  list(@CurrentUser() me: AuthUser) {
    return this.scope.listOfficers(me.schoolId);
  }

  /**
   * Every register for one day and who took it — including the ones nobody
   * did. A blank register and a class where everyone turned up look identical
   * in the marks; only this tells them apart, and only while the day can
   * still be fixed.
   */
  @Get("monitoring")
  monitoring(@CurrentUser() me: AuthUser, @Query("date") date: string) {
    if (!date) throw new BadRequestException("date is required");
    return this.scope.monitoring(me.schoolId, date);
  }

  /** How each officer has kept up, measured against their own assignments. */
  @Get("performance")
  performance(
    @CurrentUser() me: AuthUser,
    @Query("from") from: string,
    @Query("to") to: string,
  ) {
    if (!from || !to) {
      throw new BadRequestException("from and to are required");
    }
    return this.scope.performance(me.schoolId, from, to);
  }

  @Get(":userId/assignments")
  assignments(@CurrentUser() me: AuthUser, @Param("userId") userId: string) {
    return this.scope.assignmentsFor(me.schoolId, userId);
  }

  /**
   * Set exactly what one officer may reach, replacing whatever they had.
   *
   * Replace rather than add: an administrator editing this screen is stating
   * what the officer should have, and a class they unticked must actually go.
   */
  @Post("assignments")
  async setAssignments(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    const parsed = attendanceAssignmentsSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    // Told, not blocked. A school may deliberately put two officers on one
    // register — but it should be a decision, not a surprise discovered when
    // they disagree about who marked what.
    const conflicts = await this.scope.conflictsFor(
      me.schoolId,
      parsed.data.userId,
      parsed.data.assignments,
    );

    const result = await this.scope.setAssignments(
      me.schoolId,
      parsed.data.userId,
      parsed.data.assignments,
      { userId: me.userId },
    );

    await this.audit.record({
      schoolId: me.schoolId,
      userId: me.userId,
      username: me.username,
      role: me.role,
      module: "attendance",
      action: "ATTENDANCE_ASSIGNMENTS_SET",
      metadata: {
        officerUserId: parsed.data.userId,
        assignments: result.count,
        conflicts: conflicts.length,
      },
    });

    return {
      ...result,
      conflicts: conflicts.map((c) => ({
        officer: c.user.fullName || c.user.username,
        className: c.class.name,
        section: c.section?.name ?? null,
        shift: c.shift?.name ?? null,
      })),
    };
  }
}
