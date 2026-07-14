import { Module } from "@nestjs/common";
import { ExaminationsModule } from "../examinations/examinations.module";
import { ReportsController } from "./reports.controller";
import { ReportsService } from "./reports.service";

@Module({
  imports: [ExaminationsModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
