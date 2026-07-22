import { Module } from "@nestjs/common";
import { StudentsController } from "./students.controller";
import { StudentsService } from "./students.service";
import { ParentsController } from "./parents.controller";
import { ParentsService } from "./parents.service";
import { SchoolResetController } from "./school-reset.controller";
import { SchoolResetService } from "./school-reset.service";
import { TeachersModule } from "../teachers/teachers.module";
import { FinanceModule } from "../finance/finance.module";
import { SubscriptionsModule } from "../subscriptions/subscriptions.module";

/** Student Management (Module 1) + Parent Management (Module 2). */
@Module({
  imports: [TeachersModule, FinanceModule, SubscriptionsModule],
  controllers: [StudentsController, ParentsController, SchoolResetController],
  providers: [StudentsService, ParentsService, SchoolResetService],
  exports: [StudentsService, ParentsService],
})
export class StudentsModule {}
