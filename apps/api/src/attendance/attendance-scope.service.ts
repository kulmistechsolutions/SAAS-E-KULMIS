import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
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

  /**
   * One officer's whole working day in a single answer.
   *
   * An officer holding four registers should not have to open four screens to
   * find out which ones are still outstanding, and the school should not have
   * to trust that they remembered. Each grant comes back with how many
   * children it covers, how many are already marked, and who marked them.
   *
   * "Who marked them" is the part that matters beyond convenience: two
   * officers can be assigned the same register deliberately, and when they are,
   * the second one arriving should see that the first has already been there
   * rather than quietly overwriting the morning's work.
   */
  async myDay(schoolId: string, userId: string, dateStr: string) {
    const date = new Date(`${dateStr}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException("Invalid date");
    }

    return this.prisma.forTenant(schoolId, async (tx) => {
      const grants = await tx.attendanceAssignment.findMany({
        where: { userId },
        include: {
          class: { select: { id: true, name: true, orderIndex: true } },
          section: { select: { id: true, name: true } },
          shift: { select: { id: true, name: true } },
        },
        orderBy: [{ class: { orderIndex: "asc" } }],
      });
      if (grants.length === 0) return { date: dateStr, registers: [] };

      const classIds = [...new Set(grants.map((g) => g.classId))];

      // Counted once for every class rather than once per grant: a class held
      // twice (two shifts) covers the same children both times.
      const students = await tx.student.findMany({
        where: {
          status: "ACTIVE",
          OR: [
            { classId: { in: classIds } },
            { extraClasses: { some: { classId: { in: classIds } } } },
          ],
        },
        select: {
          id: true,
          classId: true,
          sectionId: true,
          extraClasses: { select: { classId: true, sectionId: true } },
        },
      });

      const records = await tx.studentAttendance.findMany({
        where: { date, classId: { in: classIds } },
        select: {
          studentId: true,
          classId: true,
          sectionId: true,
          shiftId: true,
          status: true,
          markedByUserId: true,
          updatedAt: true,
        },
      });

      const markers = await tx.user.findMany({
        where: {
          id: {
            in: [
              ...new Set(
                records
                  .map((r) => r.markedByUserId)
                  .filter((x): x is string => Boolean(x)),
              ),
            ],
          },
        },
        select: { id: true, fullName: true, username: true },
      });
      const nameOf = new Map(
        markers.map((m) => [m.id, m.fullName || m.username]),
      );

      const sitsIn = (
        s: (typeof students)[number],
        classId: string,
        sectionId: string | null,
      ) =>
        (s.classId === classId &&
          (sectionId === null || s.sectionId === sectionId)) ||
        s.extraClasses.some(
          (e) =>
            e.classId === classId &&
            (sectionId === null || e.sectionId === sectionId),
        );

      return {
        date: dateStr,
        registers: grants.map((g) => {
          const roll = students.filter((s) =>
            sitsIn(s, g.classId, g.sectionId),
          );
          const rollIds = new Set(roll.map((s) => s.id));
          const mine = records.filter(
            (r) =>
              rollIds.has(r.studentId) &&
              r.classId === g.classId &&
              (g.sectionId === null || r.sectionId === g.sectionId) &&
              (g.shiftId === null
                ? true
                : r.shiftId === g.shiftId),
          );

          const others = [
            ...new Set(
              mine
                .map((r) => r.markedByUserId)
                .filter((x): x is string => Boolean(x) && x !== userId),
            ),
          ].map((id) => nameOf.get(id) ?? "Someone else");

          const last = mine.reduce<Date | null>(
            (acc, r) => (!acc || r.updatedAt > acc ? r.updatedAt : acc),
            null,
          );

          return {
            id: g.id,
            classId: g.classId,
            className: g.class.name,
            sectionId: g.sectionId,
            sectionName: g.section?.name ?? null,
            shiftId: g.shiftId,
            shiftName: g.shift?.name ?? null,
            total: roll.length,
            marked: mine.length,
            present: mine.filter((r) => r.status === "PRESENT").length,
            absent: mine.filter((r) => r.status === "ABSENT").length,
            late: mine.filter((r) => r.status === "LATE").length,
            excused: mine.filter((r) => r.status === "EXCUSED").length,
            // An empty class is "done" rather than permanently outstanding —
            // there is nobody in it to mark.
            state:
              roll.length === 0
                ? "EMPTY"
                : mine.length === 0
                  ? "NOT_STARTED"
                  : mine.length < roll.length
                    ? "PARTIAL"
                    : "DONE",
            markedByOthers: others,
            lastMarkedAt: last,
          };
        }),
      };
    });
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
