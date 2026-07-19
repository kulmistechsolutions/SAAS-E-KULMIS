import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import ExcelJS from "exceljs";
import { PrismaService } from "../prisma/prisma.service";

/** Grade from an average. Mirrors the one used everywhere else in results. */
function gradeFromAverage(avg: number): string {
  if (avg >= 90) return "A+";
  if (avg >= 80) return "A";
  if (avg >= 70) return "B";
  if (avg >= 60) return "C";
  if (avg >= 50) return "D";
  return "F";
}

/** Columns the school fills in are subjects; these three are ours. */
const ID_HEADER = "Student ID";
const NAME_HEADER = "Student Name";
const COMPUTED = ["Total", "Average", "Grade"] as const;

export interface ImportIssue {
  sheet: string;
  row: number | null;
  studentCode: string | null;
  message: string;
}

export interface SheetPreview {
  sheet: string;
  examId: string;
  className: string;
  students: number;
  /** Marks that parsed cleanly and are ready to write. */
  marks: number;
  /** Cells the school left blank — allowed, but worth seeing before importing. */
  blanks: number;
  issues: ImportIssue[];
}

export interface ImportPreview {
  ok: boolean;
  sheets: SheetPreview[];
  issues: ImportIssue[];
  totalMarks: number;
}

/**
 * Bulk exam-marks import.
 *
 * An Exam in this system belongs to ONE class, so a whole-school marks sheet is
 * a workbook with one worksheet per exam — that is why the template is built
 * from an exam group rather than a single exam, and why each sheet carries only
 * the subjects that class actually sits.
 *
 * Nothing here writes. Validation is a separate, complete pass so a school sees
 * every problem at once and never ends up with half a class imported: marks
 * that go in wrong are close to impossible to spot later, and the damage is
 * measured in a student's reported result.
 */
@Injectable()
export class MarksImportService {
  constructor(private readonly prisma: PrismaService) {}

