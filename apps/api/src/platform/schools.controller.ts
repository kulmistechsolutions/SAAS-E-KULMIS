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
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  createSchoolSchema,
  resetPasswordSchema,
  setSchoolTrialSchema,
  updateSchoolSchema,
} from "@ekulmis/shared";
import { SchoolsService } from "./schools.service";
import { PlatformGuard } from "./platform.guard";
import { Public } from "../auth/public.decorator";
import { z } from "zod";
import { SchoolSignInService } from "./school-sign-in.service";
import { CurrentPlatformAdmin } from "./current-platform-admin.decorator";
import type { PlatformAdminCtx } from "./platform.types";

/** School (tenant) management — Super Admin only. */
@Public() // bypass the school JwtAuthGuard; PlatformGuard enforces platform auth
@UseGuards(PlatformGuard)
@Controller("platform/schools")
export class SchoolsController {
  constructor(
    private readonly schools: SchoolsService,
    private readonly signInAs: SchoolSignInService,
  ) {}

  @Get()
  findAll() {
    return this.schools.findAll();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.schools.findOne(id);
  }

  /**
   * Sign in to a school as its administrator, to help them.
   *
   * The alternative was asking the school for its password, which teaches
   * schools that giving their password to someone claiming to be support is
   * normal — and left a school locked out by an expired plan unhelpable.
   *
   * A reason is required and goes into the SCHOOL'S OWN audit trail as well as
   * the platform's, so the school can see that this happened and why. Support
   * a customer cannot see is surveillance.
   */
  @Post(":id/sign-in")
  signIn(
    @CurrentPlatformAdmin() admin: PlatformAdminCtx,
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() req: { ip?: string },
  ) {
    const parsed = z
      .object({ reason: z.string().min(5).max(300) })
      .safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.signInAs.signInAs(id, admin, parsed.data.reason, {
      ip: req.ip ?? null,
    });
  }

  @Post()
  create(@Body() body: unknown) {
    const parsed = createSchoolSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.schools.create(parsed.data);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() body: unknown) {
    const parsed = updateSchoolSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.schools.update(id, parsed.data);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.schools.remove(id);
  }

  /** Grant, extend or end a free trial. Days count from now. */
  @Post(":id/trial")
  setTrial(@Param("id") id: string, @Body() body: unknown) {
    const parsed = setSchoolTrialSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.schools.setTrial(id, parsed.data.trialDays);
  }

  /** The school's staff logins — used to pick who to reset. */
  @Get(":id/users")
  listUsers(@Param("id") id: string) {
    return this.schools.listSchoolUsers(id);
  }

  /** Sign-in trail for one school: who signed in, when, and what failed. */
  @Get(":id/login-activity")
  loginActivity(@Param("id") id: string, @Query("limit") limit?: string) {
    const n = Number(limit);
    return this.schools.schoolLoginActivity(
      id,
      Number.isFinite(n) && n > 0 ? n : 100,
    );
  }

  /** Recover a locked-out school admin. Touches only the password. */
  @Post(":id/users/:userId/reset-password")
  resetUserPassword(
    @Param("id") id: string,
    @Param("userId") userId: string,
    @Body() body: unknown,
  ) {
    const parsed = resetPasswordSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.schools.resetSchoolUserPassword(
      id,
      userId,
      parsed.data.newPassword,
    );
  }
}
