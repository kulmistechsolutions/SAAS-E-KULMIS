import { BadRequestException, Injectable } from "@nestjs/common";
import { DocumentsService } from "../documents/documents.service";
import { ExaminationsService } from "../examinations/examinations.service";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly docs: DocumentsService,
    private readonly exams: ExaminationsService,
  ) {}

  async studentListReport(schoolId: string, classId?: string) {
    return this.prisma.forTenant(schoolId, (tx) =>
      tx.student.findMany({
        where: {
          status: "ACTIVE",
          ...(classId ? { classId } : {}),
        },
        include: {
          class: { select: { name: true } },
          section: { select: { name: true } },
          parent: { select: { name: true, phone: true } },
        },
        orderBy: { fullName: "asc" },
      }),
    );
  }

  async exportStudentsPdf(schoolId: string, classId?: string) {
    const rows = await this.studentListReport(schoolId, classId);
    return this.docs.buildPdfReport({
      title: "Student List Report",
      columns: [
        { key: "code", label: "ID", width: 70 },
        { key: "name", label: "Name", width: 140 },
        { key: "class", label: "Class", width: 80 },
        { key: "section", label: "Section", width: 60 },
      ],
      rows: rows.map((s) => ({
        code: s.code,
        name: s.fullName,
        class: s.class.name,
        section: s.section?.name ?? "—",
      })),
    });
  }

  async exportStudentsExcel(schoolId: string, classId?: string) {
    const rows = await this.studentListReport(schoolId, classId);
    return this.docs.buildExcelReport({
      sheetName: "Students",
      columns: [
        { key: "code", label: "Student ID" },
        { key: "name", label: "Name" },
        { key: "class", label: "Class" },
        { key: "section", label: "Section" },
        { key: "parent", label: "Parent" },
        { key: "phone", label: "Phone" },
      ],
      rows: rows.map((s) => ({
        code: s.code,
        name: s.fullName,
        class: s.class.name,
        section: s.section?.name ?? "",
        parent: s.parent.name,
        phone: s.parent.phone,
      })),
    });
  }

  async attendanceReport(schoolId: string, date: string, classId?: string) {
    const d = new Date(`${date}T00:00:00.000Z`);
    if (!date || Number.isNaN(d.getTime())) {
      throw new BadRequestException("A valid date (YYYY-MM-DD) is required");
    }
    return this.prisma.forTenant(schoolId, (tx) =>
      tx.studentAttendance.findMany({
        where: { date: d, ...(classId ? { classId } : {}) },
        include: {
          student: {
            select: {
              code: true,
              fullName: true,
              class: { select: { name: true } },
              section: { select: { name: true } },
            },
          },
        },
      }),
    );
  }

  async examResultsReport(schoolId: string, studentId: string) {
    return this.exams.studentResults(schoolId, studentId);
  }
}
