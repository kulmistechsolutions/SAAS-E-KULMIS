import { Module } from "@nestjs/common";
import { DashboardController } from "./dashboard.controller";
import { DashboardService } from "./dashboard.service";
import { TeachersModule } from "../teachers/teachers.module";
import { FinanceModule } from "../finance/finance.module";

@Module({
  imports: [TeachersModule, FinanceModule],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
