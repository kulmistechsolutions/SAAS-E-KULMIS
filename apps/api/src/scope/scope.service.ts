import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Which classes a person may act within.
 *
 * A permission says *what* someone may do; this says *to whom*. An attendance
 * officer granted `attendance.create` is not thereby allowed to mark the whole
 * school — they were given Grade 6, 7 and 8, and the register for Grade 9 is
 * somebody else's. That second half existed only inside the attendance module,
 * hard-wired to one role, so no other module could ask the question.
 *
 * It is the same table either way: an assignment names a class, optionally
 * narrowed to a section and a shift. Null widens rather than restricts —
 * "Grade 1" with no section covers all of Grade 1 — because that is how
 * schools hand the work out, and making them enumerate sections would be
 * tedious without being any safer.
 *
 * Three answers, and the difference between the last two matters:
 *
 *   - A role that is scoped by its nature — an officer, a teacher — is always
 *     held to its assignments, and holding none means reaching nothing. An
 *     officer nobody has given a class to must not see the school.
 *   - Any other role becomes scoped the moment a school gives it assignments.
 *     That is how a school says "this finance officer handles Grade 8 only".
 *   - A role with no assignments and no inherent scope reaches the whole
 *     school, which is what every role does today and what an administrator
 *     must keep doing.
 */
/**
 * One grant: a class, optionally narrowed to a section.
 *
 * A null section widens rather than restricts — "Grade 8" with no section is
 * all of Grade 8 — because that is how schools hand the work out.
 */
export interface ScopeGrant {
  classId: string;
  sectionId: string | null;
}

@Injectable()
export class ScopeService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Roles whose reach is defined by their assignments even when they have
   * none. Adding a role here narrows it; leaving one out does not widen it,
   * because a school can still scope it by handing out assignments.
   */
  private inherentlyScoped(role: string): boolean {
    return role === "ATTENDANCE_OFFICER" || role === "TEACHER";
  }

  /**
   * The class ids this user may act within, or null for the whole school.
   *
   * Null and `[]` are different answers and callers must keep them apart:
   * null is "no restriction", `[]` is "restricted to nothing". Collapsing them
   * is how a scoped user with no grants would come to see everything.
   */
  /**
   * Everything this user may act within, class and section, or null for the
   * whole school.
   */
  async visibleScope(
    schoolId: string,
    userId: string,
    role: string,
  ): Promise<ScopeGrant[] | null> {
    // The people handing out the grants are not held by them.
    if (role === "ADMINISTRATOR" || role === "SUPER_ADMINISTRATOR") return null;

    const rows = await this.prisma.forTenant(schoolId, (tx) =>
      tx.attendanceAssignment.findMany({
        where: { userId },
        select: { classId: true, sectionId: true },
      }),
    );
    if (rows.length > 0) {
      // A grant on the whole class swallows any narrower grant on a section
      // of it — otherwise "Grade 8" plus "Grade 8 Section A" would read as
      // Section A only, which is the opposite of what was handed out.
      const wholeClasses = new Set(
        rows.filter((r) => r.sectionId === null).map((r) => r.classId),
      );
      return rows.filter(
        (r) => r.sectionId === null || !wholeClasses.has(r.classId),
      );
    }
    return this.inherentlyScoped(role) ? [] : null;
  }

  async visibleClassIds(
    schoolId: string,
    userId: string,
    role: string,
  ): Promise<string[] | null> {
    const scope = await this.visibleScope(schoolId, userId, role);
    if (scope === null) return null;
    return [...new Set(scope.map((g) => g.classId))];
  }

  /**
   * A Prisma `where` fragment for a student query, given the scope.
   *
   * Written here rather than at each call site because the empty case is easy
   * to get wrong: a scope of nothing has to match nothing, and `{ classId: {
   * in: [] } }` is the only shape that does.
   */
  studentWhere(scope: ScopeGrant[] | string[] | null): Record<string, unknown> {
    if (scope === null) return {};
    if (scope.length === 0) return { classId: { in: [] } };
    if (typeof scope[0] === "string") {
      return { classId: { in: scope as string[] } };
    }
    return {
      OR: (scope as ScopeGrant[]).map((g) =>
        g.sectionId === null
          ? { classId: g.classId }
          : { classId: g.classId, sectionId: g.sectionId },
      ),
    };
  }

  /**
   * Whether one student's class and section are inside the scope.
   *
   * A grant with no section covers the whole class; a grant with one covers
   * only that section.
   */
  covers(
    scope: ScopeGrant[] | string[] | null,
    classId: string | null,
    sectionId?: string | null,
  ): boolean {
    if (scope === null) return true;
    if (!classId) return false;
    if (scope.length === 0) return false;
    if (typeof scope[0] === "string") {
      return (scope as string[]).includes(classId);
    }
    return (scope as ScopeGrant[]).some(
      (g) =>
        g.classId === classId &&
        (g.sectionId === null || g.sectionId === (sectionId ?? null)),
    );
  }
}