  /** The exams a template can be built from, newest first. */
  listImportableExams(schoolId: string, academicYearId: string) {
    return this.prisma.forTenant(schoolId, (tx) =>
      tx.exam.findMany({
        where: { academicYearId },
        orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
          name: true,
          term: true,
          maxMarks: true,
          status: true,
          examGroupId: true,
          examGroup: { select: { id: true, name: true } },
          class: { select: { id: true, name: true } },
          section: { select: { id: true, name: true } },
          _count: { select: { subjects: true } },
        },
      }),
    );
  }

  /** Load exams plus everything a sheet needs, in one place. */
  private async loadExams(schoolId: string, examIds: string[]) {
    if (examIds.length === 0) {
      throw new BadRequestException("Pick at least one exam.");
    }
    const exams = await this.prisma.forTenant(schoolId, (tx) =>
      tx.exam.findMany({
        where: { id: { in: examIds } },
        include: {
          class: { select: { id: true, name: true } },
          section: { select: { id: true, name: true } },
          subjects: { include: { subject: { select: { id: true, name: true } } } },
        },
      }),
    );
    if (exams.length === 0) throw new NotFoundException("Exam not found");

    // Students are read per exam because an exam may be section-scoped.
    const withStudents = await Promise.all(
      exams.map(async (exam) => {
        const students = await this.prisma.forTenant(schoolId, (tx) =>
          tx.student.findMany({
            where: {
              classId: exam.classId,
              ...(exam.sectionId ? { sectionId: exam.sectionId } : {}),
              status: "ACTIVE",
            },
            orderBy: [{ code: "asc" }],
            select: { id: true, code: true, fullName: true },
          }),
        );
        return { exam, students };
      }),
    );
    return withStudents;
  }

  /**
   * Sheet name for an exam. Excel forbids several characters and caps names at
   * 31 chars, and a duplicate name throws — so names are sanitised and
   * de-duplicated rather than trusted.
   */
  private sheetNames(
    exams: { exam: { id: string; class: { name: string }; section: { name: string } | null } }[],
  ): Map<string, string> {
    const used = new Set<string>();
    const out = new Map<string, string>();
    for (const { exam } of exams) {
      const base = (
        exam.section ? `${exam.class.name} ${exam.section.name}` : exam.class.name
      )
        .replace(/[\\/*?:[\]]/g, "-")
        .slice(0, 28)
        .trim();
      let name = base || "Class";
      let n = 2;
      while (used.has(name.toLowerCase())) {
        name = `${base.slice(0, 26)} ${n}`;
        n += 1;
      }
      used.add(name.toLowerCase());
      out.set(exam.id, name);
    }
    return out;
  }

  /**
   * Build the marks template: one sheet per exam, each with that class's own
   * students and its own subjects.
   *
   * Total, Average and Grade are written as live formulas rather than left
   * blank. They are the school's own check while typing, and because the
   * importer recomputes them anyway, a stale or edited value can never reach a
   * student's result.
   */
  async buildTemplate(
    schoolId: string,
    examIds: string[],
  ): Promise<{ buffer: Buffer; filename: string }> {
    const loaded = await this.loadExams(schoolId, examIds);
    const names = this.sheetNames(loaded);

    const wb = new ExcelJS.Workbook();
    wb.creator = "eKulmis";
    wb.created = new Date();

    for (const { exam, students } of loaded) {
      const ws = wb.addWorksheet(names.get(exam.id)!);
      const subjects = exam.subjects.map((s) => s.subject);

      // Row 1 identifies the exam so a returned file can be checked against the
      // exam it was meant for, not just the sheet name.
      ws.getCell("A1").value = `${exam.name} — ${exam.class.name}${exam.section ? ` ${exam.section.name}` : ""} · out of ${exam.maxMarks}`;
      ws.getCell("A1").font = { bold: true, size: 12 };
      ws.getCell("A2").value = `EXAM_ID:${exam.id}`;
      ws.getCell("A2").font = { size: 8, color: { argb: "FF999999" } };

      const header = [ID_HEADER, NAME_HEADER, ...subjects.map((s) => s.name), ...COMPUTED];
      const headerRow = ws.getRow(4);
      header.forEach((h, i) => {
        const cell = headerRow.getCell(i + 1);
        cell.value = h;
        cell.font = { bold: true };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFEFEFEF" },
        };
      });
      headerRow.commit();

      ws.getColumn(1).width = 14;
      ws.getColumn(2).width = 28;
      subjects.forEach((_, i) => {
        ws.getColumn(3 + i).width = 12;
      });
      COMPUTED.forEach((_, i) => {
        ws.getColumn(3 + subjects.length + i).width = 10;
      });

      const firstSubjectCol = 3;
      const lastSubjectCol = 2 + subjects.length;
      students.forEach((student, i) => {
        const r = 5 + i;
        const row = ws.getRow(r);
        row.getCell(1).value = student.code;
        row.getCell(2).value = student.fullName;
        if (subjects.length > 0) {
          const from = ws.getCell(r, firstSubjectCol).address;
          const to = ws.getCell(r, lastSubjectCol).address;
          row.getCell(lastSubjectCol + 1).value = { formula: `SUM(${from}:${to})` };
          row.getCell(lastSubjectCol + 2).value = {
            formula: `IF(COUNT(${from}:${to})=0,"",ROUND(AVERAGE(${from}:${to}),1))`,
          };
          // Kept in step with gradeFromAverage above.
          const avg = ws.getCell(r, lastSubjectCol + 2).address;
          row.getCell(lastSubjectCol + 3).value = {
            formula: `IF(${avg}="","",IF(${avg}>=90,"A+",IF(${avg}>=80,"A",IF(${avg}>=70,"B",IF(${avg}>=60,"C",IF(${avg}>=50,"D","F"))))))`,
          };
        }
        // The two identity columns are locked so a school cannot accidentally
        // retype an ID and silently attach a whole row to the wrong student.
        row.getCell(1).protection = { locked: true };
        row.getCell(2).protection = { locked: true };
        row.commit();
      });

      ws.views = [{ state: "frozen", ySplit: 4, xSplit: 2 }];
    }

    const buffer = Buffer.from(await wb.xlsx.writeBuffer());
    const first = loaded[0]!.exam;
    const safe = first.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    return { buffer, filename: `${safe}-marks-template.xlsx` };
  }

  /**
   * Read a filled-in workbook and report exactly what would happen.
   *
   * Writes nothing. Every problem across every sheet is collected, because a
   * school fixing a spreadsheet wants the whole list, not one error per upload.
   */
  async validate(
    schoolId: string,
    examIds: string[],
    file: Buffer,
  ): Promise<ImportPreview> {
    const loaded = await this.loadExams(schoolId, examIds);
    const names = this.sheetNames(loaded);

    const wb = new ExcelJS.Workbook();
    try {
      await wb.xlsx.load(file as unknown as ArrayBuffer);
    } catch {
      throw new BadRequestException(
        "That file could not be opened as an Excel workbook.",
      );
    }

    const issues: ImportIssue[] = [];
    const sheets: SheetPreview[] = [];
    let totalMarks = 0;

    for (const { exam, students } of loaded) {
      const sheetName = names.get(exam.id)!;
      const label = exam.section
        ? `${exam.class.name} ${exam.section.name}`
        : exam.class.name;

      // Match by the EXAM_ID stamped into the template first; fall back to the
      // sheet name. Renaming a tab must not silently import a class's marks
      // into a different class.
      const ws =
        wb.worksheets.find(
          (w) => String(w.getCell("A2").value ?? "").trim() === `EXAM_ID:${exam.id}`,
        ) ??
        wb.worksheets.find(
          (w) => w.name.trim().toLowerCase() === sheetName.toLowerCase(),
        );

      if (!ws) {
        issues.push({
          sheet: sheetName,
          row: null,
          studentCode: null,
          message: `No sheet found for ${label}. Expected a tab named "${sheetName}".`,
        });
        continue;
      }

      const subjects = exam.subjects.map((s) => s.subject);
      const subjectByName = new Map(
        subjects.map((s) => [s.name.trim().toLowerCase(), s]),
      );
      const studentByCode = new Map(
        students.map((s) => [s.code.trim().toLowerCase(), s]),
      );

      // Header row: locate columns by name so a school may reorder or hide
      // columns without corrupting the import.
      const headerRow = ws.getRow(4);
      const columns = new Map<number, { id: string; name: string }>();
      let idCol = 0;
      const sheetIssues: ImportIssue[] = [];
      headerRow.eachCell((cell, col) => {
        const text = String(cell.value ?? "").trim();
        if (!text) return;
        const lower = text.toLowerCase();
        if (lower === ID_HEADER.toLowerCase()) {
          idCol = col;
          return;
        }
        if (
          lower === NAME_HEADER.toLowerCase() ||
          COMPUTED.some((c) => c.toLowerCase() === lower)
        ) {
          return; // ours — recomputed, never read
        }
        const subject = subjectByName.get(lower);
        if (!subject) {
          sheetIssues.push({
            sheet: sheetName,
            row: 4,
            studentCode: null,
            message: `Column "${text}" is not a subject in this exam for ${label}.`,
          });
          return;
        }
        columns.set(col, subject);
      });

      if (!idCol) {
        sheetIssues.push({
          sheet: sheetName,
          row: 4,
          studentCode: null,
          message: `Could not find the "${ID_HEADER}" column on ${sheetName}.`,
        });
      }

      const missingSubjects = subjects.filter(
        (s) => ![...columns.values()].some((c) => c.id === s.id),
      );
      for (const s of missingSubjects) {
        sheetIssues.push({
          sheet: sheetName,
          row: 4,
          studentCode: null,
          message: `${label}: no column for ${s.name}; its marks will be left as they are.`,
        });
      }

      let marks = 0;
      let blanks = 0;
      const seen = new Set<string>();

      if (idCol) {
        for (let r = 5; r <= ws.rowCount; r += 1) {
          const row = ws.getRow(r);
          const code = String(row.getCell(idCol).value ?? "").trim();
          if (!code) continue;

          const student = studentByCode.get(code.toLowerCase());
          if (!student) {
            sheetIssues.push({
              sheet: sheetName,
              row: r,
              studentCode: code,
              message: `No active student "${code}" in ${label}.`,
            });
            continue;
          }
          if (seen.has(student.id)) {
            sheetIssues.push({
              sheet: sheetName,
              row: r,
              studentCode: code,
              message: `${student.fullName} appears more than once on ${sheetName}.`,
            });
            continue;
          }
          seen.add(student.id);

          for (const [col, subject] of columns) {
            const raw = row.getCell(col).value;
            const text = String(
              raw !== null && typeof raw === "object" && "result" in raw
                ? (raw as { result?: unknown }).result ?? ""
                : (raw ?? ""),
            ).trim();
            if (text === "") {
              blanks += 1;
              continue;
            }
            const value = Number(text);
            if (!Number.isFinite(value)) {
              sheetIssues.push({
                sheet: sheetName,
                row: r,
                studentCode: code,
                message: `${student.fullName} · ${subject.name}: "${text}" is not a number.`,
              });
              continue;
            }
            if (value < 0 || value > exam.maxMarks) {
              sheetIssues.push({
                sheet: sheetName,
                row: r,
                studentCode: code,
                message: `${student.fullName} · ${subject.name}: ${value} is outside 0–${exam.maxMarks}.`,
              });
              continue;
            }
            marks += 1;
          }
        }
      }

      const absent = students.filter((s) => !seen.has(s.id));
      for (const s of absent.slice(0, 5)) {
        sheetIssues.push({
          sheet: sheetName,
          row: null,
          studentCode: s.code,
          message: `${s.fullName} is in ${label} but has no row on ${sheetName}.`,
        });
      }
      if (absent.length > 5) {
        sheetIssues.push({
          sheet: sheetName,
          row: null,
          studentCode: null,
          message: `…and ${absent.length - 5} more students in ${label} with no row.`,
        });
      }

      totalMarks += marks;
      issues.push(...sheetIssues);
      sheets.push({
        sheet: sheetName,
        examId: exam.id,
        className: label,
        students: seen.size,
        marks,
        blanks,
        issues: sheetIssues,
      });
    }

    return { ok: issues.length === 0, sheets, issues, totalMarks };
  }

  /** Exposed so the eventual import writes the same grade the sheet showed. */
  static grade(avg: number): string {
    return gradeFromAverage(avg);
  }
}
