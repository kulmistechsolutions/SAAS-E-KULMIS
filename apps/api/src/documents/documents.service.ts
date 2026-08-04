import { Injectable } from "@nestjs/common";
import PDFDocument from "pdfkit";
import ExcelJS from "exceljs";

@Injectable()
export class DocumentsService {
  /** Build a simple PDF table report and return the buffer. */
  async buildPdfReport(opts: {
    title: string;
    subtitle?: string;
    columns: { key: string; label: string; width?: number }[];
    rows: Record<string, string | number>[];
  }): Promise<Buffer> {
    return this.buildBrandedPdfReport({
      title: opts.title,
      headerLines: opts.subtitle ? [opts.subtitle] : [],
      columns: opts.columns,
      rows: opts.rows,
    });
  }

  /**
   * PDF report with school header (logo, name, exam context) and a bordered,
   * page-fitted table.
   *
   * Column `width`s are treated as *proportions*, not absolute points: they're
   * scaled so the table always spans exactly the printable width. A results
   * sheet with 17 subject columns therefore still fits on the page instead of
   * running off the right edge and losing its Total/Grade columns.
   *
   * Every cell is drawn on a single line and ellipsized if it doesn't fit —
   * wrapping would push text into the row below, which is what made long
   * student names overlap each other.
   */
  async buildBrandedPdfReport(opts: {
    schoolName?: string;
    logoBuffer?: Buffer | null;
    title: string;
    headerLines?: string[];
    columns: { key: string; label: string; width?: number }[];
    rows: Record<string, string | number>[];
    footer?: string;
    preparedBy?: string;
    /** Signature blocks printed under the table, e.g. ["Class Teacher", "Principal"]. */
    signatures?: string[];
  }): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const M = 36;
      const doc = new PDFDocument({
        margin: M,
        size: "A4",
        layout: "landscape",
        // Page numbers are stamped after the last row, once the total is known.
        bufferPages: true,
      });
      const chunks: Buffer[] = [];
      doc.on("data", (c) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const PAGE_W = doc.page.width;
      const PAGE_H = doc.page.height;
      const CONTENT_W = PAGE_W - M * 2;
      const BOTTOM = PAGE_H - M - 28; // leave room for the footer strip

      const INK = "#111827";
      const MUTED = "#6b7280";
      const LINE = "#d1d5db";
      const HEAD_BG = "#f3f4f6";
      const STRIPE = "#fafafa";

      const cols = opts.columns;
      // Scale the requested widths to exactly fill the printable width.
      const raw = cols.map((c) => c.width ?? 72);
      const rawTotal = raw.reduce((a, b) => a + b, 0) || 1;
      const colW = raw.map((w) => (w / rawTotal) * CONTENT_W);

      // Tighten the type as the table gets wider so many-subject sheets stay legible.
      const FONT = cols.length > 14 ? 6.5 : cols.length > 10 ? 7 : 8;
      const ROW_H = FONT + 8;
      const PAD = 3;

      /** Single-line text, ellipsized to fit the column. */
      const fit = (text: string, width: number): string => {
        const max = width - PAD * 2;
        if (max <= 0) return "";
        if (doc.widthOfString(text) <= max) return text;
        let s = text;
        while (s.length > 1 && doc.widthOfString(`${s}…`) > max) s = s.slice(0, -1);
        return `${s}…`;
      };

      const cell = (text: string, x: number, y: number, width: number) => {
        doc.text(fit(text, width), x + PAD, y + (ROW_H - FONT) / 2 - 1, {
          width: width - PAD * 2,
          lineBreak: false,
        });
      };

      /** Full branded header. Returns the y to start the table at. */
      const drawPageHeader = (): number => {
        let y = M;
        let textX = M;
        if (opts.logoBuffer) {
          try {
            doc.image(opts.logoBuffer, M, y, { fit: [46, 46] });
            textX = M + 56;
          } catch {
            /* skip invalid logo */
          }
        }
        if (opts.schoolName) {
          doc
            .fillColor(INK)
            .fontSize(14)
            .font("Helvetica-Bold")
            .text(opts.schoolName.toUpperCase(), textX, y + 2, {
              width: CONTENT_W - (textX - M),
              lineBreak: false,
            });
          y += 20;
        }
        doc
          .fillColor(INK)
          .fontSize(11)
          .font("Helvetica-Bold")
          .text(opts.title, M, y, { width: CONTENT_W, align: "center", lineBreak: false });
        y += 15;

        doc.fontSize(8.5).font("Helvetica").fillColor(MUTED);
        for (const line of opts.headerLines ?? []) {
          doc.text(line, M, y, { width: CONTENT_W, align: "center", lineBreak: false });
          y += 11;
        }

        const meta = [
          opts.preparedBy ? `Prepared by: ${opts.preparedBy}` : null,
          `Date: ${new Date().toLocaleDateString()}`,
        ].filter(Boolean) as string[];
        if (meta.length) {
          y += 2;
          doc.fontSize(7.5).text(meta.join("   ·   "), M, y, {
            width: CONTENT_W,
            align: "right",
            lineBreak: false,
          });
          y += 11;
        }

        // Rule under the letterhead.
        y += 4;
        doc.moveTo(M, y).lineTo(M + CONTENT_W, y).lineWidth(1).strokeColor(INK).stroke();
        return y + 8;
      };

      /** Column labels band. Returns the y below it. */
      const drawTableHead = (y: number): number => {
        doc.rect(M, y, CONTENT_W, ROW_H).fillAndStroke(HEAD_BG, LINE);
        doc.fillColor(INK).fontSize(FONT).font("Helvetica-Bold");
        let x = M;
        for (let i = 0; i < cols.length; i++) {
          const w = colW[i]!;
          if (i > 0) {
            doc.moveTo(x, y).lineTo(x, y + ROW_H).lineWidth(0.5).strokeColor(LINE).stroke();
          }
          doc.fillColor(INK);
          cell(cols[i]!.label, x, y, w);
          x += w;
        }
        doc.font("Helvetica");
        return y + ROW_H;
      };

      let y = drawPageHeader();
      y = drawTableHead(y);

      opts.rows.forEach((row, index) => {
        if (y + ROW_H > BOTTOM) {
          doc.addPage();
          y = drawPageHeader();
          y = drawTableHead(y);
        }

        if (index % 2 === 1) {
          doc.rect(M, y, CONTENT_W, ROW_H).fill(STRIPE);
        }
        doc.rect(M, y, CONTENT_W, ROW_H).lineWidth(0.5).strokeColor(LINE).stroke();

        doc.fillColor(INK).fontSize(FONT).font("Helvetica");
        let x = M;
        for (let i = 0; i < cols.length; i++) {
          const w = colW[i]!;
          if (i > 0) {
            doc.moveTo(x, y).lineTo(x, y + ROW_H).lineWidth(0.5).strokeColor(LINE).stroke();
            doc.fillColor(INK);
          }
          cell(String(row[cols[i]!.key] ?? ""), x, y, w);
          x += w;
        }
        y += ROW_H;
      });

      if (opts.rows.length === 0) {
        doc.rect(M, y, CONTENT_W, ROW_H).lineWidth(0.5).strokeColor(LINE).stroke();
        doc.fillColor(MUTED).fontSize(FONT);
        doc.text("No records", M, y + (ROW_H - FONT) / 2 - 1, {
          width: CONTENT_W,
          align: "center",
          lineBreak: false,
        });
        y += ROW_H;
      }

      if (opts.signatures?.length) {
        const needed = 46;
        if (y + needed > BOTTOM) {
          doc.addPage();
          y = M;
        }
        y += 26;
        const slot = CONTENT_W / opts.signatures.length;
        doc.fontSize(8).font("Helvetica").fillColor(INK);
        opts.signatures.forEach((label, i) => {
          const x = M + slot * i;
          const lineW = Math.min(slot - 24, 160);
          doc
            .moveTo(x, y)
            .lineTo(x + lineW, y)
            .lineWidth(0.75)
            .strokeColor(INK)
            .stroke();
          doc.fillColor(MUTED).text(label, x, y + 4, { width: lineW, lineBreak: false });
        });
      }

      // Footer strip + page numbers on every buffered page.
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        // Writing inside the bottom margin would otherwise spill onto a new page.
        const keepBottom = doc.page.margins.bottom;
        doc.page.margins.bottom = 0;

        const fy = PAGE_H - M - 14;
        doc.moveTo(M, fy).lineTo(M + CONTENT_W, fy).lineWidth(0.5).strokeColor(LINE).stroke();
        doc.fontSize(7).font("Helvetica").fillColor(MUTED);
        if (opts.footer) {
          doc.text(opts.footer, M, fy + 4, {
            width: CONTENT_W / 2,
            lineBreak: false,
          });
        }
        doc.text(`Page ${i - range.start + 1} of ${range.count}`, M + CONTENT_W / 2, fy + 4, {
          width: CONTENT_W / 2,
          align: "right",
          lineBreak: false,
        });

        doc.page.margins.bottom = keepBottom;
      }

