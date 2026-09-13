import { Injectable, NotFoundException } from "@nestjs/common";
import type { CreateStudentCaseInput } from "@ekulmis/shared";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { parseDateFrom, parseDateTo } from "../common/date-range.util";

/**
 * Student Cases — a dated behavior/discipline note staff attach to a
 * student, independent of attendance. Parents can read their own child's
 * cases; the student's own profile shows their case history.
 */
@Injectable()
export class StudentCasesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    schoolId: string,
    dto: CreateStudentCaseInput,
    userId: string,
    username: string,
  ) {
    return this.prisma.forTenant(schoolId, async (tx) => {
      const student = await tx.student.findFirst({
        where: { id: dto.studentId },
      });
      if (!student) throw new NotFoundException("Student not found");
      return tx.studentCase.create({
        data: {
          schoolId,
          studentId: dto.studentId,
          classId: dto.classId,
          sectionId: dto.sectionId ?? null,
          title: dto.title,
          note: dto.note ?? null,
          date: new Date(`${dto.date}T00:00:00.000Z`),
          recordedByUserId: userId,
          recordedByUsername: username,
        },
      });
    });
  }

  /** Filterable case list, for the Reports/History screen. */
  async list(
    schoolId: string,
    opts: {
      classId?: string;
      sectionId?: string;
      dateFrom?: string;
      dateTo?: string;
    },
  ) {
    const where: Prisma.StudentCaseWhereInput = {};
    if (opts.classId) where.classId = opts.classId;
    if (opts.sectionId) where.sectionId = opts.sectionId;
    if (opts.dateFrom || opts.dateTo) {
      where.date = {};
      if (opts.dateFrom) where.date.gte = parseDateFrom(opts.dateFrom);
      if (opts.dateTo) where.date.lte = parseDateTo(opts.dateTo);
    }

    return this.prisma.forTenant(schoolId, async (tx) => {
      const cases = await tx.studentCase.findMany({
        where,
        orderBy: { date: "desc" },
        take: 1000,
        include: {
          student: { select: { code: true, fullName: true } },
        },
      });
      return cases.map((c) => ({
        id: c.id,
        studentId: c.studentId,
        studentCode: c.student.code,
        studentName: c.student.fullName,
        classId: c.classId,
        sectionId: c.sectionId,
        title: c.title,
        note: c.note,
        date: c.date.toISOString().slice(0, 10),
        recordedByUsername: c.recordedByUsername,
        createdAt: c.createdAt.toISOString(),
      }));
    });
  }

  /**
   * What the discipline office needs on opening the page.
   *
   * A single running total says nothing on its own: thirty cases is calm in a
   * school of nine hundred and an emergency in a school of forty. So the
   * figures here are all bounded — this month, these seven days, how many
   * different children — and the lists say which class and who, because a
   * name is what somebody acts on.
   */
  async dashboard(schoolId: string) {
    const now = new Date();
    const monthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );
    const weekStart = new Date(now);
    weekStart.setUTCDate(weekStart.getUTCDate() - 6);
    weekStart.setUTCHours(0, 0, 0, 0);

    return this.prisma.forTenant(schoolId, async (tx) => {
      const [total, thisMonth, thisWeek, grouped, byClassRows, recentRows] =
        await Promise.all([
          tx.studentCase.count(),
          tx.studentCase.count({ where: { date: { gte: monthStart } } }),
          tx.studentCase.count({ where: { date: { gte: weekStart } } }),
          tx.studentCase.groupBy({
            by: ["studentId"],
            _count: { studentId: true },
            orderBy: { _count: { studentId: "desc" } },
            take: 10,
          }),
          tx.studentCase.groupBy({
            by: ["classId"],
            _count: { classId: true },
            orderBy: { _count: { classId: "desc" } },
            take: 12,
          }),
          tx.studentCase.findMany({
            orderBy: [{ date: "desc" }, { createdAt: "desc" }],
            take: 8,
            include: { student: { select: { code: true, fullName: true } } },
          }),
        ]);

      // Distinct children, not distinct cases — one child with nine notes is
      // one child to sit down with, not nine.
      const distinct = await tx.studentCase.groupBy({ by: ["studentId"] });

      const classIds = [
        ...new Set([
          ...byClassRows.map((r) => r.classId),
          ...recentRows.map((r) => r.classId),
        ]),
      ];
      const [students, classes] = await Promise.all([
        tx.student.findMany({
          where: { id: { in: grouped.map((g) => g.studentId) } },
          select: { id: true, code: true, fullName: true, classId: true },
        }),
        classIds.length
          ? tx.class.findMany({
              where: { id: { in: classIds } },
              select: { id: true, name: true },
            })
          : Promise.resolve([]),
      ]);
      const byId = new Map(students.map((s) => [s.id, s]));
      const className = new Map(classes.map((c) => [c.id, c.name]));

      // The top students' own classes may not appear in either list above.
      const missing = [
        ...new Set(
          students
            .map((s) => s.classId)
            .filter((id): id is string => Boolean(id) && !className.has(id)),
        ),
      ];
      if (missing.length) {
        const more = await tx.class.findMany({
          where: { id: { in: missing } },
          select: { id: true, name: true },
        });
        for (const c of more) className.set(c.id, c.name);
      }

      return {
        total,
        thisMonth,
        thisWeek,
        studentsInvolved: distinct.length,
        topStudents: grouped.map((g) => {
          const st = byId.get(g.studentId);
          return {
            studentId: g.studentId,
            studentCode: st?.code ?? "",
            studentName: st?.fullName ?? "",
            className: st?.classId ? (className.get(st.classId) ?? "") : "",
            count: g._count.studentId,
          };
        }),
        byClass: byClassRows.map((r) => ({
          classId: r.classId,
          className: className.get(r.classId) ?? "",
          count: r._count.classId,
        })),
        recent: recentRows.map((c) => ({
          id: c.id,
          studentId: c.studentId,
          studentCode: c.student.code,
          studentName: c.student.fullName,
          className: className.get(c.classId) ?? "",
          title: c.title,
          note: c.note,
          date: c.date.toISOString().slice(0, 10),
          recordedByUsername: c.recordedByUsername,
        })),
      };
    });
  }

  /** A single student's own case history — used by the profile tab. */
  async forStudent(schoolId: string, studentId: string) {
    return this.prisma.forTenant(schoolId, async (tx) => {
      const cases = await tx.studentCase.findMany({
        where: { studentId },
        orderBy: { date: "desc" },
      });
      return cases.map((c) => ({
        id: c.id,
        title: c.title,
        note: c.note,
        date: c.date.toISOString().slice(0, 10),
        recordedByUsername: c.recordedByUsername,
        createdAt: c.createdAt.toISOString(),
      }));
    });
  }
}
