import { Module } from "@nestjs/common";
import { FeesController } from "./fees.controller";
import { FeesService } from "./fees.service";
import { SalariesController } from "./salaries.controller";
import { SalariesService } from "./salaries.service";
import { ExpensesController } from "./expenses.controller";
import { ExpensesService } from "./expenses.service";
import { OtherIncomeController } from "./other-income.controller";
import { OtherIncomeService } from "./other-income.service";
import { FinanceController } from "./finance.controller";
import { FinanceService } from "./finance.service";

/** Phase 4 — Fees(7), Salary(8), Expense(9), Additional Income(9b),
 *  Finance Dashboard(10). */
@Module({
  controllers: [
    FeesController,
    SalariesController,
    ExpensesController,
    OtherIncomeController,
    FinanceController,
  ],
  providers: [
    FeesService,
    SalariesService,
    ExpensesService,
    OtherIncomeService,
    FinanceService,
  ],
  exports: [
    FeesService,
    SalariesService,
    ExpensesService,
    OtherIncomeService,
    FinanceService,
  ],
})
export class FinanceModule {}
