import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import {
  clearQuizAnswersSchema,
  createQuizSchema,
  gradeQuizAnswerSchema,
  quizLinkOpenedSchema,
  saveQuizAnswersSchema,
  startQuizAttemptSchema,
  submitQuizAttemptSchema,
  updateQuizBuilderSchema,
  UserRole,
  verifyQuizAccessSchema,
} from "@ekulmis/shared";
import { QuizService } from "./quiz.service";
import { Roles } from "../auth/roles.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/auth.types";
import { Public } from "../auth/public.decorator";
import { CurrentTenant } from "../tenant/current-tenant.decorator";
import type { TenantContext } from "@ekulmis/shared";

@Controller("quiz")
export class QuizController {
  constructor(private readonly quiz: QuizService) {}

  @Get()
  async list(
    @CurrentUser() me: AuthUser,
    @Query("academicYearId") academicYearId?: string,
    @Query("classId") classId?: string,
  ) {
    let teacherId: string | undefined;
    if (me.role === "TEACHER") {
      teacherId = await this.quiz.resolveTeacherId(me.schoolId, me.userId);
    }
    return this.quiz.list(me.schoolId, { academicYearId, classId, teacherId });
  }

  @Get("dashboard")
  async dashboard(@CurrentUser() me: AuthUser) {
    let teacherId: string | undefined;
    if (me.role === "TEACHER") {
      teacherId = await this.quiz.resolveTeacherId(me.schoolId, me.userId);
    }
    return this.quiz.dashboard(me.schoolId, { teacherId });
  }

  @Roles(UserRole.ADMINISTRATOR, UserRole.EXAM_MANAGER, UserRole.ACADEMIC_MANAGER)
  @Get("monitoring")
  monitoring(@CurrentUser() me: AuthUser) {
    return this.quiz.monitoring(me.schoolId);
  }

  @Roles(UserRole.ADMINISTRATOR, UserRole.TEACHER, UserRole.EXAM_MANAGER)
  @Post()
  create(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    const parsed = createQuizSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.quiz.create(me.schoolId, parsed.data, {
      userId: me.userId,
      role: me.role,
    });
  }

  @Get("student/:studentId/attempts")
  studentAttempts(
    @CurrentUser() me: AuthUser,
    @Param("studentId") studentId: string,
  ) {
    return this.quiz.studentAttempts(me.schoolId, studentId);
  }

  @Public()
  @Get("code/:code/landing")
  landing(@CurrentTenant() tenant: TenantContext, @Param("code") code: string) {
    return this.quiz.getLanding(tenant.schoolId, code);
  }

  @Public()
  @Post("link-opened")
  linkOpened(@CurrentTenant() tenant: TenantContext, @Body() body: unknown) {
    const parsed = quizLinkOpenedSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.quiz.recordLinkOpened(tenant.schoolId, parsed.data);
  }

  @Public()
  @Post("verify-access")
  verifyAccess(@CurrentTenant() tenant: TenantContext, @Body() body: unknown) {
    const parsed = verifyQuizAccessSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.quiz.verifyAccess(tenant.schoolId, parsed.data);
  }

  @Public()
  @Get("code/:code")
  byCode(@CurrentTenant() tenant: TenantContext, @Param("code") code: string) {
    return this.quiz.getByCode(tenant.schoolId, code);
  }

  @Public()
  @Post("attempt/start")
  startAttempt(@CurrentTenant() tenant: TenantContext, @Body() body: unknown) {
    const parsed = startQuizAttemptSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.quiz.startAttempt(tenant.schoolId, parsed.data);
  }

  @Public()
  @Patch("attempt/save")
  saveAnswers(@CurrentTenant() tenant: TenantContext, @Body() body: unknown) {
    const parsed = saveQuizAnswersSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.quiz.saveAnswers(tenant.schoolId, parsed.data);
  }

  @Public()
  @Post("attempt/clear")
  clearAnswers(@CurrentTenant() tenant: TenantContext, @Body() body: unknown) {
    const parsed = clearQuizAnswersSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.quiz.clearAnswers(tenant.schoolId, parsed.data);
  }

  @Public()
  @Post("attempt")
  attempt(@CurrentTenant() tenant: TenantContext, @Body() body: unknown) {
    const parsed = submitQuizAttemptSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.quiz.submitAttempt(tenant.schoolId, parsed.data);
  }

  @Public()
  @Get("attempts/:attemptId/review")
  reviewPublic(
    @CurrentTenant() tenant: TenantContext,
    @Param("attemptId") attemptId: string,
  ) {
    return this.quiz.getAttemptReview(tenant.schoolId, attemptId, { public: true });
  }

