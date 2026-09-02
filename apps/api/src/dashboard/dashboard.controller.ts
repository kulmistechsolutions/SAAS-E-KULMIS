import { Controller, Get } from "@nestjs/common";
import { UserRole } from "@ekulmis/shared";
import { DashboardService } from "./dashboard.service";
import { Roles } from "../auth/roles.decorator";
import { STAFF_ROLES } from "../auth/role-groups";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/auth.types";

/** Roles whose permissions include the school's money (see builtInRolePermissions). */
const MONEY_ROLES: string[] = [
  UserRole.ADMINISTRATOR,
  UserRole.SUPER_ADMINISTRATOR,
  UserRole.FINANCE_OFFICER,
];

@Controller("dashboard")
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  // Every non-teacher staff role lands here after login (DashboardPage only
  // special-cases TEACHER) — restricting this to ADMINISTRATOR left every
  // other role (Finance Officer, Attendance Officer, Exam Manager, ...)
  // staring at "Could not reach the dashboard API" on their very first
  // screen. Everything returned is an aggregate count/sum (totals, not
  // individual salary/fee records), so it's safe for any signed-in staff
  // member the same way Settings reads already are.
  @Roles(...STAFF_ROLES)
  @Get("admin")
  async admin(@CurrentUser() me: AuthUser) {
    const data = await this.dashboard.admin(me.schoolId);
    if (MONEY_ROLES.includes(me.role)) return data;

    // Aggregates are safe for any staff member; the school's finances are not.
    // An attendance officer landing here was handed total income, expenses,
    // salaries, outstanding fees and a list of recent payments with the
    // children's names against the amounts — none of which their role grants
    // anywhere else in the product, and all of which they could read simply by
    // logging in.
    return {
      ...data,
      fees: {
        totalOutstanding: 0,
        outstandingThisMonth: 0,
        collectedToday: 0,
        collectedThisMonth: 0,
        partialPayments: 0,
        advancePayments: 0,
        freeStudents: 0,
      },
      finance: {
        totalIncome: 0,
        feeIncome: 0,
        otherIncome: 0,
        totalExpenses: 0,
        totalSalaries: 0,
        netIncome: 0,
      },
      charts: {
        studentGrowth: data.charts.studentGrowth,
        feeCollection: [],
        incomeVsExpense: [],
      },
      recentPayments: [],
      // The screen hides the money rather than drawing a school with no
      // income: zeroes are a worse lie than an absent section.
      financeVisible: false,
    };
  }

  @Roles(UserRole.TEACHER)
  @Get("teacher")
  teacher(@CurrentUser() me: AuthUser) {
    return this.dashboard.teacher(me.schoolId, me.userId);
  }
}
