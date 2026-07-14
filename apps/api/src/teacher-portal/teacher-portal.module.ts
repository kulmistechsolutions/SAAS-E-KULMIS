import { Module } from "@nestjs/common";
import { DashboardModule } from "../dashboard/dashboard.module";
import { ExaminationsModule } from "../examinations/examinations.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { TeachersModule } from "../teachers/teachers.module";
import { TeacherPortalController } from "./teacher-portal.controller";
import { TeacherPortalService } from "./teacher-portal.service";

@Module({
  imports: [TeachersModule, DashboardModule, ExaminationsModule, NotificationsModule],
  controllers: [TeacherPortalController],
  providers: [TeacherPortalService],
})
export class TeacherPortalModule {}
