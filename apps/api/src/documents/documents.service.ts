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

  /** PDF report with school header (logo, name, exam context). */
  async buildBrandedPdfReport(opts: {
    schoolName?: string;
    logoBuffer?: Buffer | null;
    title: string;
    headerLines?: string[];
    columns: { key: string; label: string; width?: number }[];
    rows: Record<string, string | number>[];
    footer?: string;
    preparedBy?: string;
  }): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: "A4", layout: "landscape" });
      const chunks: Buffer[] = [];
      doc.on("data", (c) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      let y = 40;
      if (opts.logoBuffer) {
        try {
          doc.image(opts.logoBuffer, 40, y, { width: 48, height: 48 });
        } catch {
          /* skip invalid logo */
        }
      }
      if (opts.schoolName) {
        doc.fontSize(14).font("Helvetica-Bold").text(opts.schoolName, 100, y + 4);
        y += 22;
      }
      doc.fontSize(13).text(opts.title, 40, y, { align: "center" });
      y += 18;
      doc.fontSize(9).font("Helvetica");
      for (const line of opts.headerLines ?? []) {
        doc.text(line, 40, y, { align: "center" });
        y += 12;
      }
      if (opts.preparedBy) {
        doc.text(`Prepared by: ${opts.preparedBy}`, 40, y, { align: "right" });
        y += 12;
      }
      doc.text(`Date: ${new Date().toLocaleDateString()}`, 40, y, { align: "right" });
      y += 16;

      const colWidths = opts.columns.map((c) => c.width ?? 72);
      const startX = 40;
      doc.fontSize(8).font("Helvetica-Bold");
      let x = startX;
      for (let i = 0; i < opts.columns.length; i++) {
        doc.text(opts.columns[i]!.label, x, y, { width: colWidths[i]!, continued: false });
        x += colWidths[i]!;
      }
      y += 14;
      doc.font("Helvetica");

      for (const row of opts.rows) {
        if (y > 520) {
          doc.addPage();
          y = 40;
        }
        x = startX;
        for (let i = 0; i < opts.columns.length; i++) {
          const key = opts.columns[i]!.key;
          doc.text(String(row[key] ?? ""), x, y, { width: colWidths[i]!, continued: false });
          x += colWidths[i]!;
        }
        y += 12;
      }

      if (opts.footer) {
        doc.fontSize(8).text(opts.footer, 40, 520, { align: "center" });
      }

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

  /** Excel export with school / exam header rows. */
  async buildBrandedExcelReport(opts: {
    sheetName: string;
    headerLines?: string[];
    columns: { key: string; label: string }[];
    rows: Record<string, string | number>[];
  }): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(opts.sheetName);
    for (const line of opts.headerLines ?? []) {
      const row = ws.addRow([line]);
      row.font = { bold: true, size: 12 };
    }
    if (opts.headerLines?.length) ws.addRow([]);
    ws.addRow(opts.columns.map((c) => c.label));
    const header = ws.getRow(ws.rowCount);
    header.font = { bold: true };
    for (const row of opts.rows) {
      ws.addRow(opts.columns.map((c) => row[c.key] ?? ""));
    }
    ws.columns.forEach((col) => {
      col.width = 16;
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
