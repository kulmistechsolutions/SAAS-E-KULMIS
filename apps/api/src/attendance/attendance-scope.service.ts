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
function lockMinutes(hhmm: string): number | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** Wall-clock minutes of a timestamp in the school own timezone. */
function wallMinutes(at: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((x) => x.type === t)?.value ?? 0);
  return get("hour") * 60 + get("minute");
}

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

  /**
   * Who took which register on one day, and which were not taken at all.
   *
   * The school could already see the marks; it could not see the taking. A
   * register left blank looked exactly like a class with nobody absent until
   * somebody went through it class by class, and there was no screen saying
   * "Grade 3 has not been done today" while the day was still fixable.
   *
   * Every active class in the current year is listed, marked or not — the
   * absence is the point.
   */
  async monitoring(schoolId: string, dateStr: string) {
    const date = new Date(`${dateStr}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException("Invalid date");
    }

    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
      select: { attendanceSettings: true, timezone: true },
    });
    const settings = (school?.attendanceSettings ?? {}) as { lockTime?: string };
    const lock = lockMinutes(settings.lockTime ?? "23:59");
    const timezone = school?.timezone || "UTC";

    return this.prisma.forTenant(schoolId, async (tx) => {
      const year = await tx.academicYear.findFirst({
        where: { isActive: true },
        select: { id: true },
      });

      const classes = await tx.class.findMany({
        where: { status: "ACTIVE", ...(year ? { academicYearId: year.id } : {}) },
        select: { id: true, name: true, orderIndex: true },
        orderBy: { orderIndex: "asc" },
      });
      if (classes.length === 0) {
        return { date: dateStr, lockTime: settings.lockTime ?? null, registers: [] };
      }

      const classIds = classes.map((c) => c.id);

      const rolls = await tx.student.groupBy({
        by: ["classId"],
        where: { status: "ACTIVE", classId: { in: classIds } },
        _count: { _all: true },
      });
      const rollOf = new Map(rolls.map((r) => [r.classId, r._count._all]));

      const records = await tx.studentAttendance.findMany({
        where: { date, classId: { in: classIds } },
        select: {
          classId: true,
          shiftId: true,
          status: true,
          markedByUserId: true,
          createdAt: true,
        },
      });

      const shifts = await tx.attendanceShift.findMany({
        select: { id: true, name: true },
      });
      const shiftName = new Map(shifts.map((x) => [x.id, x.name]));

      const markerIds = [
        ...new Set(
          records
            .map((r) => r.markedByUserId)
            .filter((x): x is string => Boolean(x)),
        ),
      ];
      const markers = markerIds.length
        ? await tx.user.findMany({
            where: { id: { in: markerIds } },
            select: { id: true, fullName: true, username: true, role: true },
          })
        : [];
      const markerOf = new Map(markers.map((m) => [m.id, m]));

      // Grouped by class and shift, because that is the unit somebody sits
      // down and takes. A class with two shifts is two jobs, and reporting it
      // as one hides a missed afternoon behind a done morning.
      const groups = new Map<string, typeof records>();
      for (const r of records) {
        const key = `${r.classId}|${r.shiftId ?? ""}`;
        const list = groups.get(key);
        if (list) list.push(r);
        else groups.set(key, [r]);
      }

      const registers = [];
      for (const c of classes) {
        const roll = rollOf.get(c.id) ?? 0;
        const keys = [...groups.keys()].filter((k) => k.startsWith(`${c.id}|`));

        if (keys.length === 0) {
          registers.push({
            classId: c.id,
            className: c.name,
            shiftId: null,
            shiftName: null,
            total: roll,
            marked: 0,
            present: 0,
            absent: 0,
            state: roll === 0 ? "EMPTY" : "NOT_TAKEN",
            takenBy: [] as { userId: string; name: string; role: string | null }[],
            firstMarkedAt: null as Date | null,
            afterLock: false,
          });
          continue;
        }

        for (const key of keys) {
          const rows = groups.get(key) ?? [];
          const shiftId = key.split("|")[1] || null;
          const takenBy = [
            ...new Set(
              rows
                .map((r) => r.markedByUserId)
                .filter((x): x is string => Boolean(x)),
            ),
          ].map((id) => {
            const u = markerOf.get(id);
            return {
              userId: id,
              name: u ? u.fullName || u.username : "Unknown",
              role: u?.role ?? null,
            };
          });
          const first = rows.reduce<Date | null>(
            (acc, r) => (!acc || r.createdAt < acc ? r.createdAt : acc),
            null,
          );

          registers.push({
            classId: c.id,
            className: c.name,
            shiftId,
            shiftName: shiftId ? (shiftName.get(shiftId) ?? null) : null,
            total: roll,
            marked: rows.length,
            present: rows.filter((r) => r.status === "PRESENT").length,
            absent: rows.filter((r) => r.status === "ABSENT").length,
            state:
              roll === 0 ? "EMPTY" : rows.length < roll ? "PARTIAL" : "TAKEN",
            takenBy,
            firstMarkedAt: first,
            // Whether it was taken after the school own lock time.
            // Administrators are exempt from the lock, so this is the only
            // place a late correction shows up at all.
            afterLock:
              lock !== null && first !== null
                ? wallMinutes(first, timezone) >= lock
                : false,
          });
        }
      }

      return { date: dateStr, lockTime: settings.lockTime ?? null, registers };
    });
  }

  /**
   * How each officer has kept up over a stretch of days.
   *
   * Counted against what they were assigned, not against the school: an
   * officer holding one class has not missed the other nineteen. Days with no
   * attendance anywhere are left out entirely — those are weekends and
   * holidays, and counting them as misses would make everyone look negligent.
   */
  async performance(schoolId: string, fromStr: string, toStr: string) {
    const from = new Date(`${fromStr}T00:00:00.000Z`);
    const to = new Date(`${toStr}T00:00:00.000Z`);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new BadRequestException("Invalid date range");
    }
    if (from > to) throw new BadRequestException("from must not be after to");

    return this.prisma.forTenant(schoolId, async (tx) => {
      const officers = await tx.user.findMany({
        where: { role: "ATTENDANCE_OFFICER" },
        select: { id: true, fullName: true, username: true, status: true },
        orderBy: { fullName: "asc" },
      });
      if (officers.length === 0) {
        return { from: fromStr, to: toStr, schoolDays: 0, officers: [] };
      }
      const officerIds = officers.map((o) => o.id);

      const grants = await tx.attendanceAssignment.findMany({
        where: { userId: { in: officerIds } },
        select: {
          userId: true,
          classId: true,
          shiftId: true,
          createdAt: true,
        },
      });

      // The days the school actually ran, read off the register itself rather
      // than from a term calendar the product does not have.
      const activeDays = await tx.studentAttendance.findMany({
        where: { date: { gte: from, lte: to } },
        select: { date: true },
        distinct: ["date"],
      });
      const dayKeys = activeDays.map((d) => d.date.toISOString().slice(0, 10));
      const schoolDays = dayKeys.length;

      const records = await tx.studentAttendance.groupBy({
        by: ["markedByUserId", "date", "classId", "shiftId"],
        where: {
          date: { gte: from, lte: to },
          markedByUserId: { in: officerIds },
        },
        _count: { _all: true },
      });

      return {
        from: fromStr,
        to: toStr,
        schoolDays,
        officers: officers.map((o) => {
          const mine = grants.filter((g) => g.userId === o.id);
          const taken = records.filter((r) => r.markedByUserId === o.id);
          // One register is one class-and-shift on one day. Expected is what
          // they hold multiplied by the days the school ran.
          // Counted per grant from the day it was given. A grant added this
          // morning is not owed the last four weeks — measuring it that way
          // makes anyone newly assigned look negligent on their first day.
          const expected = mine.reduce((n, g) => {
            const since = g.createdAt.toISOString().slice(0, 10);
            return n + dayKeys.filter((d) => d >= since).length;
          }, 0);
          const done = new Set(
            taken.map(
              (r) =>
                `${r.date.toISOString().slice(0, 10)}|${r.classId}|${r.shiftId ?? ""}`,
            ),
          ).size;
          return {
            userId: o.id,
            name: o.fullName || o.username,
            username: o.username,
            status: o.status,
            assignments: mine.length,
            expected,
            taken: done,
            missed: Math.max(0, expected - done),
            studentsMarked: taken.reduce((n, r) => n + r._count._all, 0),
            rate:
              expected === 0 ? null : Math.round((done / expected) * 1000) / 10,
          };
        }),
      };
    });
  }

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
