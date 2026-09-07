import { Module } from "@nestjs/common";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";
import { AttendanceModule } from "../attendance/attendance.module";

@Module({
  // Scope is set from the user's own page now, and the grants themselves are
  // still kept by the attendance module that first needed them. Importing it
  // here is what lets one screen write what every module reads.
  imports: [AttendanceModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