      doc.flushPages();
      doc.end();
    });
  }

  /** Build an Excel workbook from sheet data. */
  async buildExcelReport(opts: {
    sheetName: string;
    columns: { key: string; label: string }[];
    rows: Record<string, string | number>[];
  }): Promise<Buffer> {
    return this.buildBrandedExcelReport({
      sheetName: opts.sheetName,
      columns: opts.columns,
      rows: opts.rows,
    });
  }

  /** Excel export with school / exam header rows, a styled header band and
   *  bordered cells, so the spreadsheet matches the PDF's look. */
  async buildBrandedExcelReport(opts: {
    sheetName: string;
    headerLines?: string[];
    columns: { key: string; label: string }[];
    rows: Record<string, string | number>[];
  }): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(opts.sheetName);
    const lastCol = Math.max(opts.columns.length, 1);

    (opts.headerLines ?? []).forEach((line, i) => {
      const row = ws.addRow([line]);
      row.font = { bold: true, size: i === 0 ? 13 : 11 };
      row.alignment = { horizontal: "center" };
      ws.mergeCells(row.number, 1, row.number, lastCol);
    });
    if (opts.headerLines?.length) ws.addRow([]);

    ws.addRow(opts.columns.map((c) => c.label));
    const headerRowNumber = ws.rowCount;
    const header = ws.getRow(headerRowNumber);
    header.font = { bold: true };
    header.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    header.height = 22;
    header.eachCell((c) => {
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F4F6" } };
      c.border = {
        top: { style: "thin", color: { argb: "FFD1D5DB" } },
        left: { style: "thin", color: { argb: "FFD1D5DB" } },
        bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
        right: { style: "thin", color: { argb: "FFD1D5DB" } },
      };
    });
    // Keep the labels visible while scrolling a long class list.
    ws.views = [{ state: "frozen", ySplit: ws.rowCount }];

    for (const row of opts.rows) {
      const added = ws.addRow(opts.columns.map((c) => row[c.key] ?? ""));
      added.eachCell((c) => {
        c.border = {
          top: { style: "hair", color: { argb: "FFE5E7EB" } },
          left: { style: "hair", color: { argb: "FFE5E7EB" } },
          bottom: { style: "hair", color: { argb: "FFE5E7EB" } },
          right: { style: "hair", color: { argb: "FFE5E7EB" } },
        };
      });
    }

    // Size each column to its widest cell so nothing shows as ####. Only the
    // table itself is measured — the merged title rows above it are far wider
    // than any data cell and would blow column A out to the cap.
    ws.columns.forEach((col, i) => {
      let widest = opts.columns[i]?.label.length ?? 10;
      col.eachCell?.({ includeEmpty: false }, (c, rowNumber) => {
        if (rowNumber < headerRowNumber) return;
        const len = String(c.value ?? "").length;
        if (len > widest) widest = len;
      });
      col.width = Math.min(Math.max(widest + 2, 10), 40);
    });

    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf as ArrayBuffer);
  }

  /** Parse the first worksheet of an uploaded Excel file. */
  async parseExcelRows(
    buffer: Buffer,
    headerRow = 1,
  ): Promise<Record<string, string>[]> {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
    const ws = wb.worksheets[0];
    if (!ws) return [];

    const headers: string[] = [];
    ws.getRow(headerRow).eachCell((cell, col) => {
      headers[col - 1] = String(cell.value ?? "").trim();
    });

    const rows: Record<string, string>[] = [];
    ws.eachRow((row, rowNumber) => {
      if (rowNumber <= headerRow) return;
      const obj: Record<string, string> = {};
      let hasValue = false;
      row.eachCell((cell, col) => {
        const key = headers[col - 1];
        if (!key) return;
        const val = String(cell.value ?? "").trim();
        if (val) hasValue = true;
        obj[key] = val;
      });
      if (hasValue) rows.push(obj);
    });
    return rows;
  }
}
