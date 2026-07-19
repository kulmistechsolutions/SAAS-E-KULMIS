import { Module } from "@nestjs/common";
import { ExaminationsController } from "./examinations.controller";
import { MarksImportController } from "./marks-import.controller";
import { MarksImportService } from "./marks-import.service";
import { ExaminationsService } from "./examinations.service";
import { TeachersModule } from "../teachers/teachers.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { SmsModule } from "../sms/sms.module";

@Module({
  imports: [TeachersModule, NotificationsModule, SmsModule],
  controllers: [ExaminationsController, MarksImportController],
  providers: [ExaminationsService, MarksImportService],
  exports: [ExaminationsService, MarksImportService],
})
export class ExaminationsModule {}
