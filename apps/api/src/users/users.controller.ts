import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
} from "@nestjs/common";
import {
  ASSIGNABLE_STAFF_ROLES,
  createUserSchema,
  resetPasswordSchema,
  updateUserSchema,
  UserRole,
} from "@ekulmis/shared";
import { UsersService } from "./users.service";
import { AttendanceScopeService } from "../attendance/attendance-scope.service";
import { attendanceAssignmentsSchema } from "@ekulmis/shared";
import { Roles } from "../auth/roles.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/auth.types";
import { RequirePermission } from "../auth/require-permission.decorator";

/** User Management (Module 15). Administrator-only, tenant-scoped. */
@Roles(UserRole.ADMINISTRATOR)
@Controller("users")
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly scope: AttendanceScopeService,
  ) {}

  /**
   * Which classes this person covers.
   *
   * Scope stopped being an attendance idea when it began deciding fee lists
   * and student directories, so it belongs where a school manages the person
   * rather than behind the officers screen — and it is user administration,
   * which is why it asks for users.update rather than attendance.approve.
   *
   * The same grants either way: one screen writing them under a different
   * name would be two answers to one question, which is the fault this whole
   * change exists to stop.
   */
  @RequirePermission("users.view")
  @Get(":id/scope")
  scopeFor(@CurrentUser() me: AuthUser, @Param("id") id: string) {
    return this.scope.assignmentsFor(me.schoolId, id);
  }

  /**
   * Replace what this person covers. An empty list means the whole school for
   * a role that is not scoped by its nature, and nothing at all for one that
   * is — the same rule ScopeService applies when reading it back.
   */
  @RequirePermission("users.update")
  @Put(":id/scope")
  async setScope(
    @CurrentUser() me: AuthUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const parsed = attendanceAssignmentsSchema.safeParse({
      userId: id,
      assignments: (body as { assignments?: unknown })?.assignments ?? [],
    });
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.scope.setAssignments(
      me.schoolId,
      id,
      parsed.data.assignments,
      { userId: me.userId },
    );
  }

  @RequirePermission("users.create")
  @Post()
  create(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    const parsed = createUserSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    if (!ASSIGNABLE_STAFF_ROLES.includes(parsed.data.role)) {
      throw new BadRequestException(
        "This role cannot be assigned through User Management.",
      );
    }
    return this.users.create(me.schoolId, parsed.data);
  }

  @RequirePermission("users.view")
  @Get()
  findAll(@CurrentUser() me: AuthUser) {
    return this.users.findAll(me.schoolId);
  }

  @RequirePermission("users.view")
  @Get(":id")
  findOne(@CurrentUser() me: AuthUser, @Param("id") id: string) {
    return this.users.findOne(me.schoolId, id);
  }

  @RequirePermission("users.update")
  @Patch(":id")
  update(
    @CurrentUser() me: AuthUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const parsed = updateUserSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    if (
      parsed.data.role !== undefined &&
      !ASSIGNABLE_STAFF_ROLES.includes(parsed.data.role)
    ) {
      throw new BadRequestException(
        "This role cannot be assigned through User Management.",
      );
    }
    return this.users.update(me.schoolId, id, parsed.data);
  }

  @RequirePermission("users.update")
  @Post(":id/reset-password")
  resetPassword(
    @CurrentUser() me: AuthUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const parsed = resetPasswordSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.users.resetPassword(me.schoolId, id, parsed.data.newPassword);
  }

  @RequirePermission("users.delete", "users.update")
  @Delete(":id")
  remove(@CurrentUser() me: AuthUser, @Param("id") id: string) {
    if (id === me.userId) {
      throw new BadRequestException("You cannot delete your own account");
    }
    return this.users.remove(me.schoolId, id);
  }
}
