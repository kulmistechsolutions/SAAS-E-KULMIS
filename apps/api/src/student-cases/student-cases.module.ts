import { Module } from "@nestjs/common";
import { StudentCasesController } from "./student-cases.controller";
import { StudentCasesService } from "./student-cases.service";

@Module({
  controllers: [StudentCasesController],
  providers: [StudentCasesService],
  exports: [StudentCasesService],
})
export class StudentCasesModule {}
