import {
  Controller,
  Get,
  Header,
  Param,
  Query,
  Res,
} from "@nestjs/common";
import type { Response } from "express";
import { UserRole } from "@ekulmis/shared";
import { ReportsService } from "./reports.service";
import { FeeReportsService } from "./fee-reports.service";
import { StudentReportsService } from "./student-reports.service";
import { Roles } from "../auth/roles.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/auth.types";

@Controller("reports")
export class ReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly feeReports: FeeReportsService,
    private readonly studentReports: StudentReportsService,
  ) {}

  /** Student and parent reports, computed from the database. */
  @Roles(UserRole.ADMINISTRATOR, UserRole.FINANCE_OFFICER, UserRole.EXAM_MANAGER)
  @Get("student-reports/:slug")
  studentReportsBySlug(
    @CurrentUser() me: AuthUser,
    @Param("slug") slug: string,
    @Query("className") className?: string,
    @Query("section") section?: string,
    @Query("gender") gender?: string,
    @Query("status") status?: string,
    @Query("dateFrom") dateFrom?: string,
    @Query("dateTo") dateTo?: string,
    @Query("search") search?: string,
  ) {
    return this.studentReports.build(me.schoolId, slug, {
      className,
      section,
      gender,
      status,
      dateFrom,
      dateTo,
      search,
    });
  }

  /**
   * Fee reports, computed from the database rather than from whatever the fee
   * pages happened to leave in the browser's store.
   */
  @Roles(UserRole.ADMINISTRATOR, UserRole.FINANCE_OFFICER)
  @Get("fees/:slug")
  fees(
    @CurrentUser() me: AuthUser,
    @Param("slug") slug: string,
    @Query("className") className?: string,
    @Query("section") section?: string,
    @Query("month") month?: string,
    @Query("dateFrom") dateFrom?: string,
    @Query("dateTo") dateTo?: string,
    @Query("search") search?: string,
  ) {
    return this.feeReports.build(me.schoolId, slug, {
      className,
      section,
      month,
      dateFrom,
      dateTo,
      search,
    });
  }

  @Roles(UserRole.ADMINISTRATOR, UserRole.FINANCE_OFFICER, UserRole.EXAM_MANAGER)
  @Get("students")
  students(
    @CurrentUser() me: AuthUser,
    @Query("classId") classId?: string,
  ) {
    return this.reports.studentListReport(me.schoolId, classId);
  }

  @Roles(UserRole.ADMINISTRATOR, UserRole.FINANCE_OFFICER, UserRole.EXAM_MANAGER)
  @Get("students/export/pdf")
  @Header("Content-Type", "application/pdf")
  async studentsPdf(
    @CurrentUser() me: AuthUser,
    @Query("classId") classId: string | undefined,
    @Res() res: Response,
  ) {
    const buf = await this.reports.exportStudentsPdf(me.schoolId, classId);
    res.setHeader("Content-Disposition", 'attachment; filename="students.pdf"');
    res.send(buf);
  }

  @Roles(UserRole.ADMINISTRATOR, UserRole.FINANCE_OFFICER, UserRole.EXAM_MANAGER)
  @Get("students/export/excel")
  async studentsExcel(
    @CurrentUser() me: AuthUser,
    @Query("classId") classId: string | undefined,
    @Res() res: Response,
  ) {
    const buf = await this.reports.exportStudentsExcel(me.schoolId, classId);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader("Content-Disposition", 'attachment; filename="students.xlsx"');
    res.send(buf);
  }

  @Roles(UserRole.ADMINISTRATOR, UserRole.FINANCE_OFFICER, UserRole.EXAM_MANAGER)
  @Get("attendance")
  attendance(
    @CurrentUser() me: AuthUser,
    @Query("date") date: string,
    @Query("classId") classId?: string,
  ) {
    return this.reports.attendanceReport(me.schoolId, date, classId);
  }

  @Roles(UserRole.ADMINISTRATOR, UserRole.FINANCE_OFFICER, UserRole.EXAM_MANAGER)
  @Get("exam-results/:studentId")
  examResults(
    @CurrentUser() me: AuthUser,
    @Param("studentId") studentId: string,
  ) {
    return this.reports.examResultsReport(me.schoolId, studentId);
  }
}
