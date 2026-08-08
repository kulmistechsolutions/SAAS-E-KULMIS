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

  /** Dashboard: total case count + top students by case count. */
  async dashboard(schoolId: string) {
    return this.prisma.forTenant(schoolId, async (tx) => {
      const [total, grouped] = await Promise.all([
        tx.studentCase.count(),
        tx.studentCase.groupBy({
          by: ["studentId"],
          _count: { studentId: true },
          orderBy: { _count: { studentId: "desc" } },
          take: 10,
        }),
      ]);
      const students = await tx.student.findMany({
        where: { id: { in: grouped.map((g) => g.studentId) } },
        select: { id: true, code: true, fullName: true },
      });
      const byId = new Map(students.map((s) => [s.id, s]));
      return {
        total,
        topStudents: grouped.map((g) => ({
          studentId: g.studentId,
          studentCode: byId.get(g.studentId)?.code ?? "",
          studentName: byId.get(g.studentId)?.fullName ?? "",
          count: g._count.studentId,
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
