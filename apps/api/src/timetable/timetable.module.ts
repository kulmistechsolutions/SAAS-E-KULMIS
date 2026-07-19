import { Module } from "@nestjs/common";
import { TimetableController } from "./timetable.controller";
import { TimetableSetupService } from "./timetable-setup.service";
import { TimetableGeneratorService } from "./timetable-generator.service";
import { TimetablePdfService } from "./timetable-pdf.service";
import { TimetableViewService } from "./timetable-view.service";
import { TimetableAiService } from "./timetable-ai.service";
import { AiModule } from "../ai/ai.module";

@Module({
  imports: [AiModule],
  controllers: [TimetableController],
  providers: [
    TimetableSetupService,
    TimetableGeneratorService,
    TimetablePdfService,
    TimetableViewService,
    TimetableAiService,
  ],
  exports: [
    TimetableSetupService,
    TimetableGeneratorService,
    TimetableViewService,
  ],
})
export class TimetableModule {}
