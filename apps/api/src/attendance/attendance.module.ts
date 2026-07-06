import { Module } from "@nestjs/common";
import { StudentAttendanceController } from "./student-attendance.controller";
import { StudentAttendanceService } from "./student-attendance.service";
import { TeacherAttendanceController } from "./teacher-attendance.controller";
import { TeacherAttendanceService } from "./teacher-attendance.service";

/** Phase 3 — Student Attendance (Module 5) + Teacher Attendance (Module 6). */
@Module({
  controllers: [StudentAttendanceController, TeacherAttendanceController],
  providers: [StudentAttendanceService, TeacherAttendanceService],
  exports: [StudentAttendanceService, TeacherAttendanceService],
})
export class AttendanceModule {}
