import { Module } from "@nestjs/common";
import { TimetableController } from "./timetable.controller";
import { TimetableSetupService } from "./timetable-setup.service";

@Module({
  controllers: [TimetableController],
  providers: [TimetableSetupService],
  exports: [TimetableSetupService],
})
export class TimetableModule {}
