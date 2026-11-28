import { Module } from "@nestjs/common";
import { ExamScheduleController } from "./exam-schedule.controller";
import { ExamScheduleService } from "./exam-schedule.service";

@Module({
  controllers: [ExamScheduleController],
  providers: [ExamScheduleService],
})
export class ExamScheduleModule {}
