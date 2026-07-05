import { Module } from "@nestjs/common";
import { TeachersController } from "./teachers.controller";
import { TeachersService } from "./teachers.service";
import { TeacherAssignmentsController } from "./teacher-assignments.controller";
import { TeacherAssignmentsService } from "./teacher-assignments.service";

/** Teacher Management (Module 3) + Teacher Assignment (Module 4). */
@Module({
  controllers: [TeachersController, TeacherAssignmentsController],
  providers: [TeachersService, TeacherAssignmentsService],
  exports: [TeachersService, TeacherAssignmentsService],
})
export class TeachersModule {}
