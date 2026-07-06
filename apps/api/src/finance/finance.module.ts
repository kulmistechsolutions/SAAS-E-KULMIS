import { Module } from "@nestjs/common";
import { FeesController } from "./fees.controller";
import { FeesService } from "./fees.service";
import { SalariesController } from "./salaries.controller";
import { SalariesService } from "./salaries.service";
import { ExpensesController } from "./expenses.controller";
import { ExpensesService } from "./expenses.service";
import { FinanceController } from "./finance.controller";
import { FinanceService } from "./finance.service";

/** Phase 4 — Fees(7), Salary(8), Expense(9), Finance Dashboard(10). */
@Module({
  controllers: [
    FeesController,
    SalariesController,
    ExpensesController,
    FinanceController,
  ],
  providers: [FeesService, SalariesService, ExpensesService, FinanceService],
  exports: [FeesService, SalariesService, ExpensesService, FinanceService],
})
export class FinanceModule {}
