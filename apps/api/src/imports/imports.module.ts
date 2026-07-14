import { Module } from "@nestjs/common";
import { ImportsController } from "./imports.controller";
import { ImportsService } from "./imports.service";
import { StudentsModule } from "../students/students.module";

@Module({
  imports: [StudentsModule],
  controllers: [ImportsController],
  providers: [ImportsService],
})
export class ImportsModule {}
