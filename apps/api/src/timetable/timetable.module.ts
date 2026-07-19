import { Module } from "@nestjs/common";
import { TimetableController } from "./timetable.controller";
import { TimetableSetupService } from "./timetable-setup.service";
import { TimetableGeneratorService } from "./timetable-generator.service";

@Module({
  controllers: [TimetableController],
  providers: [TimetableSetupService, TimetableGeneratorService],
  exports: [TimetableSetupService, TimetableGeneratorService],
})
export class TimetableModule {}
