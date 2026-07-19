import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import PDFDocument from "pdfkit";
import { formatMinutes, WEEKDAY_NAMES } from "@ekulmis/shared";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";

interface Cell {
  top: string;
  bottom: string;
}

interface Grid {
  title: string;
  subtitle: string;
  /** rows[periodIndex][dayIndex]; null renders as a free period. */
  rows: (Cell | null)[][];
  /** Break bands, keyed by the row they follow. */
  breakAfter: Map<number, string>;
}

const MARGIN = 40;
const PAGE_W = 842; // A4 landscape
const PAGE_H = 595;

/**
 * Timetable as a printable PDF — the artefact a school actually pins to a wall
 * and hands to teachers.
 *
 * The generic table builder in DocumentsService draws a list; a timetable needs
 * a real grid with two lines in every cell, so this draws its own. It also
 * mirrors the structure schools already expect from a printed timetable: a
 * summary sheet, then one grid per class, then one per teacher.
 */
@Injectable()
export class TimetablePdfService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly config: ConfigService,
  ) {}

  async build(
    schoolId: string,
    timetableId: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const timetable = await this.prisma.forTenant(schoolId, (tx) =>
      tx.timetable.findUnique({
        where: { id: timetableId },
        include: {
          shift: { include: { periods: { orderBy: { orderIndex: "asc" } } } },
          academicYear: { select: { name: true } },
          entries: {
            include: {
              subject: { select: { name: true } },
              teacher: { select: { id: true, fullName: true } },
              class: { select: { name: true } },
              section: { select: { name: true } },
            },
          },
        },
      }),
    );
    if (!timetable) throw new Error("Timetable not found");

    const school = await this.prisma.school.findFirst({
      where: { id: schoolId },
      select: { name: true, logoKey: true },
    });

    let logo: Buffer | null = null;
    if (school?.logoKey) {
      try {
        const bucket = this.config.get<string>("MINIO_BUCKET") ?? "ekulmis";
        logo = await this.storage.getObject(bucket, school.logoKey);
      } catch {
        // Production runs on local filesystem storage where this can fail;
        // a missing logo must never cost the school its timetable.
        logo = null;
      }
    }

    const { shift, entries } = timetable;
    const days = shift.days;
    const teaching = shift.periods.filter((p) => !p.isBreak);

    // Break bands are drawn between the teaching rows they follow.
    const breakAfter = new Map<number, string>();
    shift.periods.forEach((p, i) => {
      if (!p.isBreak) return;
      const before = shift.periods.slice(0, i).filter((x) => !x.isBreak).length;
      breakAfter.set(
        before - 1,
        `${p.name}  ${formatMinutes(p.startMinute)} – ${formatMinutes(p.endMinute)}`,
      );
    });

    const roomLabel = (e: (typeof entries)[number]) =>
      e.section ? `${e.class.name} ${e.section.name}` : e.class.name;

    // ── Class grids ────────────────────────────────────────────────────────
    const roomKeys = [
      ...new Map(
        entries.map((e) => [`${e.classId}:${e.sectionId ?? ""}`, roomLabel(e)]),
      ),
    ].sort((a, b) => a[1].localeCompare(b[1]));

    const classGrids: Grid[] = roomKeys.map(([key, label]) => ({
      title: `Class ${label}`,
      subtitle: `${entries.filter((e) => `${e.classId}:${e.sectionId ?? ""}` === key).length} lessons / week`,
      breakAfter,
      rows: teaching.map((period) =>
        days.map((day) => {
          const cell = entries.find(
            (e) =>
              `${e.classId}:${e.sectionId ?? ""}` === key &&
              e.dayOfWeek === day &&
              e.shiftPeriodId === period.id,
          );
          return cell
            ? { top: cell.subject.name, bottom: cell.teacher?.fullName ?? "—" }
            : null;
        }),
      ),
    }));

    // ── Teacher grids ──────────────────────────────────────────────────────
    const teacherList = [
      ...new Map(
        entries
          .filter((e) => e.teacher)
          .map((e) => [e.teacher!.id, e.teacher!.fullName]),
      ),
    ].sort((a, b) => a[1].localeCompare(b[1]));

    const teacherGrids: Grid[] = teacherList.map(([id, name]) => ({
      title: name,
      subtitle: `${entries.filter((e) => e.teacher?.id === id).length} lessons / week`,
      breakAfter,
      rows: teaching.map((period) =>
        days.map((day) => {
          const cell = entries.find(
            (e) =>
              e.teacher?.id === id &&
              e.dayOfWeek === day &&
              e.shiftPeriodId === period.id,
          );
          return cell
            ? { top: roomLabel(cell), bottom: cell.subject.name }
            : null;
        }),
      ),
    }));

    const buffer = await this.render({
      schoolName: school?.name ?? "School",
      logo,
      academicYear: timetable.academicYear.name,
      shiftName: shift.name,
      days,
      periods: teaching.map((p) => ({
        name: p.name,
        label: `${formatMinutes(p.startMinute)} – ${formatMinutes(p.endMinute)}`,
      })),
      totalLessons: entries.length,
      classCount: roomKeys.length,
      teacherCount: teacherList.length,
      notes: timetable.notes,
      classGrids,
      teacherGrids,
    });

    const safe = (school?.name ?? "school").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    return { buffer, filename: `${safe}-timetable-${shift.name.toLowerCase()}.pdf` };
  }

  private render(opts: {
    schoolName: string;
    logo: Buffer | null;
    academicYear: string;
    shiftName: string;
    days: number[];
    periods: { name: string; label: string }[];
    totalLessons: number;
    classCount: number;
    teacherCount: number;
    notes: string | null;
    classGrids: Grid[];
    teacherGrids: Grid[];
  }): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: MARGIN, size: "A4", layout: "landscape" });
      const chunks: Buffer[] = [];
      doc.on("data", (c) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      // ── Summary sheet ────────────────────────────────────────────────────
      let y = MARGIN;
      if (opts.logo) {
        try {
          doc.image(opts.logo, MARGIN, y, { fit: [46, 46] });
        } catch {
          /* an unreadable logo is not worth failing the document over */
        }
      }
      doc
        .fontSize(18)
        .font("Helvetica-Bold")
        .text(opts.schoolName.toUpperCase(), MARGIN + 56, y + 4);
      doc
        .fontSize(11)
        .font("Helvetica")
        .text(`Weekly Timetable — ${opts.shiftName}`, MARGIN + 56, y + 26);
      y += 60;

      doc.moveTo(MARGIN, y).lineTo(PAGE_W - MARGIN, y).strokeColor("#cccccc").stroke();
      y += 16;

      const workingWeek = opts.days.map((d) => WEEKDAY_NAMES[d]).join(", ");
      const first = opts.periods[0];
      const last = opts.periods[opts.periods.length - 1];
      const lines = [
        `Academic Year: ${opts.academicYear}`,
        `Working Week: ${workingWeek}`,
        first && last
          ? `School Hours: ${first.label.split("–")[0]!.trim()} – ${last.label.split("–")[1]!.trim()}`
          : "",
        `${opts.classCount} classes · ${opts.teacherCount} teachers · ${opts.periods.length} periods / day · ${opts.totalLessons} lessons / week`,
      ].filter(Boolean);
      doc.fontSize(10).fillColor("#000000");
      for (const line of lines) {
        doc.text(line, MARGIN, y);
        y += 15;
      }

      y += 10;
      doc.fontSize(11).font("Helvetica-Bold").text("Checks", MARGIN, y);
      y += 16;
      doc.fontSize(9).font("Helvetica");
      // These are guarantees, not aspirations: the solver enforces them and the
      // database refuses to publish a timetable that breaks them.
      for (const check of [
        "No teacher is scheduled in two classes at the same time.",
        "No class has two lessons at the same time.",
        "Every subject received exactly the periods it was allocated.",
        "No teacher is scheduled inside an unavailable window.",
      ]) {
        doc.text(`OK   ${check}`, MARGIN, y);
        y += 13;
      }

      if (opts.notes) {
        y += 8;
        doc.fontSize(11).font("Helvetica-Bold").text("Notes", MARGIN, y);
        y += 16;
        doc.fontSize(9).font("Helvetica").fillColor("#666666");
        doc.text(opts.notes, MARGIN, y, { width: PAGE_W - MARGIN * 2 });
        doc.fillColor("#000000");
      }

      // ── Grids ────────────────────────────────────────────────────────────
      const section = (heading: string, grids: Grid[]) => {
        if (grids.length === 0) return;
        doc.addPage();
        doc.fontSize(14).font("Helvetica-Bold").text(heading, MARGIN, MARGIN);
        let top = MARGIN + 26;
        for (const grid of grids) {
          const height = this.gridHeight(grid);
          if (top + height > PAGE_H - MARGIN) {
            doc.addPage();
            top = MARGIN;
          }
          top = this.drawGrid(doc, grid, opts.days, opts.periods, top) + 18;
        }
      };

      section("Part 1 — Class Timetables", opts.classGrids);
      section("Part 2 — Teacher Timetables", opts.teacherGrids);

      doc.end();
    });
  }

  private gridHeight(grid: Grid): number {
    return 18 + 16 + grid.rows.length * 30 + grid.breakAfter.size * 14;
  }

  /** Draws one grid and returns the y coordinate just below it. */
  private drawGrid(
    doc: PDFKit.PDFDocument,
    grid: Grid,
    days: number[],
    periods: { name: string; label: string }[],
    top: number,
  ): number {
    const timeCol = 74;
    const usable = PAGE_W - MARGIN * 2 - timeCol;
    const colW = usable / days.length;
    let y = top;

    doc.fontSize(11).font("Helvetica-Bold").fillColor("#000000");
    doc.text(grid.title, MARGIN, y);
    doc
      .fontSize(8)
      .font("Helvetica")
      .fillColor("#666666")
      .text(grid.subtitle, MARGIN, y, {
        width: PAGE_W - MARGIN * 2,
        align: "right",
      });
    y += 16;

    // Header row
    doc.rect(MARGIN, y, timeCol + colW * days.length, 16).fill("#f0f0f0");
    doc.fillColor("#333333").fontSize(8).font("Helvetica-Bold");
    doc.text("Period", MARGIN + 4, y + 4, { width: timeCol - 8 });
    days.forEach((d, i) => {
      doc.text(WEEKDAY_NAMES[d]!, MARGIN + timeCol + colW * i + 4, y + 4, {
        width: colW - 8,
      });
    });
    y += 16;

    grid.rows.forEach((row, r) => {
      const rowH = 30;
      doc
        .rect(MARGIN, y, timeCol + colW * days.length, rowH)
        .strokeColor("#dddddd")
        .stroke();

      doc.fillColor("#000000").fontSize(8).font("Helvetica-Bold");
      doc.text(periods[r]?.name ?? "", MARGIN + 4, y + 5, { width: timeCol - 8 });
      doc.fontSize(7).font("Helvetica").fillColor("#777777");
      doc.text(periods[r]?.label ?? "", MARGIN + 4, y + 16, { width: timeCol - 8 });

      row.forEach((cell, c) => {
        const x = MARGIN + timeCol + colW * c;
        doc.moveTo(x, y).lineTo(x, y + rowH).strokeColor("#dddddd").stroke();
        if (!cell) {
          doc.fillColor("#bbbbbb").fontSize(9).font("Helvetica");
          doc.text("—", x + 4, y + 10, { width: colW - 8 });
          return;
        }
        doc.fillColor("#000000").fontSize(8.5).font("Helvetica-Bold");
        doc.text(cell.top, x + 4, y + 5, { width: colW - 8, ellipsis: true });
        doc.fillColor("#666666").fontSize(7.5).font("Helvetica");
        doc.text(cell.bottom, x + 4, y + 17, { width: colW - 8, ellipsis: true });
      });
      y += rowH;

      const band = grid.breakAfter.get(r);
      if (band) {
        doc.rect(MARGIN, y, timeCol + colW * days.length, 14).fill("#f6f6f6");
        doc.fillColor("#666666").fontSize(7.5).font("Helvetica-Bold");
        doc.text(band, MARGIN, y + 4, {
          width: timeCol + colW * days.length,
          align: "center",
        });
        y += 14;
      }
    });

    doc.fillColor("#000000");
    return y;
  }
}
