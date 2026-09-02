import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
} from "@nestjs/common";
import { markStudentAttendanceSchema, UserRole } from "@ekulmis/shared";
import { StudentAttendanceService } from "./student-attendance.service";
import { TeachersService } from "../teachers/teachers.service";
import { AttendanceScopeService } from "./attendance-scope.service";
import { Roles } from "../auth/roles.decorator";
import { STAFF_ROLES } from "../auth/role-groups";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/auth.types";

// Staff-only by default (excludes PARENT/STUDENT). The `mark` handler below
// overrides this with a stricter write-role set.
@Roles(...STAFF_ROLES)
@Controller("student-attendance")
export class StudentAttendanceController {
  constructor(
    private readonly attendance: StudentAttendanceService,
    private readonly teachers: TeachersService,
    private readonly scope: AttendanceScopeService,
  ) {}

  /**
   * Whether this person may touch this register at all.
   *
   * Two kinds of scoping meet here. A teacher is limited to the classes they
   * are assigned to teach; an attendance officer to the classes, sections and
   * shifts an administrator granted them. Everyone else — administrators and
   * the roles that supervise them — is unrestricted, because a school that
   * cannot see its own registers cannot supervise the people taking them.
   */
  private async assertClassAccess(
    me: AuthUser,
    classId: string,
    sectionId?: string | null,
    shiftId?: string | null,
  ) {
    await this.scope.assertCanTake(me.schoolId, me.userId, me.role, {
      classId,
      sectionId: sectionId ?? null,
      shiftId: shiftId ?? null,
    });
    if (me.role !== "TEACHER") return;
    await this.teachers.assertOwnsAssignment(me.schoolId, me.userId, {
      classId,
      sectionId: sectionId ?? null,
    });
  }

  @Roles(
    UserRole.ADMINISTRATOR,
    UserRole.ATTENDANCE_OFFICER,
    UserRole.TEACHER,
  )
  @Post("mark")
  async mark(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    const parsed = markStudentAttendanceSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    await this.assertClassAccess(
      me,
      parsed.data.classId,
      parsed.data.sectionId,
      parsed.data.shiftId ?? null,
    );
    return this.attendance.mark(me.schoolId, parsed.data, me.userId, me.role);
  }

  @Get()
  async list(
    @CurrentUser() me: AuthUser,
    @Query("classId") classId: string,
    @Query("date") date: string,
    @Query("sectionId") sectionId?: string,
    @Query("shiftId") shiftId?: string,
  ) {
    if (!classId || !date) {
      throw new BadRequestException("classId and date are required");
    }
    await this.assertClassAccess(me, classId, sectionId ?? null, shiftId ?? null);
    return this.attendance.list(
      me.schoolId,
      classId,
      sectionId ?? null,
      date,
      shiftId ?? null,
    );
  }

  /** The classes this account may take attendance for. */
  @Get("my-assignments")
  myAssignments(@CurrentUser() me: AuthUser) {
    return this.scope.assignmentsFor(me.schoolId, me.userId);
  }

  /**
   * Every register this account holds for one day, with how far each has got.
   *
   * The officer's own screen. It answers the question they actually have —
   * "what have I still not done today?" — which four separate class screens
   * cannot, and which is how a register quietly goes unmarked.
   */
  @Roles(UserRole.ATTENDANCE_OFFICER, UserRole.ADMINISTRATOR)
  @Get("my-day")
  myDay(@CurrentUser() me: AuthUser, @Query("date") date: string) {
    if (!date) throw new BadRequestException("date is required");
    return this.scope.myDay(me.schoolId, me.userId, date);
  }

  @Get("dashboard")
  async dashboard(
    @CurrentUser() me: AuthUser,
    @Query("date") date: string,
    @Query("classId") classId?: string,
    @Query("sectionId") sectionId?: string,
    @Query("shiftId") shiftId?: string,
  ) {
    if (!date) throw new BadRequestException("date is required");
    // A scoped role asking for the whole school's day would be handed every
    // class in it, so the class must be named and then checked.
    if (me.role === "TEACHER" || this.scope.isScoped(me.role)) {
      if (!classId) {
        throw new BadRequestException(
          "Provide a classId — this account is limited to its assigned classes",
        );
      }
      await this.assertClassAccess(me, classId, sectionId ?? null, shiftId ?? null);
    }
    return this.attendance.dashboard(
      me.schoolId,
      date,
      classId,
      sectionId,
      shiftId,
    );
  }
}
