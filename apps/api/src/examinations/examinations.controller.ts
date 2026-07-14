import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from "@nestjs/common";
import type { Response } from "express";
import {
  blockStudentSchema,
  createExamGroupSchema,
  createExamSchema,
  examCreationBulkSchema,
  examSubmissionReminderSchema,
  publicResultLookupSchema,
  studentPortalPublishSchema,
  teacherLockSchema,
  updateExamStatusSchema,
  upsertExamMarksSchema,
  UserRole,
} from "@ekulmis/shared";
import { ExaminationsService } from "./examinations.service";
import { Roles } from "../auth/roles.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/auth.types";
import { Public } from "../auth/public.decorator";
import { CurrentTenant } from "../tenant/current-tenant.decorator";
import type { TenantContext } from "@ekulmis/shared";

@Controller("examinations")
export class ExaminationsController {
  constructor(private readonly exams: ExaminationsService) {}

  @Get("dashboard")
  dashboard(@CurrentUser() me: AuthUser) {
    return this.exams.dashboard(me.schoolId);
  }

  @Get("groups")
  listGroups(
    @CurrentUser() me: AuthUser,
    @Query("academicYearId") academicYearId?: string,
  ) {
    return this.exams.listGroups(me.schoolId, academicYearId);
  }

  @Roles(UserRole.ADMINISTRATOR, UserRole.EXAM_MANAGER)
  @Post("groups")
  createGroup(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    const parsed = createExamGroupSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.exams.createGroup(me.schoolId, parsed.data);
  }

  @Get("monitoring")
  monitoring(
    @CurrentUser() me: AuthUser,
    @Query("examId") examId?: string,
  ) {
    return this.exams.monitoring(me.schoolId, examId);
  }

  @Roles(UserRole.ADMINISTRATOR, UserRole.EXAM_MANAGER)
  @Get("monitoring/classes")
  monitoringClasses(
    @CurrentUser() me: AuthUser,
    @Query("academicYearId") academicYearId?: string,
    @Query("examId") examId?: string,
  ) {
    return this.exams.monitoringClassesOverview(
      me.schoolId,
      academicYearId,
      examId,
    );
  }

  @Roles(UserRole.ADMINISTRATOR, UserRole.EXAM_MANAGER)
  @Get("monitoring/classes/:classId")
  monitoringClassDetail(
    @CurrentUser() me: AuthUser,
    @Param("classId") classId: string,
    @Query("academicYearId") academicYearId?: string,
    @Query("examId") examId?: string,
    @Query("sectionId") sectionId?: string,
  ) {
    return this.exams.monitoringClassDetail(me.schoolId, classId, {
      academicYearId,
      examId,
      sectionId,
    });
  }

  @Roles(UserRole.ADMINISTRATOR, UserRole.EXAM_MANAGER)
  @Post("monitoring/remind")
  sendReminder(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    const parsed = examSubmissionReminderSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.exams.sendSubmissionReminder(
      me.schoolId,
      parsed.data.examId,
      parsed.data.subjectId,
      { sms: parsed.data.sms, email: parsed.data.email },
      me,
    );
  }

