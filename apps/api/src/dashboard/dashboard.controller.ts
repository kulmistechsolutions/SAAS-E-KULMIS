import { Controller, Get } from "@nestjs/common";
import { UserRole, dashboardVisibilityFor } from "@ekulmis/shared";
import { DashboardService } from "./dashboard.service";
import { Roles } from "../auth/roles.decorator";
import { STAFF_ROLES } from "../auth/role-groups";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/auth.types";

const ZERO_STUDENTS = { total: 0, active: 0, inactive: 0, graduated: 0, newThisMonth: 0 };
const ZERO_FEES = {
  totalOutstanding: 0,
  outstandingThisMonth: 0,
  collectedToday: 0,
  collectedThisMonth: 0,
  partialPayments: 0,
  advancePayments: 0,
  freeStudents: 0,
};
const ZERO_FINANCE = {
  totalIncome: 0,
  feeIncome: 0,
  otherIncome: 0,
  totalExpenses: 0,
  totalSalaries: 0,
  debtRepaid: 0,
  netIncome: 0,
};
const ZERO_ATTENDANCE = { present: 0, absent: 0, late: 0, total: 0, percentage: 0 };

@Controller("dashboard")
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  /**
   * The dashboard, cut to what the signed-in role actually holds.
   *
   * Every staff role lands here after login, and for a long time that was
   * read as "may see the totals". It is not. An attendance officer, granted
   * attendance and reports and nothing else, was shown 127 students, 3
   * teachers, 55 parents and 20 classes — four counts of a school they hold
   * no part of, before they had clicked anything.
   *
   * Sections a role does not hold are zeroed on the way out AND flagged in
   * `visible` so the screen leaves them out entirely: a school drawn with no
   * students is a worse answer than a screen that does not claim to know.
   */
  @Roles(...STAFF_ROLES)
  @Get("admin")
  async admin(@CurrentUser() me: AuthUser) {
    const data = await this.dashboard.admin(me.schoolId);
    const visible = dashboardVisibilityFor(me.role);

    return {
      ...data,
      students: visible.students ? data.students : ZERO_STUDENTS,
      teachers: visible.teachers ? data.teachers : { total: 0, active: 0 },
      parents: visible.parents ? data.parents : { total: 0 },
      academics: visible.academics
        ? data.academics
        : { classes: 0, sections: 0, subjects: 0 },
      attendanceToday: visible.attendance ? data.attendanceToday : ZERO_ATTENDANCE,
      teacherAttendanceToday: visible.attendance
        ? data.teacherAttendanceToday
        : { present: 0, absent: 0 },
      fees: visible.fees ? data.fees : ZERO_FEES,
      finance: visible.finance ? data.finance : ZERO_FINANCE,
      recentPayments: visible.fees ? data.recentPayments : [],
      upcomingExams: visible.exams ? data.upcomingExams : [],
      // Who did what across the whole school — an administrator's view of
      // their own staff, not something a member of that staff is granted.
      recentActivities: visible.activity ? data.recentActivities : [],
      charts: {
        studentGrowth: visible.students ? data.charts.studentGrowth : [],
        feeCollection: visible.fees ? data.charts.feeCollection : [],
        incomeVsExpense: visible.finance ? data.charts.incomeVsExpense : [],
      },
      visible,
      /** Kept for older clients, which read only this one flag. */
      financeVisible: visible.finance,
    };
  }

  @Roles(UserRole.TEACHER)
  @Get("teacher")
  teacher(@CurrentUser() me: AuthUser) {
    return this.dashboard.teacher(me.schoolId, me.userId);
  }
}
