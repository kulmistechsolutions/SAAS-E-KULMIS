import { Module } from "@nestjs/common";
import { AcademicYearController } from "./academic-year.controller";
import { AcademicYearService } from "./academic-year.service";
import { ClassController } from "./class.controller";
import { ClassService } from "./class.service";
import { SectionController } from "./section.controller";
import { SectionService } from "./section.service";
import { SubjectController } from "./subject.controller";
import { SubjectService } from "./subject.service";

/** Phase 2 — Academic structure: AcademicYear → Class → Section, and Subjects. */
@Module({
  controllers: [
    AcademicYearController,
    ClassController,
    SectionController,
    SubjectController,
  ],
  providers: [
    AcademicYearService,
    ClassService,
    SectionService,
    SubjectService,
  ],
  exports: [
    AcademicYearService,
    ClassService,
    SectionService,
    SubjectService,
  ],
})
export class AcademicsModule {}
