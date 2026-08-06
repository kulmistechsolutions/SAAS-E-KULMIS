import { Module } from "@nestjs/common";
import { StudentAttendanceController } from "./student-attendance.controller";
import { StudentAttendanceService } from "./student-attendance.service";
import { TeacherAttendanceController } from "./teacher-attendance.controller";
import { TeacherAttendanceService } from "./teacher-attendance.service";
import { AttendanceShiftsController } from "./attendance-shifts.controller";
import { AttendanceShiftsService } from "./attendance-shifts.service";
import { TeachersModule } from "../teachers/teachers.module";

/** Phase 3 — Student Attendance (Module 5) + Teacher Attendance (Module 6). */
@Module({
  imports: [TeachersModule],
  controllers: [
    StudentAttendanceController,
    TeacherAttendanceController,
    AttendanceShiftsController,
  ],
  providers: [
    StudentAttendanceService,
    TeacherAttendanceService,
    AttendanceShiftsService,
  ],
  exports: [StudentAttendanceService, TeacherAttendanceService],
})
export class AttendanceModule {}