  @Roles(UserRole.ADMINISTRATOR, UserRole.EXAM_MANAGER)
  @Get("results/matrix/export/pdf")
  @Header("Content-Type", "application/pdf")
  async exportResultsPdf(
    @CurrentUser() me: AuthUser,
    @Query("classId") classId: string,
    @Query("examId") examId: string,
    @Query("sectionId") sectionId: string | undefined,
    @Query("search") search: string | undefined,
    @Query("sortBy") sortBy: string | undefined,
    @Query("sortDir") sortDir: "asc" | "desc" | undefined,
    @Res() res: Response,
  ) {
    if (!classId || !examId) {
      throw new BadRequestException("classId and examId are required");
    }
    const { buffer, filename } = await this.exams.exportClassResultsPdf(
      me.schoolId,
      { classId, examId, sectionId, search, sortBy, sortDir },
      me.username,
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  @Roles(UserRole.ADMINISTRATOR, UserRole.EXAM_MANAGER)
  @Get("results/matrix/export/xlsx")
  @Header(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  )
  async exportResultsExcel(
    @CurrentUser() me: AuthUser,
    @Query("classId") classId: string,
    @Query("examId") examId: string,
    @Query("sectionId") sectionId: string | undefined,
    @Query("search") search: string | undefined,
    @Query("sortBy") sortBy: string | undefined,
    @Query("sortDir") sortDir: "asc" | "desc" | undefined,
    @Res() res: Response,
  ) {
    if (!classId || !examId) {
      throw new BadRequestException("classId and examId are required");
    }
    const { buffer, filename } = await this.exams.exportClassResultsExcel(
      me.schoolId,
      { classId, examId, sectionId, search, sortBy, sortDir },
      me.username,
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  @Roles(UserRole.ADMINISTRATOR, UserRole.EXAM_MANAGER)
  @Get("results/classes")
  resultsClasses(
    @CurrentUser() me: AuthUser,
    @Query("academicYearId") academicYearId?: string,
  ) {
    return this.exams.resultsClassesOverview(me.schoolId, academicYearId);
  }

  @Roles(UserRole.ADMINISTRATOR, UserRole.EXAM_MANAGER)
  @Get("results/matrix")
  classResultsMatrix(
    @CurrentUser() me: AuthUser,
    @Query("classId") classId: string,
    @Query("examId") examId: string,
    @Query("sectionId") sectionId?: string,
    @Query("search") search?: string,
    @Query("sortBy") sortBy?: string,
    @Query("sortDir") sortDir?: "asc" | "desc",
  ) {
    if (!classId || !examId) {
      throw new BadRequestException("classId and examId are required");
    }
    return this.exams.classResultsMatrix(me.schoolId, {
      classId,
      examId,
      sectionId,
      search,
      sortBy,
      sortDir,
    });
  }

  @Get("blocked")
  listBlocked(@CurrentUser() me: AuthUser) {
    return this.exams.listBlocked(me.schoolId);
  }

  @Roles(UserRole.ADMINISTRATOR, UserRole.EXAM_MANAGER)
  @Post("blocked")
  blockStudent(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    const parsed = blockStudentSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.exams.blockStudent(me.schoolId, parsed.data, me.userId);
  }

  @Roles(UserRole.ADMINISTRATOR, UserRole.EXAM_MANAGER, UserRole.TEACHER)
  @Post("marks")
  upsertMarks(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    const parsed = upsertExamMarksSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.exams.upsertMarks(me.schoolId, parsed.data, me.userId, me.role);
  }

  @Get("results/:studentId")
  studentResults(
    @CurrentUser() me: AuthUser,
    @Param("studentId") studentId: string,
    @Query("academicYearId") academicYearId?: string,
  ) {
    return this.exams.studentResults(me.schoolId, studentId, academicYearId);
  }

  @Get("results/:studentId/transcript/pdf")
  @Header("Content-Type", "application/pdf")
  async transcriptPdf(
    @CurrentUser() me: AuthUser,
    @Param("studentId") studentId: string,
    @Query("academicYearId") academicYearId: string | undefined,
    @Res() res: Response,
  ) {
    const buf = await this.exams.transcriptPdf(
      me.schoolId,
      studentId,
      academicYearId,
    );
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="transcript.pdf"',
    );
    res.send(buf);
  }

  @Public()
  @Post("public-results")
  publicResults(@CurrentTenant() tenant: TenantContext, @Body() body: unknown) {
    const parsed = publicResultLookupSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.exams.publicResultByCode(
      tenant.schoolId,
      parsed.data.code,
      parsed.data.academicYear,
    );
  }

  @Get()
  async listExams(
    @CurrentUser() me: AuthUser,
    @Query("academicYearId") academicYearId?: string,
    @Query("classId") classId?: string,
  ) {
    if (me.role === "TEACHER") {
      const teacher = await this.exams.resolveTeacherForUser(
        me.schoolId,
        me.userId,
      );
      const classIds = [
        ...new Set(teacher.assignments.map((a) => a.classId)),
      ];
      if (classId && !classIds.includes(classId)) {
        return [];
      }
      const exams = await this.exams.listExams(me.schoolId, {
        academicYearId,
        classId,
        classIds: classId ? undefined : classIds,
      });
      return exams.filter((exam) =>
        teacher.assignments.some(
          (a) =>
            a.classId === exam.classId &&
            (a.sectionId === null ||
              exam.sectionId === null ||
              a.sectionId === exam.sectionId),
        ),
      );
    }
    return this.exams.listExams(me.schoolId, { academicYearId, classId });
  }

  @Roles(UserRole.ADMINISTRATOR, UserRole.EXAM_MANAGER)
  @Post("preview")
  previewBulk(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    const parsed = examCreationBulkSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.exams.previewBulkCreation(me.schoolId, parsed.data);
  }

  @Roles(UserRole.ADMINISTRATOR, UserRole.EXAM_MANAGER)
  @Post("bulk")
  createBulk(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    const parsed = examCreationBulkSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.exams.createExamsBulk(
      me.schoolId,
      parsed.data,
      me.userId,
      me.role,
    );
  }

  @Roles(UserRole.ADMINISTRATOR, UserRole.EXAM_MANAGER)
  @Post()
  createExam(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    const parsed = createExamSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.exams.createExam(
      me.schoolId,
      parsed.data,
      me.userId,
      me.role,
    );
  }

  @Get(":id")
  getExam(@CurrentUser() me: AuthUser, @Param("id") id: string) {
    return this.exams.getExam(me.schoolId, id);
  }

  @Get(":id/marks")
  getMarks(@CurrentUser() me: AuthUser, @Param("id") id: string) {
    return this.exams.getMarks(me.schoolId, id);
  }

  /** Students in the exam class/section for mark entry (no View Students permission). */
  @Roles(UserRole.ADMINISTRATOR, UserRole.EXAM_MANAGER, UserRole.TEACHER)
  @Get(":id/roster")
  examRoster(@CurrentUser() me: AuthUser, @Param("id") id: string) {
    return this.exams.examRoster(me.schoolId, id, me.userId, me.role);
  }

  /** Download an .xlsx mark-entry template for one exam + subject. */
  @Roles(UserRole.ADMINISTRATOR, UserRole.EXAM_MANAGER, UserRole.TEACHER)
  @Get(":id/marks/template")
  @Header(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  )
  async marksTemplate(
    @CurrentUser() me: AuthUser,
    @Param("id") id: string,
    @Query("subjectId") subjectId: string,
    @Res() res: Response,
  ) {
    if (!subjectId) throw new BadRequestException("subjectId is required");
    const { buffer, filename } = await this.exams.marksTemplate(
      me.schoolId,
      id,
      subjectId,
      me.userId,
      me.role,
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  /** Import a completed .xlsx marks template (base64 in body, like student import). */
  @Roles(UserRole.ADMINISTRATOR, UserRole.EXAM_MANAGER, UserRole.TEACHER)
  @Post(":id/marks/import")
  async importMarks(
    @CurrentUser() me: AuthUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const b = body as { subjectId?: string; file?: string };
    if (!b?.subjectId || !b.file) {
      throw new BadRequestException("subjectId and file (base64) are required");
    }
    const buf = Buffer.from(b.file, "base64");
    return this.exams.importMarks(
      me.schoolId,
      id,
      b.subjectId,
      buf,
      me.userId,
      me.role,
    );
  }

  @Roles(UserRole.ADMINISTRATOR, UserRole.EXAM_MANAGER, UserRole.TEACHER)
  @Post(":id/subjects/:subjectId/submit")
  submitSubject(
    @CurrentUser() me: AuthUser,
    @Param("id") id: string,
    @Param("subjectId") subjectId: string,
  ) {
    return this.exams.submitSubject(
      me.schoolId,
      id,
      subjectId,
      me.userId,
      me.role,
    );
  }

  @Roles(UserRole.ADMINISTRATOR, UserRole.EXAM_MANAGER)
  @Patch(":id/teacher-lock")
  teacherLock(
    @CurrentUser() me: AuthUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const parsed = teacherLockSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.exams.setTeacherLock(me.schoolId, id, parsed.data.locked, me);
  }

  @Roles(UserRole.ADMINISTRATOR, UserRole.EXAM_MANAGER)
  @Patch(":id/student-portal")
  studentPortal(
    @CurrentUser() me: AuthUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const parsed = studentPortalPublishSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.exams.setStudentPortalPublish(
      me.schoolId,
      id,
      parsed.data.published,
      me,
    );
  }

  @Roles(UserRole.ADMINISTRATOR, UserRole.EXAM_MANAGER)
  @Patch(":id/status")
  updateStatus(
    @CurrentUser() me: AuthUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const parsed = updateExamStatusSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.exams.updateExamStatus(me.schoolId, id, parsed.data.status);
  }

  @Roles(UserRole.ADMINISTRATOR, UserRole.EXAM_MANAGER)
  @Delete(":id")
  deleteExam(@CurrentUser() me: AuthUser, @Param("id") id: string) {
    return this.exams.deleteExam(me.schoolId, id);
  }

  @Roles(UserRole.ADMINISTRATOR, UserRole.EXAM_MANAGER)
  @Post(":id/publish")
  publishExam(@CurrentUser() me: AuthUser, @Param("id") id: string) {
    return this.exams.updateExamStatus(me.schoolId, id, "PUBLISHED");
  }
}
