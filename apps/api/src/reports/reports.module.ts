import { Module } from "@nestjs/common";
import { ExaminationsModule } from "../examinations/examinations.module";
import { ReportsController } from "./reports.controller";
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

@Module({
  imports: [ExaminationsModule],
  controllers: [ReportsController],
  providers: [
    ReportsService,
    FeeReportsService,
    StudentReportsService,
    TeacherReportsService,
    ExamReportsService,
    PromotionReportsService,
    SalaryReportsService,
    ExpenseReportsService,
    FinancialReportsService,
    QuizReportsService,
  ],
})
export class ReportsModule {}
