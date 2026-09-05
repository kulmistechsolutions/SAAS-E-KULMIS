import { Global, Module } from "@nestjs/common";
import { PostgresSearchService } from "./postgres-search.service";
import { SearchController } from "./search.controller";
import { SearchService } from "./search.service";
import { AttendanceModule } from "../attendance/attendance.module";
import { TeachersModule } from "../teachers/teachers.module";

@Global()
@Module({
  // The search box reuses the very scoping the pages use, rather than
  // re-deriving it and getting it slightly different.
  imports: [AttendanceModule, TeachersModule],
  controllers: [SearchController],
  providers: [{ provide: SearchService, useClass: PostgresSearchService }],
  exports: [SearchService],
})
export class SearchModule {}
