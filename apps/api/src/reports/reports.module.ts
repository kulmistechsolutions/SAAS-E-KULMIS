import { Module } from "@nestjs/common";
import { ExaminationsModule } from "../examinations/examinations.module";
import { ReportsController } from "./reports.controller";
import { ReportsService } from "./reports.service";
import { FeeReportsService } from "./fee-reports.service";
import { StudentReportsService } from "./student-reports.service";

@Module({
  imports: [ExaminationsModule],
  controllers: [ReportsController],
  providers: [ReportsService, FeeReportsService, StudentReportsService],
})
export class ReportsModule {}
