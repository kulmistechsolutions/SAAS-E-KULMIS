import { Module } from "@nestjs/common";
import { ExaminationsModule } from "../examinations/examinations.module";
import { FinanceModule } from "../finance/finance.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { TimetableModule } from "../timetable/timetable.module";
import { StudentsModule } from "../students/students.module";
import { ParentPortalController } from "./parent-portal.controller";
import { ParentPortalService } from "./parent-portal.service";

@Module({
  imports: [
    ExaminationsModule,
    FinanceModule,
    NotificationsModule,
    TimetableModule,
    StudentsModule,
  ],
  controllers: [ParentPortalController],
  providers: [ParentPortalService],
})
export class ParentPortalModule {}
