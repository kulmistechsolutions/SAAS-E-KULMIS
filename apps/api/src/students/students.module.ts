import { Module } from "@nestjs/common";
import { StudentsController } from "./students.controller";
import { StudentsService } from "./students.service";
import { ParentsController } from "./parents.controller";
import { ParentsService } from "./parents.service";
import { TeachersModule } from "../teachers/teachers.module";
import { FinanceModule } from "../finance/finance.module";

/** Student Management (Module 1) + Parent Management (Module 2). */
@Module({
  imports: [TeachersModule, FinanceModule],
  controllers: [StudentsController, ParentsController],
  providers: [StudentsService, ParentsService],
  exports: [StudentsService, ParentsService],
})
export class StudentsModule {}
