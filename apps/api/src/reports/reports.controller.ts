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
import { Roles } from "../auth/roles.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/auth.types";

@Controller("reports")
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

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
