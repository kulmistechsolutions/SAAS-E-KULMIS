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
import { TeacherReportsService } from "./teacher-reports.service";
import { ExamReportsService } from "./exam-reports.service";
import { PromotionReportsService } from "./promotion-reports.service";
import { SalaryReportsService } from "./salary-reports.service";
import { ExpenseReportsService } from "./expense-reports.service";
import { FinancialReportsService } from "./financial-reports.service";
import { QuizReportsService } from "./quiz-reports.service";
import { Roles } from "../auth/roles.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/auth.types";

@Controller("reports")
export class ReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly feeReports: FeeReportsService,
    private readonly studentReports: StudentReportsService,
    private readonly teacherReports: TeacherReportsService,
    private readonly examReports: ExamReportsService,
    private readonly promotionReports: PromotionReportsService,
    private readonly salaryReports: SalaryReportsService,
    private readonly expenseReports: ExpenseReportsService,
    private readonly financialReports: FinancialReportsService,
    private readonly quizReports: QuizReportsService,
  ) {}

  /** Promotion and graduation reports, computed from the database. */
  @Roles(UserRole.ADMINISTRATOR, UserRole.FINANCE_OFFICER, UserRole.EXAM_MANAGER)
  @Get("promotion-reports/:slug")
  promotionReportsBySlug(
    @CurrentUser() me: AuthUser,
    @Param("slug") slug: string,
    @Query("className") className?: string,
    @Query("section") section?: string,
    @Query("search") search?: string,
  ) {
    return this.promotionReports.build(me.schoolId, slug, { className, section, search });
  }

  /** Staff salary reports, computed from the database. */
  @Roles(UserRole.ADMINISTRATOR, UserRole.FINANCE_OFFICER)
  @Get("salary-reports/:slug")
  salaryReportsBySlug(
    @CurrentUser() me: AuthUser,
    @Param("slug") slug: string,
    @Query("month") month?: string,
    @Query("shift") shift?: string,
    @Query("status") status?: string,
  ) {
    return this.salaryReports.build(me.schoolId, slug, { month, shift, status });
  }

  /** Operational expense reports, computed from the database. */
  @Roles(UserRole.ADMINISTRATOR, UserRole.FINANCE_OFFICER)
  @Get("expense-reports/:slug")
  expenseReportsBySlug(
    @CurrentUser() me: AuthUser,
    @Param("slug") slug: string,
    @Query("dateFrom") dateFrom?: string,
    @Query("dateTo") dateTo?: string,
    @Query("month") month?: string,
    @Query("category") category?: string,
  ) {
    return this.expenseReports.build(me.schoolId, slug, {
      dateFrom,
      dateTo,
      month,
      category,
    });
  }

  /** Income vs. expenses vs. salaries, computed from the database. */
  @Roles(UserRole.ADMINISTRATOR, UserRole.FINANCE_OFFICER)
  @Get("financial-reports/:slug")
  financialReportsBySlug(
    @CurrentUser() me: AuthUser,
    @Param("slug") slug: string,
    @Query("month") month?: string,
  ) {
    return this.financialReports.build(me.schoolId, slug, { month });
  }

  /** Quiz performance and activity reports, computed from the database. */
  @Roles(UserRole.ADMINISTRATOR, UserRole.FINANCE_OFFICER, UserRole.EXAM_MANAGER)
  @Get("quiz-reports/:slug")
  quizReportsBySlug(
    @CurrentUser() me: AuthUser,
    @Param("slug") slug: string,
    @Query("className") className?: string,
    @Query("section") section?: string,
  ) {
    return this.quizReports.build(me.schoolId, slug, { className, section });
  }

  /** Exams for the report picker, so it stops depending on a browser store. */
  @Roles(UserRole.ADMINISTRATOR, UserRole.FINANCE_OFFICER, UserRole.EXAM_MANAGER)
  @Get("exam-list")
  examList(@CurrentUser() me: AuthUser, @Query("academicYearId") yearId: string) {
    if (!yearId) return [];
    return this.examReports.listExams(me.schoolId, yearId);
  }

  /** Examination reports: results, rankings, distribution, submission status. */
  @Roles(UserRole.ADMINISTRATOR, UserRole.FINANCE_OFFICER, UserRole.EXAM_MANAGER)
  @Get("exam-reports/:slug")
  examReportsBySlug(
    @CurrentUser() me: AuthUser,
    @Param("slug") slug: string,
    @Query("examId") examId?: string,
    @Query("className") className?: string,
    @Query("section") section?: string,
    @Query("subject") subject?: string,
    @Query("term") term?: string,
    @Query("search") search?: string,
  ) {
    return this.examReports.build(me.schoolId, slug, {
      examId,
      className,
      section,
      subject,
      term,
      search,
    });
  }

  /** Teacher list, salary and assignment reports, from the database. */
  @Roles(UserRole.ADMINISTRATOR, UserRole.FINANCE_OFFICER, UserRole.EXAM_MANAGER)
  @Get("teacher-reports/:slug")
  teacherReportsBySlug(
    @CurrentUser() me: AuthUser,
    @Param("slug") slug: string,
    @Query("shift") shift?: string,
    @Query("status") status?: string,
    @Query("className") className?: string,
    @Query("section") section?: string,
    @Query("subject") subject?: string,
    @Query("search") search?: string,
  ) {
    return this.teacherReports.build(me.schoolId, slug, {
      shift,
      status,
      className,
      section,
      subject,
      search,
    });
  }

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
