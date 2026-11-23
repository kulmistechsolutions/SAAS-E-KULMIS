import { BadRequestException, Body, Controller, Post, Res } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Response } from "express";
import ExcelJS from "exceljs";
import { z } from "zod";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/auth.types";
import { Roles } from "../auth/roles.decorator";
import { STAFF_ROLES } from "../auth/role-groups";
import { contentDispositionHeader } from "../common/content-disposition.util";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import { DocumentsService } from "./documents.service";

const cell = z.union([z.string().max(2000), z.number()]).nullable();

const exportSchema = z.object({
  format: z.enum(["pdf", "xlsx"]),
  title: z.string().trim().min(1).max(160),
  /** Lines under the title: academic year, class, the filters applied. */
  subtitle: z.array(z.string().max(300)).max(8).default([]),
  columns: z
    .array(
      z.object({
        key: z.string().min(1).max(80),
        label: z.string().max(120),
        width: z.number().positive().max(1000).optional(),
        align: z.enum(["left", "right", "center"]).optional(),
      }),
    )
    .min(1)
    .max(60),
  rows: z.array(z.record(cell)).max(20000),
  fileName: z.string().trim().max(120).optional(),
});

/**
 * One export door for any table the app shows — a student list, a report, a
 * payroll — as a branded PDF or a real Excel workbook.
 *
 * The rows come from the screen, already filtered to what the user can see,
 * so this adds nothing they could not already read: it lays it out on the
 * school's own letterhead (logo and name), the way every printed document
 * in the system looks.
 */
@Controller("exports")
@Roles(...STAFF_ROLES)
export class ExportsController {
  constructor(
    private readonly docs: DocumentsService,
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly config: ConfigService,
  ) {}

  @Post("table")
  async table(
    @CurrentUser() me: AuthUser,
    @Body() body: unknown,
    @Res() res: Response,
  ) {
    const parsed = exportSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const dto = parsed.data;

    const school = await this.prisma.school.findFirst({
      where: { id: me.schoolId },
      select: { name: true, logoKey: true, phone: true, address: true },
    });
    const base = (dto.fileName || dto.title)
      .replace(/[^\p{L}\p{N}\- ]+/gu, "")
      .trim()
      .replace(/\s+/g, "-")
      .toLowerCase() || "export";
    const rows = dto.rows.map((r) =>
      Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v ?? ""])),
    ) as Record<string, string | number>[];

    if (dto.format === "pdf") {
      let logoBuffer: Buffer | null = null;
      if (school?.logoKey) {
        try {
          const bucket = this.config.get<string>("MINIO_BUCKET") ?? "ekulmis";
          logoBuffer = await this.storage.getObject(bucket, school.logoKey);
        } catch {
          logoBuffer = null;
        }
      }
      const buffer = await this.docs.buildBrandedPdfReport({
        schoolName: school?.name,
        logoBuffer,
        title: dto.title,
        headerLines: dto.subtitle,
        columns: dto.columns.map((c) => ({
          key: c.key,
          label: c.label,
          width: c.width ?? Math.max(40, Math.min(160, c.label.length * 7 + 30)),
        })),
        rows,
        preparedBy: me.username,
      });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", contentDispositionHeader(`${base}.pdf`));
      res.send(buffer);
      return;
    }

    const buffer = await this.workbook(school?.name ?? "", dto, rows);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader("Content-Disposition", contentDispositionHeader(`${base}.xlsx`));
    res.send(buffer);
  }

  /** A real .xlsx: school name and title on top, a styled header row, frozen panes. */
  private async workbook(
    schoolName: string,
    dto: z.infer<typeof exportSchema>,
    rows: Record<string, string | number>[],
  ): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    wb.creator = "eKulmis";
    const ws = wb.addWorksheet(dto.title.slice(0, 31).replace(/[\\/?*[\]:]/g, " "), {
      pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    });
    const n = dto.columns.length + 1; // + the # column
    const accent = "FF4F46E5";

    const titleRows = [schoolName, dto.title, ...dto.subtitle].filter(Boolean);
    titleRows.forEach((text, i) => {
      const row = ws.addRow([text]);
      ws.mergeCells(row.number, 1, row.number, n);
      row.getCell(1).font =
        i === 0
          ? { bold: true, size: 15, color: { argb: "FF0F172A" } }
          : i === 1
            ? { bold: true, size: 12, color: { argb: accent } }
            : { size: 10, color: { argb: "FF475569" } };
      row.getCell(1).alignment = { horizontal: "center" };
    });
    ws.addRow([]);

    const header = ws.addRow(["#", ...dto.columns.map((c) => c.label)]);
    header.eachCell((c) => {
      c.font = { bold: true, color: { argb: "FFFFFFFF" } };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: accent } };
      c.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      c.border = { bottom: { style: "thin", color: { argb: "FFC7D2FE" } } };
    });
    header.height = 22;

    rows.forEach((r, i) => {
      const row = ws.addRow([i + 1, ...dto.columns.map((c) => r[c.key] ?? "")]);
      row.eachCell({ includeEmpty: true }, (c, col) => {
        const def = col > 1 ? dto.columns[col - 2] : undefined;
        // IDs and phone numbers stay text, so a leading zero survives.
        if (typeof c.value === "string") c.numFmt = "@";
        c.alignment = {
          vertical: "middle",
          horizontal: col === 1 ? "center" : def?.align === "right" ? "right" : def?.align === "center" ? "center" : "left",
        };
        c.border = {
          top: { style: "thin", color: { argb: "FFE2E8F0" } },
          bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
          left: { style: "thin", color: { argb: "FFE2E8F0" } },
          right: { style: "thin", color: { argb: "FFE2E8F0" } },
        };
        if (i % 2 === 1) {
          c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
        }
      });
    });

    ws.getColumn(1).width = 6;
    dto.columns.forEach((c, i) => {
      const longest = Math.max(
        c.label.length,
        ...rows.slice(0, 500).map((r) => String(r[c.key] ?? "").length),
      );
      ws.getColumn(i + 2).width = Math.min(48, Math.max(10, longest + 3));
    });
    ws.views = [{ state: "frozen", ySplit: header.number }];
    ws.autoFilter = { from: { row: header.number, column: 1 }, to: { row: header.number, column: n } };

    const total = ws.addRow([`Total: ${rows.length} · Generated ${new Date().toISOString().slice(0, 16).replace("T", " ")} by eKulmis`]);
    ws.mergeCells(total.number, 1, total.number, n);
    total.getCell(1).font = { italic: true, size: 9, color: { argb: "FF94A3B8" } };

    return Buffer.from(await wb.xlsx.writeBuffer());
  }
}
