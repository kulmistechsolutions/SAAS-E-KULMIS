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
  async visibleClassIds(
    schoolId: string,
    userId: string,
    role: string,
  ): Promise<string[] | null> {
    // The people handing out the grants are not held by them.
    if (role === "ADMINISTRATOR" || role === "SUPER_ADMINISTRATOR") return null;

    const grants = await this.prisma.forTenant(schoolId, (tx) =>
      tx.attendanceAssignment.findMany({
        where: { userId },
        select: { classId: true },
        distinct: ["classId"],
      }),
    );
    if (grants.length > 0) return grants.map((g) => g.classId);
    return this.inherentlyScoped(role) ? [] : null;
  }

  /**
   * A Prisma `where` fragment for a student query, given the scope.
   *
   * Written here rather than at each call site because the empty case is easy
   * to get wrong: a scope of nothing has to match nothing, and `{ classId: {
   * in: [] } }` is the only shape that does.
   */
  studentWhere(classIds: string[] | null): { classId?: { in: string[] } } {
    return classIds === null ? {} : { classId: { in: classIds } };
  }

  /** Whether one class is inside the scope. Null scope admits every class. */
  covers(classIds: string[] | null, classId: string | null): boolean {
    if (classIds === null) return true;
    return !!classId && classIds.includes(classId);
  }
}
