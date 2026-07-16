import { Module } from "@nestjs/common";
import { TeachersController } from "./teachers.controller";
import { TeachersService } from "./teachers.service";
import { TeacherAssignmentsController } from "./teacher-assignments.controller";
import { TeacherAssignmentsService } from "./teacher-assignments.service";
import { SubscriptionsModule } from "../subscriptions/subscriptions.module";

/** Teacher Management (Module 3) + Teacher Assignment (Module 4). */
@Module({
  imports: [SubscriptionsModule],
  controllers: [TeachersController, TeacherAssignmentsController],
  providers: [TeachersService, TeacherAssignmentsService],
  exports: [TeachersService, TeacherAssignmentsService],
})
export class TeachersModule {}
