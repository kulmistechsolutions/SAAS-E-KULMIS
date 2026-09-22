import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import {
  createQuestionBankItemSchema,
  questionBankFromQuizSchema,
  questionBankListSchema,
  questionBankUseSchema,
  updateQuestionBankItemSchema,
  UserRole,
} from "@ekulmis/shared";
import { Roles } from "../auth/roles.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/auth.types";
import { RequirePermission } from "../auth/require-permission.decorator";
import { QuestionBankService } from "./question-bank.service";

const STAFF = [
  UserRole.ADMINISTRATOR,
  UserRole.TEACHER,
  UserRole.EXAM_MANAGER,
  UserRole.ACADEMIC_MANAGER,
] as const;

/**
 * The question bank. Everything runs as the signed-in person, in their own
 * school: a teacher sees their own questions and shared ones and changes only
 * their own; the service decides that, not the route.
 */
@Controller("quiz-bank")
export class QuestionBankController {
  constructor(private readonly bank: QuestionBankService) {}

  private who(me: AuthUser) {
    return { userId: me.userId, role: me.role, username: me.username };
  }

  @Roles(...STAFF)
  @RequirePermission("quiz.view")
  @Get()
  list(@CurrentUser() me: AuthUser, @Query() query: Record<string, string>) {
    const parsed = questionBankListSchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.bank.list(me.schoolId, this.who(me), parsed.data);
  }

  /** Declared before any :id route, so "options" is never read as an id. */
  @Roles(...STAFF)
  @RequirePermission("quiz.view")
  @Get("options")
  options(@CurrentUser() me: AuthUser) {
    return this.bank.options(me.schoolId, this.who(me));
  }

  @Roles(...STAFF)
  @RequirePermission("quiz.create")
  @Post()
  create(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    const parsed = createQuestionBankItemSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.bank.create(me.schoolId, this.who(me), parsed.data);
  }

  @Roles(...STAFF)
  @RequirePermission("quiz.create")
  @Post("from-quiz")
  fromQuiz(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    const parsed = questionBankFromQuizSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.bank.fromQuiz(me.schoolId, this.who(me), parsed.data);
  }

  @Roles(...STAFF)
  @RequirePermission("quiz.view")
  @Post("use")
  use(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    const parsed = questionBankUseSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.bank.use(me.schoolId, this.who(me), parsed.data);
  }

  @Roles(...STAFF)
  @RequirePermission("quiz.update")
  @Patch(":id")
  update(
    @CurrentUser() me: AuthUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const parsed = updateQuestionBankItemSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.bank.update(me.schoolId, this.who(me), id, parsed.data);
  }

  @Roles(...STAFF)
  @RequirePermission("quiz.update")
  @Delete(":id")
  archive(@CurrentUser() me: AuthUser, @Param("id") id: string) {
    return this.bank.archive(me.schoolId, this.who(me), id);
  }
}
