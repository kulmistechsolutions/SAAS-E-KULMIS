import { Module } from "@nestjs/common";
import { AcademicYearController } from "./academic-year.controller";
import { AcademicYearService } from "./academic-year.service";
import { ClassController } from "./class.controller";
import { ClassService } from "./class.service";
import { ClassStructureService } from "./class-structure.service";
import { ClassSubjectController } from "./class-subject.controller";
import { ClassSubjectService } from "./class-subject.service";
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
    ClassSubjectController,
  ],
  providers: [
    AcademicYearService,
    ClassStructureService,
    ClassService,
    SectionService,
    SubjectService,
    ClassSubjectService,
  ],
  exports: [
    AcademicYearService,
    ClassStructureService,
    ClassService,
    SectionService,
    SubjectService,
    ClassSubjectService,
  ],
})
export class AcademicsModule {}
