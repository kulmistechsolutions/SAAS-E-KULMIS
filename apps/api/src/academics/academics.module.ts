import { Module } from "@nestjs/common";
import { AcademicStructureController } from "./academic-structure.controller";
import { AcademicStructureService } from "./academic-structure.service";
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

/**
 * Phase 2 — Academic structure: AcademicYear → Class → Section, and Subjects.
 *
 * AcademicStructure adds the optional Level and Stage tiers a school can put
 * above its classes when the default Grade 1–12 ladder does not fit.
 */
@Module({
  controllers: [
    AcademicYearController,
    ClassController,
    SectionController,
    SubjectController,
    ClassSubjectController,
    AcademicStructureController,
  ],
  providers: [
    AcademicYearService,
    ClassStructureService,
    ClassService,
    SectionService,
    SubjectService,
    ClassSubjectService,
    AcademicStructureService,
  ],
  exports: [
    AcademicYearService,
    ClassStructureService,
    ClassService,
    SectionService,
    SubjectService,
    ClassSubjectService,
    AcademicStructureService,
  ],
})
export class AcademicsModule {}
