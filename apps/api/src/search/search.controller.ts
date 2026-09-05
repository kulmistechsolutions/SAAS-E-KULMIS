import { Controller, Get, Query } from "@nestjs/common";
import { UserRole } from "@ekulmis/shared";
import { SearchService, searchableTypesForRole } from "./search.service";
import { Roles } from "../auth/roles.decorator";
import { STAFF_ROLES } from "../auth/role-groups";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/auth.types";
import { AttendanceScopeService } from "../attendance/attendance-scope.service";
import { TeachersService } from "../teachers/teachers.service";

/**
 * Global search — staff only, and only as far as the searcher's own pages go.
 *
 * The fences that keep an attendance officer to their assigned registers and
 * a teacher to their own class live on the pages. A search box that ignored
 * them was a way around every one of them, so the same two limits are applied
 * here before anything is read.
 */
@Roles(...STAFF_ROLES)
@Controller("search")
export class SearchController {
  constructor(
    private readonly search: SearchService,
    private readonly scope: AttendanceScopeService,
    private readonly teachers: TeachersService,
  ) {}

  @Get()
  async searchAll(
    @CurrentUser() me: AuthUser,
    @Query("q") q = "",
    @Query("type") type?: string,
    @Query("limit") limit?: string,
  ) {
    const allowed = searchableTypesForRole(me.role);
    if (allowed.length === 0) return [];
    // An explicit ?type= narrows what the role may already see; it never widens it.
    const types = type
      ? allowed.filter((t) => t === type)
      : allowed;
    if (types.length === 0) return [];

    // A teacher sees the children they teach; an officer, the classes they
    // were assigned. Everyone else is unrestricted within the types above.
    let studentIds: string[] | null = null;
    let classIds: string[] | null = null;
    if (me.role === UserRole.TEACHER) {
      // Most teacher accounts were never granted "view students". Such a
      // teacher has nobody to find, which is an empty answer rather than a
      // refusal — letting the refusal through would have broken the search
      // box for them instead of narrowing it.
      studentIds = await this.teachers
        .myStudents(me.schoolId, me.userId)
        .then((mine) => mine.map((s) => s.id))
        .catch(() => []);
    } else {
      classIds = await this.scope.visibleClassIds(
        me.schoolId,
        me.userId,
        me.role,
      );
    }

    return this.search.search(me.schoolId, q, {
      types,
      limit: limit ? Number(limit) : 20,
      classIds,
      studentIds,
    });
  }
}
