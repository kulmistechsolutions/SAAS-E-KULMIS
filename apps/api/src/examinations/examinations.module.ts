import { Module } from "@nestjs/common";
import { ExaminationsController } from "./examinations.controller";
import { ExaminationsService } from "./examinations.service";
import { TeachersModule } from "../teachers/teachers.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { SmsModule } from "../sms/sms.module";

@Module({
  imports: [TeachersModule, NotificationsModule, SmsModule],
  controllers: [ExaminationsController],
  providers: [ExaminationsService],
  exports: [ExaminationsService],
})
export class ExaminationsModule {}
