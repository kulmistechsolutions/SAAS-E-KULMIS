import { ForbiddenException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

/**
 * What an attendance officer is allowed to reach.
 *
 * The role was granted the attendance module wholesale, so every officer could
 * open, take and change every register in the school. Hiding classes in the
 * interface would not have fixed that — the endpoints answered to anyone with
 * the role, and a URL was enough. So the check lives here, on the server, and
 * every attendance route asks it before doing anything.
 *
 * An assignment is a class, optionally narrowed to a section, optionally
 * narrowed to a shift. A null on either side widens rather than restricts:
 * "Grade 1" with no section covers all of Grade 1, and with no shift covers
 * every shift of it. Schools assign that way, and making them enumerate
 * sections would be tedious without being any safer.
 *
 * Administrators are not scoped. They are the ones handing out the grants, and
 * a school that cannot see its own registers cannot supervise the people
 * taking them.
 */
@Injectable()
export class AttendanceScopeService {
  constructor(private readonly prisma: PrismaService) {}

  /** Whether this role is subject to assignment scoping at all. */
  isScoped(role: string): boolean {
    return role === "ATTENDANCE_OFFICER";
  }

  /** Every grant this officer holds, with the names the screens need. */
  assignmentsFor(schoolId: string, userId: string) {
    return this.prisma.forTenant(schoolId, (tx) =>
      tx.attendanceAssignment.findMany({
        where: { userId },
        include: {
          class: { select: { id: true, name: true, orderIndex: true } },
          section: { select: { id: true, name: true } },
          shift: { select: { id: true, name: true } },
        },
        orderBy: [{ class: { orderIndex: "asc" } }],
      }),
    );
  }

  /**
   * Refuse anything the officer was not given.
   *
   * A grant with no section covers every section of its class; a grant with no
   * shift covers every shift. The request is allowed when any single grant
   * covers it — not when several together happen to, which would let "Grade 1
   * mornings" plus "Grade 2 afternoons" be read as "Grade 1 afternoons".
   */
  async assertCanTake(
    schoolId: string,
    userId: string,
    role: string,
    target: { classId: string; sectionId?: string | null; shiftId?: string | null },
  ): Promise<void> {
    if (!this.isScoped(role)) return;

    const grants = await this.prisma.forTenant(schoolId, (tx) =>
      tx.attendanceAssignment.findMany({
        where: { userId, classId: target.classId },
        select: { sectionId: true, shiftId: true },
      }),
    );

    if (grants.length === 0) {
      throw new ForbiddenException(
        "You have not been assigned to this class. Ask your administrator to add it.",
      );
    }

    const covered = grants.some(
      (g) =>
        (g.sectionId === null || g.sectionId === (target.sectionId ?? null)) &&
        (g.shiftId === null || g.shiftId === (target.shiftId ?? null)),
    );
    if (!covered) {
      throw new ForbiddenException(
        "That section or shift is outside what you have been assigned.",
      );
    }
  }

  /**
   * The class ids an officer may look at, for list endpoints that would
   * otherwise return the whole school. Null means unrestricted.
   */
  async visibleClassIds(
    schoolId: string,
    userId: string,
    role: string,
  ): Promise<string[] | null> {
    if (!this.isScoped(role)) return null;
    const grants = await this.prisma.forTenant(schoolId, (tx) =>
      tx.attendanceAssignment.findMany({
        where: { userId },
        select: { classId: true },
        distinct: ["classId"],
      }),
    );
    return grants.map((g) => g.classId);
  }

  // ── Administration ───────────────────────────────────────────────────────

  /** Every officer with their grants, for the admin's management page. */
  listOfficers(schoolId: string) {
    return this.prisma.forTenant(schoolId, async (tx) => {
      const users = await tx.user.findMany({
        where: { role: "ATTENDANCE_OFFICER" },
        select: {
          id: true,
          username: true,
          fullName: true,
          status: true,
          createdAt: true,
        },
        orderBy: { fullName: "asc" },
      });
      if (users.length === 0) return [];

      const grants = await tx.attendanceAssignment.findMany({
        where: { userId: { in: users.map((u) => u.id) } },
        include: {
          class: { select: { id: true, name: true } },
          section: { select: { id: true, name: true } },
          shift: { select: { id: true, name: true } },
        },
      });

      return users.map((u) => ({
        ...u,
        assignments: grants.filter((g) => g.userId === u.id),
      }));
    });
  }

  /**
   * Replace an officer's grants with exactly this set.
   *
   * Replace rather than merge: an administrator editing assignments is saying
   * what the officer should have, and a grant they removed on screen must
   * actually go. Adding without removing is how somebody keeps access to a
   * class the school believes they lost.
   */
  async setAssignments(
    schoolId: string,
    userId: string,
    rows: { classId: string; sectionId?: string | null; shiftId?: string | null }[],
    actor: { userId?: string },
  ) {
    return this.prisma.forTenant(schoolId, async (tx) => {
      const user = await tx.user.findFirst({
        where: { id: userId },
        select: { id: true, role: true },
      });
      if (!user) throw new ForbiddenException("User not found");

      await tx.attendanceAssignment.deleteMany({ where: { userId } });
      if (rows.length === 0) return { count: 0 };

      // De-duplicated here as well as in the database: Postgres treats NULLs
      // as distinct, so two identical whole-class grants would both survive a
      // plain unique index.
      const seen = new Set<string>();
      const data = rows
        .filter((r) => {
          const k = `${r.classId}|${r.sectionId ?? ""}|${r.shiftId ?? ""}`;
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        })
        .map((r) => ({
          schoolId,
          userId,
          classId: r.classId,
          sectionId: r.sectionId ?? null,
          shiftId: r.shiftId ?? null,
          createdByUserId: actor.userId ?? null,
        }));

      const res = await tx.attendanceAssignment.createMany({ data });
      return { count: res.count };
    });
  }

  /**
   * Other officers already holding the same class/section/shift.
   *
   * Not an error — a school may deliberately have two people covering one
   * register — but the administrator should be told rather than find out when
   * two officers disagree about who marked what.
   */
  async conflictsFor(
    schoolId: string,
    userId: string,
    rows: { classId: string; sectionId?: string | null; shiftId?: string | null }[],
  ) {
    if (rows.length === 0) return [];
    return this.prisma.forTenant(schoolId, async (tx) => {
      const others = await tx.attendanceAssignment.findMany({
        where: {
          userId: { not: userId },
          classId: { in: rows.map((r) => r.classId) },
        },
        include: {
          user: { select: { id: true, fullName: true, username: true } },
          class: { select: { name: true } },
          section: { select: { name: true } },
          shift: { select: { name: true } },
        },
      });

      return others.filter((o) =>
        rows.some(
          (r) =>
            r.classId === o.classId &&
            (o.sectionId === null ||
              (r.sectionId ?? null) === null ||
              o.sectionId === r.sectionId) &&
            (o.shiftId === null ||
              (r.shiftId ?? null) === null ||
              o.shiftId === r.shiftId),
        ),
      );
    });
  }
}