  @Roles(UserRole.ADMINISTRATOR, UserRole.TEACHER, UserRole.EXAM_MANAGER)
  @Patch(":id/builder")
  updateBuilder(
    @CurrentUser() me: AuthUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const parsed = updateQuizBuilderSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.quiz.updateBuilder(me.schoolId, id, parsed.data, {
      userId: me.userId,
      role: me.role,
    });
  }

  @Roles(UserRole.ADMINISTRATOR, UserRole.TEACHER, UserRole.EXAM_MANAGER)
  @Patch(":id/publish")
  async publish(@CurrentUser() me: AuthUser, @Param("id") id: string) {
    if (me.role === "TEACHER") {
      await this.quiz.assertOwnsQuiz(me.schoolId, me.userId, id);
    }
    return this.quiz.publish(me.schoolId, id);
  }

  @Roles(UserRole.ADMINISTRATOR, UserRole.TEACHER, UserRole.EXAM_MANAGER)
  @Patch(":id/close")
  async close(@CurrentUser() me: AuthUser, @Param("id") id: string) {
    if (me.role === "TEACHER") {
      await this.quiz.assertOwnsQuiz(me.schoolId, me.userId, id);
    }
    return this.quiz.close(me.schoolId, id);
  }

  @Roles(UserRole.ADMINISTRATOR, UserRole.EXAM_MANAGER, UserRole.ACADEMIC_MANAGER)
  @Patch(":id/archive")
  archive(@CurrentUser() me: AuthUser, @Param("id") id: string) {
    return this.quiz.archive(me.schoolId, id);
  }

  @Roles(UserRole.ADMINISTRATOR, UserRole.TEACHER, UserRole.EXAM_MANAGER)
  @Get(":id/live")
  async liveMonitoring(@CurrentUser() me: AuthUser, @Param("id") id: string) {
    if (me.role === "TEACHER") {
      await this.quiz.assertOwnsQuiz(me.schoolId, me.userId, id);
    }
    return this.quiz.liveMonitoring(me.schoolId, id);
  }

  @Roles(UserRole.ADMINISTRATOR, UserRole.TEACHER, UserRole.EXAM_MANAGER)
  @Get(":id/students/:studentId/timeline")
  async timeline(
    @CurrentUser() me: AuthUser,
    @Param("id") id: string,
    @Param("studentId") studentId: string,
  ) {
    if (me.role === "TEACHER") {
      await this.quiz.assertOwnsQuiz(me.schoolId, me.userId, id);
    }
    return this.quiz.getStudentTimeline(me.schoolId, id, studentId);
  }

  @Roles(UserRole.ADMINISTRATOR, UserRole.TEACHER, UserRole.EXAM_MANAGER)
  @Get(":id/attempts")
  async attempts(@CurrentUser() me: AuthUser, @Param("id") id: string) {
    if (me.role === "TEACHER") {
      await this.quiz.assertOwnsQuiz(me.schoolId, me.userId, id);
    }
    return this.quiz.listAttempts(me.schoolId, id);
  }

  @Roles(UserRole.ADMINISTRATOR, UserRole.TEACHER, UserRole.EXAM_MANAGER)
  @Get("attempts/:attemptId/result")
  async attemptResult(
    @CurrentUser() me: AuthUser,
    @Param("attemptId") attemptId: string,
  ) {
    return this.quiz.getAttemptReview(me.schoolId, attemptId);
  }

  @Roles(UserRole.ADMINISTRATOR, UserRole.TEACHER, UserRole.EXAM_MANAGER)
  @Get(":id")
  async getOne(@CurrentUser() me: AuthUser, @Param("id") id: string) {
    if (me.role === "TEACHER") {
      await this.quiz.assertOwnsQuiz(me.schoolId, me.userId, id);
    }
    return this.quiz.getById(me.schoolId, id);
  }

  @Roles(UserRole.ADMINISTRATOR, UserRole.TEACHER, UserRole.EXAM_MANAGER)
  @Patch("attempts/:attemptId/answers/:answerId/grade")
  gradeAnswer(
    @CurrentUser() me: AuthUser,
    @Param("attemptId") attemptId: string,
    @Param("answerId") answerId: string,
    @Body() body: unknown,
  ) {
    const parsed = gradeQuizAnswerSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.quiz.gradeAnswer(
      me.schoolId,
      attemptId,
      answerId,
      parsed.data,
      { userId: me.userId, role: me.role },
    );
  }
}
