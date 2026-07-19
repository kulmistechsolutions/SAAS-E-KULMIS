import { Module } from "@nestjs/common";
import { TimetableController } from "./timetable.controller";
import { TimetableSetupService } from "./timetable-setup.service";
import { TimetableGeneratorService } from "./timetable-generator.service";
import { TimetablePdfService } from "./timetable-pdf.service";
import { TimetableViewService } from "./timetable-view.service";

@Module({
  controllers: [TimetableController],
  providers: [
    TimetableSetupService,
    TimetableGeneratorService,
    TimetablePdfService,
    TimetableViewService,
  ],
  exports: [
    TimetableSetupService,
    TimetableGeneratorService,
    TimetableViewService,
  ],
})
export class TimetableModule {}
